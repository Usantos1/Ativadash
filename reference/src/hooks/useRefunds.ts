import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';

export interface RefundItem {
  sale_item_id?: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  reason?: string;
  condition?: 'novo' | 'usado' | 'defeituoso';
  return_to_stock?: boolean;
}

export interface Refund {
  id: string;
  company_id: string;
  sale_id: string;
  refund_number: string;
  refund_type: 'full' | 'partial';
  reason: string;
  reason_details?: string;
  total_refund_value: number;
  refund_method: 'cash' | 'voucher' | 'original';
  voucher_id?: string;
  status: 'pending' | 'approved' | 'completed' | 'cancelled';
  customer_id?: string;
  customer_name?: string;
  created_by: string;
  created_at: string;
  items?: RefundItem[];
  voucher?: Voucher;
}

export interface Voucher {
  id: string;
  code: string;
  company_id: string;
  original_sale_id?: string;
  refund_id?: string;
  customer_id?: string;
  customer_name: string;
  customer_document?: string;
  customer_phone?: string;
  original_value: number;
  current_value: number;
  expires_at?: string;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  is_transferable: boolean;
  created_at: string;
}

export interface CreateRefundData {
  sale_id: string;
  refund_type: 'full' | 'partial';
  reason: string;
  reason_details?: string;
  refund_method: 'cash' | 'voucher' | 'original';
  items: RefundItem[];
  customer_id?: string;
  customer_name?: string;
  notes?: string;
}

const REFUNDS_QUERY_KEY = ['refunds'] as const;
const VOUCHERS_QUERY_KEY = ['refunds-vouchers'] as const;

