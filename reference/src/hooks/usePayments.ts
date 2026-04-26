import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api';

export interface Payment {
  id: string;
  company_id: string;
  subscription_id: string | null;
  amount: number;
  payment_method: string;
  status: 'pending' | 'paid' | 'cancelled' | 'expired' | 'failed';
  external_id: string;
  pix_code: string | null;
  pix_qr_code: string | null;
  description: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  plan_name?: string;
  company_name?: string;
}

export interface PixPayment {
  code: string;
  qrCode: string;
  expiresAt: string;
  txid: string;
}

export const usePayments = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  // Criar novo pagamento PIX
  const createPixPayment = useCallback(async (
    companyId: string,
    amount: number,
    subscriptionId?: string,
    description?: string
  ): Promise<{ payment: Payment; pix: PixPayment } | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/payments/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          company_id: companyId,
          subscription_id: subscriptionId,
          amount,
          description
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar pagamento');
      }

      const data = await response.json();
      return {
        payment: data.data,
        pix: data.pix
      };
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  // Verificar status de um pagamento
  const checkPaymentStatus = useCallback(async (paymentId: string): Promise<Payment | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/payments/status/${paymentId}`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao verificar status');
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  // Listar pagamentos de uma empresa
  const listCompanyPayments = useCallback(async (
    companyId: string,
    options?: { page?: number; limit?: number; status?: string }
  ): Promise<{ payments: Payment[]; pagination: any } | null> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.status) params.append('status', options.status);

      const response = await fetch(`${API_URL}/payments/company/${companyId}?${params}`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao listar pagamentos');
      }

      const data = await response.json();
      return {
        payments: data.data,
        pagination: data.pagination
      };
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  // Simular confirmação de pagamento (apenas para testes)
  const simulatePaymentConfirmation = useCallback(async (paymentId: string): Promise<Payment | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/payments/simulate-confirm/${paymentId}`, {
        method: 'POST',
        headers: getHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao simular confirmação');
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  return {
    loading,
    error,
    createPixPayment,
    checkPaymentStatus,
    listCompanyPayments,
    simulatePaymentConfirmation
  };
};

