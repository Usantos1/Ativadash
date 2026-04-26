import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/integrations/db/client';
import { useToast } from '@/hooks/use-toast';

// =====================================================
// TIPOS
// =====================================================

export interface WebhookConfig {
  id: string;
  nome: string;
  webhook_key: string;
  fonte_padrao: string;
  descricao?: string;
  is_active: boolean;
  leads_recebidos: number;
  ultimo_lead_em?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  tipo: 'lead_recebido' | 'erro' | 'teste';
  payload?: any;
  lead_id?: string;
  erro?: string;
  ip_origem?: string;
  created_at: string;
}

// =====================================================
// HOOK: useWebhooks
// =====================================================

export function useWebhooks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Buscar webhooks configurados
  const { data: webhooks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['webhook-configs'],
    queryFn: async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'https://api.ativafix.com';
        const response = await fetch(`${apiUrl}/api/webhook/configs`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });
        if (!response.ok) {
          console.warn('[useWebhooks] Endpoint não disponível:', response.status);
          return [];
        }
        const text = await response.text();
        if (!text) return [];
        const result = JSON.parse(text);
        if (!result.success) throw new Error(result.error);
        return result.data as WebhookConfig[];
      } catch (err) {
        console.warn('[useWebhooks] Erro ao buscar webhooks:', err);
        return [];
      }
    },
  });

  // Criar webhook
  const createWebhook = useMutation({
    mutationFn: async (data: { nome: string; fonte_padrao?: string; descricao?: string }) => {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://api.ativafix.com';
      const response = await fetch(`${apiUrl}/api/webhook/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: Servidor não disponível`);
      }
      const text = await response.text();
      if (!text) throw new Error('Resposta vazia do servidor');
      const result = JSON.parse(text);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs'] });
      toast({ title: 'Webhook criado com sucesso!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao criar webhook', description: error.message, variant: 'destructive' });
    },
  });

  // Atualizar webhook
  const updateWebhook = useMutation({
    mutationFn: async ({ id, ...data }: Partial<WebhookConfig> & { id: string }) => {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://api.ativafix.com';
      const response = await fetch(`${apiUrl}/api/webhook/configs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs'] });
      toast({ title: 'Webhook atualizado!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao atualizar webhook', description: error.message, variant: 'destructive' });
    },
  });

  // Excluir webhook
  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://api.ativafix.com';
      const response = await fetch(`${apiUrl}/api/webhook/configs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-configs'] });
      toast({ title: 'Webhook excluído!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao excluir webhook', description: error.message, variant: 'destructive' });
    },
  });

  // Gerar URL do webhook
  const getWebhookUrl = (webhookKey: string) => {
    const baseUrl = import.meta.env.VITE_API_URL || 'https://api.ativafix.com';
    return `${baseUrl}/api/webhook/leads/${webhookKey}`;
  };

  return {
    webhooks,
    isLoading,
    error,
    refetch,
    createWebhook: createWebhook.mutateAsync,
    updateWebhook: updateWebhook.mutateAsync,
    deleteWebhook: deleteWebhook.mutateAsync,
    isCreating: createWebhook.isPending,
    isUpdating: updateWebhook.isPending,
    isDeleting: deleteWebhook.isPending,
    getWebhookUrl,
  };
}

// =====================================================
// HOOK: useWebhookLogs
// =====================================================

export function useWebhookLogs(webhookId: string | null) {
  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['webhook-logs', webhookId],
    queryFn: async () => {
      if (!webhookId) return [];
      const apiUrl = import.meta.env.VITE_API_URL || 'https://api.ativafix.com';
      const response = await fetch(`${apiUrl}/api/webhook/logs/${webhookId}?limit=100`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data as WebhookLog[];
    },
    enabled: !!webhookId,
  });

  return { logs, isLoading, refetch };
}