export function useRefunds() {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Lista de devoluções com cache — evita múltiplas requisições e 429
  const refundsQuery = useQuery({
    queryKey: REFUNDS_QUERY_KEY,
    queryFn: async (): Promise<Refund[]> => {
      const response = await apiClient.get('/refunds?');
      if (response.error) throw new Error(response.error as string);
      if (!response.data?.success) return [];
      return response.data.data || [];
    },
    staleTime: 90 * 1000, // 1,5 min — reduz refetch ao abrir/focar na página
    refetchOnWindowFocus: false,
  });
  const refunds = refundsQuery.data ?? [];

  // Lista de vales com cache — evita múltiplas requisições e 429
  const vouchersQuery = useQuery({
    queryKey: VOUCHERS_QUERY_KEY,
    queryFn: async (): Promise<Voucher[]> => {
      const response = await apiClient.get('/refunds/vouchers/list?');
      if (response.error) throw new Error(response.error as string);
      if (!response.data?.success) return [];
      return response.data.data || [];
    },
    staleTime: 90 * 1000,
    refetchOnWindowFocus: false,
  });
  const vouchers = vouchersQuery.data ?? [];

  const loadingRefunds = refundsQuery.isLoading || refundsQuery.isFetching;
  const loadingVouchers = vouchersQuery.isLoading || vouchersQuery.isFetching;

  const fetchRefunds = useCallback(async (filters?: { status?: string; startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    try {
      const response = await apiClient.get(`/refunds?${params.toString()}`);
      if (response.error) {
        toast({ title: 'Erro', description: String(response.error), variant: 'destructive' });
        return [];
      }
      const data = response.data?.data ?? [];
      queryClient.setQueryData(REFUNDS_QUERY_KEY, data);
      return data;
    } catch (error: any) {
      const msg = error?.data?.error || error?.message || 'Erro ao carregar devoluções';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
      return [];
    }
  }, [toast, queryClient]);

  const refetchRefunds = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: REFUNDS_QUERY_KEY });
  }, [queryClient]);

  const refetchVouchers = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: VOUCHERS_QUERY_KEY });
  }, [queryClient]);

  const fetchRefund = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/refunds/${id}`);
      return response.data?.data || null;
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar devolução',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createRefund = useCallback(async (data: CreateRefundData) => {
    setLoading(true);
    try {
      // Log detalhado dos itens
      console.log('[useRefunds] Criando devolução com dados:', JSON.stringify(data, null, 2));
      data.items.forEach((item, idx) => {
        console.log(`[useRefunds] Item ${idx}: ${item.product_name}, qty=${item.quantity}, unit_price=${item.unit_price}, subtotal=${item.quantity * item.unit_price}`);
      });
      
      const response = await apiClient.post('/refunds', data);
      if (response.data?.success) {
        queryClient.invalidateQueries({ queryKey: REFUNDS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: VOUCHERS_QUERY_KEY });
        toast({
          title: 'Sucesso',
          description: 'Devolução criada com sucesso'
        });
        return response.data.data;
      }
      throw new Error(response.data?.error || response.error || 'Erro desconhecido');
    } catch (error: any) {
      const msg = error?.data?.error || error?.message || 'Erro ao criar devolução';
      toast({
        title: 'Erro ao criar devolução',
        description: msg,
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, queryClient]);

  const approveRefund = useCallback(async (id: string, options?: { approval_password?: string }) => {
    setLoading(true);
    try {
      const body = options?.approval_password ? { approval_password: options.approval_password } : {};
      const response = await apiClient.put(`/refunds/${id}/approve`, body);
      if (response.data?.success) {
        queryClient.invalidateQueries({ queryKey: REFUNDS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: VOUCHERS_QUERY_KEY });
        toast({
          title: 'Sucesso',
          description: 'Devolução aprovada'
        });
        return response.data.data;
      }
      throw new Error(response.data?.error || response.error);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao aprovar devolução',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, queryClient]);

  const completeRefund = useCallback(async (id: string, options?: { approval_password?: string }) => {
    setLoading(true);
    try {
      const body = options?.approval_password ? { approval_password: options.approval_password } : {};
      const response = await apiClient.put(`/refunds/${id}/complete`, body);
      if (response.data?.success) {
        queryClient.invalidateQueries({ queryKey: REFUNDS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: VOUCHERS_QUERY_KEY });
        toast({
          title: 'Sucesso',
          description: 'Devolução completada e estoque atualizado'
        });
        return true;
      }
      throw new Error(response.data?.error || response.error);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao completar devolução',
        variant: 'destructive'
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, queryClient]);

  const cancelRefund = useCallback(async (id: string, reason: string) => {
    setLoading(true);
    try {
      const response = await apiClient.put(`/refunds/${id}/cancel`, { reason });
      if (response.data?.success) {
        queryClient.invalidateQueries({ queryKey: REFUNDS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: VOUCHERS_QUERY_KEY });
        toast({
          title: 'Sucesso',
          description: 'Devolução cancelada'
        });
        return true;
      }
      throw new Error(response.data?.error || response.error);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao cancelar devolução',
        variant: 'destructive'
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, queryClient]);

  // ═══════════════════════════════════════════════════════
  // VALES COMPRA
  // ═══════════════════════════════════════════════════════

  const fetchVouchers = useCallback(async (filters?: { status?: string; customer?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.customer) params.append('customer', filters.customer);
    try {
      const response = await apiClient.get(`/refunds/vouchers/list?${params.toString()}`);
      if (response.error) {
        toast({ title: 'Erro', description: String(response.error), variant: 'destructive' });
        return [];
      }
      const data = response.data?.data ?? [];
      queryClient.setQueryData(VOUCHERS_QUERY_KEY, data);
      return data;
    } catch (error: any) {
      toast({ title: 'Erro', description: 'Erro ao carregar vales', variant: 'destructive' });
      return [];
    }
  }, [toast, queryClient]);

  const checkVoucher = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/refunds/vouchers/code/${code}`);
      return response.data; // Retorna { success, data, error }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao verificar vale',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const useVoucher = useCallback(async (voucherId: string, saleId: string, amount: number, customerDocument?: string) => {
    setLoading(true);
    try {
      const response = await apiClient.post(`/refunds/vouchers/${voucherId}/use`, {
        sale_id: saleId,
        amount,
        customer_document: customerDocument
      });
      if (response.data?.success) {
        queryClient.invalidateQueries({ queryKey: VOUCHERS_QUERY_KEY });
        toast({
          title: 'Sucesso',
          description: `Vale utilizado. Saldo restante: R$ ${response.data.data.balance_after.toFixed(2)}`
        });
        return response.data.data;
      }
      throw new Error(response.data?.error || response.error);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao usar vale',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, queryClient]);

  const fetchVoucherHistory = useCallback(async (voucherId: string) => {
    try {
      const response = await apiClient.get(`/refunds/vouchers/${voucherId}/history`);
      return response.data?.data || [];
    } catch (error: any) {
      return [];
    }
  }, []);

  return {
    loading: loading || loadingRefunds || loadingVouchers,
    refunds,
    vouchers,
    fetchRefunds,
    refetchRefunds,
    refetchVouchers,
    fetchRefund,
    createRefund,
    approveRefund,
    completeRefund,
    cancelRefund,
    fetchVouchers,
    checkVoucher,
    useVoucher,
    fetchVoucherHistory
  };
}

