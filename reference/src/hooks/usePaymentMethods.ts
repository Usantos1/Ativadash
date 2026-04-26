import { useState, useCallback } from 'react';
import { apiClient } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';

export interface PaymentFee {
  id: string;
  payment_method_id: string;
  installments: number;
  fee_percentage: number;
  fee_fixed: number;
  days_to_receive: number;
  description?: string;
  is_active: boolean;
}

export interface Wallet {
  id: string;
  company_id?: string;
  name: string;
  sort_order: number;
}

export interface PaymentMethod {
  id: string;
  company_id: string;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  accepts_installments: boolean;
  max_installments: number;
  min_value_for_installments: number;
  icon?: string;
  color?: string;
  sort_order: number;
  fees_count?: number;
  fees?: PaymentFee[];
  wallet_id?: string | null;
  wallet_name?: string | null;
}

export interface CreatePaymentMethodData {
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
  accepts_installments?: boolean;
  max_installments?: number;
  min_value_for_installments?: number;
  icon?: string;
  color?: string;
  sort_order?: number;
  wallet_id?: string | null;
}

export interface NetCalculation {
  gross_amount: number;
  fee_percentage: number;
  fee_fixed: number;
  fee_amount: number;
  net_amount: number;
  days_to_receive: number;
}

export interface FeesReport {
  by_method: Array<{
    payment_method: string;
    installments: number;
    total_transactions: number;
    gross_total: number;
    total_fees: number;
    net_total: number;
  }>;
  totals: {
    total_transactions: number;
    gross_total: number;
    total_fees: number;
    net_total: number;
  };
}

