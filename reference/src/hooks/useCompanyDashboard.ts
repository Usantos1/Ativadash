import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.ativafix.com/api';

interface CompanyMetrics {
  company: {
    id: string;
    name: string;
    status: string;
    created_at: string;
  };
  subscription: {
    status: string;
    expires_at: string | null;
    plan: string | null;
    price_monthly: number | null;
    price_yearly: number | null;
  };
  metrics: {
    users: { total: number; active: number };
    products: number;
    clients: number;
    orders: { total: number; period: number };
    sales: {
      total_count: number;
      total_value: number;
      period_count: number;
      period_value: number;
    };
  };
  limits: {
    users: { current: number; max: number; percentage: number };
    products: { current: number; max: number; percentage: number };
    orders: { current: number; max: number; percentage: number };
  };
  period: number;
}

interface AdminOverview {
  companies: {
    byStatus: Record<string, number>;
    total: number;
    perMonth: Array<{ month: string; count: number }>;
  };
  subscriptions: {
    byStatus: Record<string, number>;
    expiringSoon: number;
  };
  users: { total: number };
  revenue: { monthly: number; total: number };
  payments: {
    pending: { count: number; total: number };
  };
  topPlans: Array<{ name: string; code: string; subscriptions_count: number }>;
}

export const useCompanyDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

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

  // Buscar métricas da empresa
  const getCompanyMetrics = useCallback(async (companyId: string, period: number = 30): Promise<CompanyMetrics | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/dashboard/company/${companyId}/metrics?period=${period}`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar métricas');
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

  // Buscar gráfico de vendas
  const getSalesChart = useCallback(async (companyId: string, period: number = 30) => {
    try {
      const response = await fetch(`${API_URL}/dashboard/company/${companyId}/sales-chart?period=${period}`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar gráfico de vendas');
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      console.error('Erro ao buscar gráfico:', err);
      return [];
    }
  }, [getHeaders]);

  // Buscar ordens por status
  const getOrdersByStatus = useCallback(async (companyId: string) => {
    try {
      const response = await fetch(`${API_URL}/dashboard/company/${companyId}/orders-by-status`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar ordens por status');
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      console.error('Erro ao buscar ordens:', err);
      return [];
    }
  }, [getHeaders]);

  // Admin: Buscar overview geral
  const getAdminOverview = useCallback(async (): Promise<AdminOverview | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/dashboard/admin/overview`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar overview');
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

  // Admin: Buscar assinaturas expirando
  const getExpiringSubscriptions = useCallback(async (days: number = 7) => {
    try {
      const response = await fetch(`${API_URL}/dashboard/admin/expiring-subscriptions?days=${days}`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar assinaturas expirando');
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      console.error('Erro ao buscar assinaturas:', err);
      return [];
    }
  }, [getHeaders]);

  // Admin: Buscar pagamentos recentes
  const getRecentPayments = useCallback(async (limit: number = 20) => {
    try {
      const response = await fetch(`${API_URL}/dashboard/admin/recent-payments?limit=${limit}`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar pagamentos');
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      console.error('Erro ao buscar pagamentos:', err);
      return [];
    }
  }, [getHeaders]);

  return {
    loading,
    error,
    getCompanyMetrics,
    getSalesChart,
    getOrdersByStatus,
    getAdminOverview,
    getExpiringSubscriptions,
    getRecentPayments
  };
};

