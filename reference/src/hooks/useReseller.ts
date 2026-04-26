import { useState, useEffect } from 'react';
import { authAPI } from '@/integrations/auth/api-client';

// URL base da API
const API_URL = (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost')) 
  ? import.meta.env.VITE_API_URL 
  : 'https://api.ativafix.com/api';

export interface Company {
  id: string;
  name: string;
  cnpj?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  status: 'active' | 'suspended' | 'cancelled' | 'trial';
  trial_ends_at?: string;
  settings?: any;
  logo_url?: string;
  created_at: string;
  updated_at: string;
  subscription_status?: string;
  subscription_expires_at?: string;
  plan_name?: string;
  plan_code?: string;
  user_count?: number;
  segmento_id?: string | null;
  segmento_nome?: string;
  segmento_slug?: string;
}

export interface Plan {
  id: string;
  name: string;
  code: string;
  description?: string;
  price_monthly: number;
  price_yearly?: number;
  max_users: number;
  max_storage_gb: number;
  max_orders_per_month: number;
  features: any;
  active: boolean;
}

export interface Subscription {
  id: string;
  company_id: string;
  plan_id: string;
  billing_cycle: 'monthly' | 'yearly';
  started_at: string;
  expires_at: string;
  cancelled_at?: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending_payment';
  amount: number;
  currency: string;
}

export interface Payment {
  id: string;
  company_id: string;
  subscription_id?: string;
  amount: number;
  currency: string;
  payment_method: string;
  pix_code?: string;
  pix_qr_code?: string;
  pix_expires_at?: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded';
  paid_at?: string;
  external_id?: string;
  created_at: string;
}

const API_BASE = `${API_URL}/admin/revenda`;

export const useReseller = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = () => {
    const token = authAPI.getToken();
    console.log('[useReseller] Token obtido:', token ? `${token.substring(0, 20)}...` : 'NÃO ENCONTRADO');
    if (!token) {
      console.warn('[useReseller] ⚠️ Token não encontrado no localStorage!');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Listar empresas
  const listCompanies = async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.status) queryParams.append('status', params.status);

      const response = await fetch(`${API_BASE}/companies?${queryParams}`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          const errorMessage = errorData.error || `Erro ${response.status}: ${response.statusText}`;
          if (response.status === 403) {
            const enhancedError = new Error(errorMessage);
            (enhancedError as any).is403 = true;
            throw enhancedError;
          }
          throw new Error(errorMessage);
        } else {
          const errorText = await response.text();
          const errorMessage = `Erro ${response.status}: ${response.statusText}`;
          if (response.status === 403) {
            const enhancedError = new Error(errorMessage);
            (enhancedError as any).is403 = true;
            throw enhancedError;
          }
          throw new Error(errorMessage);
        }
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Obter empresa específica
  const getCompany = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/companies/${id}`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao obter empresa');
        } else {
          const text = await response.text();
          throw new Error(`Erro ${response.status}: ${text.substring(0, 100)}`);
        }
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Criar empresa
  const createCompany = async (companyData: Partial<Company> & { plan_id?: string; billing_cycle?: 'monthly' | 'yearly' }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/companies`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(companyData)
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao criar empresa');
        } else {
          const text = await response.text();
          throw new Error(`Erro ${response.status}: ${text.substring(0, 100)}`);
        }
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Atualizar empresa
  const updateCompany = async (id: string, updates: Partial<Company>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/companies/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao atualizar empresa');
        } else {
          const text = await response.text();
          throw new Error(`Erro ${response.status}: ${text.substring(0, 100)}`);
        }
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Listar planos
  const listPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = getHeaders();
      console.log('[useReseller] Buscando planos em:', `${API_BASE}/plans`);
      console.log('[useReseller] Headers:', { ...headers, Authorization: headers.Authorization ? 'Bearer ***' : 'NÃO DEFINIDO' });
      
      const response = await fetch(`${API_BASE}/plans`, {
        headers
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao listar planos');
        } else {
          const text = await response.text();
          throw new Error(`Erro ${response.status}: ${text.substring(0, 100)}`);
        }
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Criar/atualizar assinatura
  const createSubscription = async (companyId: string, planId: string, billingCycle: 'monthly' | 'yearly' = 'monthly') => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/subscription`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          plan_id: planId,
          billing_cycle: billingCycle
        })
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao criar assinatura');
        } else {
          const text = await response.text();
          throw new Error(`Erro ${response.status}: ${text.substring(0, 100)}`);
        }
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Listar pagamentos de uma empresa
  const listPayments = async (companyId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/payments`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao listar pagamentos');
        } else {
          const text = await response.text();
          throw new Error(`Erro ${response.status}: ${text.substring(0, 100)}`);
        }
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Criar plano
  const createPlan = async (planData: Partial<Plan>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/plans`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(planData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar plano');
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Atualizar plano
  const updatePlan = async (id: string, planData: Partial<Plan>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/plans/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(planData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar plano');
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Deletar plano
  const deletePlan = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/plans/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao deletar plano');
      }

      return true;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Listar usuários de uma empresa
  const listCompanyUsers = async (companyId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/users`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao listar usuários');
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Criar usuário para uma empresa
  const createCompanyUser = async (companyId: string, userData: {
    email: string;
    password: string;
    display_name?: string;
    role?: string;
    phone?: string;
    department_id?: string;
    position_id?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar usuário');
      }

      const data = await response.json();
      return data.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Resetar senha de usuário
  const resetUserPassword = async (companyId: string, userId: string, newPassword: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/users/${userId}/reset-password`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ new_password: newPassword })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao resetar senha');
      }

      return true;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Toggle ativo/inativo usuário
  const toggleUserActive = async (companyId: string, userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/users/${userId}/toggle-active`, {
        method: 'PUT',
        headers: getHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao alterar status do usuário');
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    listCompanies,
    getCompany,
    createCompany,
    updateCompany,
    listPlans,
    createPlan,
    updatePlan,
    deletePlan,
    createSubscription,
    listPayments,
    listCompanyUsers,
    createCompanyUser,
    resetUserPassword,
    toggleUserActive
  };
};