export function usePaymentMethods() {
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const { toast } = useToast();

  const fetchPaymentMethods = useCallback(async (activeOnly = false, withFees = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeOnly) params.set('active_only', 'true');
      if (withFees) params.set('with_fees', 'true');
      const qs = params.toString();
      const url = qs ? `/payment-methods?${qs}` : '/payment-methods';
      const response = await apiClient.get(url);
      // apiClient retorna { data: { success, data } } ou { error }
      if (response.error) {
        throw new Error(response.error);
      }
      const apiData = response.data;
      if (apiData?.success && apiData?.data) {
        setPaymentMethods(apiData.data);
        return apiData.data;
      }
      // Fallback caso a resposta venha em formato diferente
      if (Array.isArray(apiData)) {
        setPaymentMethods(apiData);
        return apiData;
      }
      return [];
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar formas de pagamento',
        variant: 'destructive'
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchWallets = useCallback(async () => {
    try {
      const response = await apiClient.get('/payment-methods/wallets');
      if (response.error) return [];
      const apiData = response.data;
      if (apiData?.success && apiData?.data) {
        setWallets(apiData.data);
        return apiData.data;
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  const createWallet = useCallback(async (data: { name?: string; sort_order?: number }) => {
    setLoading(true);
    try {
      const response = await apiClient.post('/payment-methods/wallets', data);
      if (response.error) throw new Error(response.error);
      const apiData = response.data;
      if (apiData?.success) {
        toast({ title: 'Sucesso', description: 'Carteira criada com sucesso' });
        await fetchWallets();
        return apiData.data;
      }
      throw new Error(apiData?.error || 'Erro ao criar');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar carteira',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, fetchWallets]);

  const updateWallet = useCallback(async (id: string, data: { name?: string; sort_order?: number }) => {
    setLoading(true);
    try {
      const response = await apiClient.put(`/payment-methods/wallets/${id}`, data);
      if (response.error) throw new Error(response.error);
      const apiData = response.data;
      if (apiData?.success) {
        toast({ title: 'Sucesso', description: 'Carteira atualizada' });
        await fetchWallets();
        return apiData.data;
      }
      throw new Error(apiData?.error || 'Erro ao atualizar');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar carteira',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, fetchWallets]);

  const deleteWallet = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await apiClient.delete(`/payment-methods/wallets/${id}`);
      if (response.error) throw new Error(response.error);
      const apiData = response.data;
      if (apiData?.success) {
        toast({ title: 'Sucesso', description: 'Carteira excluída' });
        await fetchWallets();
        return true;
      }
      throw new Error(apiData?.error || 'Erro ao excluir');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir carteira',
        variant: 'destructive'
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, fetchWallets]);

  const fetchPaymentMethod = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/payment-methods/${id}`);
      if (response.error) throw new Error(response.error);
      return response.data?.data || response.data;
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar forma de pagamento',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createPaymentMethod = useCallback(async (data: CreatePaymentMethodData) => {
    setLoading(true);
    try {
      const response = await apiClient.post('/payment-methods', data);
      if (response.error) throw new Error(response.error);
      const apiData = response.data;
      if (apiData?.success) {
        toast({
          title: 'Sucesso',
          description: 'Forma de pagamento criada com sucesso'
        });
        return apiData.data;
      }
      throw new Error(apiData?.error || 'Erro ao criar');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar forma de pagamento',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updatePaymentMethod = useCallback(async (id: string, data: Partial<CreatePaymentMethodData>) => {
    setLoading(true);
    try {
      const response = await apiClient.put(`/payment-methods/${id}`, data);
      if (response.error) throw new Error(response.error);
      const apiData = response.data;
      if (apiData?.success) {
        toast({
          title: 'Sucesso',
          description: 'Forma de pagamento atualizada'
        });
        return apiData.data;
      }
      throw new Error(apiData?.error || 'Erro ao atualizar');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar forma de pagamento',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const deletePaymentMethod = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await apiClient.delete(`/payment-methods/${id}`);
      if (response.error) throw new Error(response.error);
      const apiData = response.data;
      if (apiData?.success) {
        toast({
          title: 'Sucesso',
          description: 'Forma de pagamento excluída'
        });
        return true;
      }
      throw new Error(apiData?.error || 'Erro ao excluir');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir forma de pagamento',
        variant: 'destructive'
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // ═══════════════════════════════════════════════════════
  // TAXAS
  // ═══════════════════════════════════════════════════════

  const fetchFees = useCallback(async (methodId: string) => {
    try {
      const response = await apiClient.get(`/payment-methods/${methodId}/fees`);
      if (response.error) return [];
      return response.data?.data || response.data || [];
    } catch (error: any) {
      return [];
    }
  }, []);

  const saveFee = useCallback(async (methodId: string, fee: Partial<PaymentFee>) => {
    setLoading(true);
    try {
      const response = await apiClient.post(`/payment-methods/${methodId}/fees`, fee);
      if (response.error) throw new Error(response.error);
      const apiData = response.data;
      if (apiData?.success) {
        toast({
          title: 'Sucesso',
          description: 'Taxa salva com sucesso'
        });
        return apiData.data;
      }
      throw new Error(apiData?.error || 'Erro ao salvar');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar taxa',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const saveFeesBulk = useCallback(async (methodId: string, fees: Partial<PaymentFee>[]) => {
    setLoading(true);
    try {
      const response = await apiClient.put(`/payment-methods/${methodId}/fees/bulk`, { fees });
      if (response.error) throw new Error(response.error);
      const apiData = response.data;
      if (apiData?.success) {
        toast({
          title: 'Sucesso',
          description: 'Taxas atualizadas com sucesso'
        });
        return apiData.data;
      }
      throw new Error(apiData?.error || 'Erro ao salvar');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar taxas',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const deleteFee = useCallback(async (methodId: string, feeId: string) => {
    setLoading(true);
    try {
      const response = await apiClient.delete(`/payment-methods/${methodId}/fees/${feeId}`);
      if (response.error) throw new Error(response.error);
      const apiData = response.data;
      if (apiData?.success) {
        toast({
          title: 'Sucesso',
          description: 'Taxa excluída'
        });
        return true;
      }
      throw new Error(apiData?.error || 'Erro ao excluir');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir taxa',
        variant: 'destructive'
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // ═══════════════════════════════════════════════════════
  // CÁLCULOS E RELATÓRIOS
  // ═══════════════════════════════════════════════════════

  const calculateNet = useCallback(async (paymentMethodCode: string, installments: number, grossAmount: number): Promise<NetCalculation | null> => {
    try {
      const response = await apiClient.post('/payment-methods/calculate-net', {
        payment_method_code: paymentMethodCode,
        installments,
        gross_amount: grossAmount
      });
      if (response.error) return null;
      return response.data?.data || response.data;
    } catch (error: any) {
      return null;
    }
  }, []);

  const fetchFeesReport = useCallback(async (startDate: string, endDate: string): Promise<FeesReport | null> => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/payment-methods/report/fees?start_date=${startDate}&end_date=${endDate}`);
      if (response.error) throw new Error(response.error);
      return response.data?.data || response.data;
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao gerar relatório',
        variant: 'destructive'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    loading,
    paymentMethods,
    wallets,
    fetchPaymentMethods,
    fetchPaymentMethod,
    fetchWallets,
    createWallet,
    updateWallet,
    deleteWallet,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    fetchFees,
    saveFee,
    saveFeesBulk,
    deleteFee,
    calculateNet,
    fetchFeesReport
  };
}

