import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const apiUrl = import.meta.env.VITE_API_URL || 'https://api.ativafix.com';

export interface LeadMessage {
  id: string;
  lead_id: string;
  direction: 'inbound' | 'outbound';
  message_type: 'text' | 'image' | 'audio' | 'video' | 'document';
  body: string;
  media_url?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  external_id?: string;
  sender_name?: string;
  sender_number?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  nome: string;
  telefone: string;
  whatsapp: string;
  email?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  last_direction?: 'inbound' | 'outbound';
}

export interface AtivaCRMConfig {
  id: string;
  is_active: boolean;
  created_at: string;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// Hook para configuração do AtivaCRM
export function useAtivaCRMConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['ativacrm-config'],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/api/ativacrm/config`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      return data;
    }
  });

  const saveConfig = useMutation({
    mutationFn: async (data: { api_token: string; webhook_secret?: string }) => {
      const response = await fetch(`${apiUrl}/api/ativacrm/config`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ativacrm-config'] });
      toast({ title: 'Configuração salva!', description: 'Token do AtivaCRM configurado com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao salvar configuração', variant: 'destructive' });
    }
  });

  return {
    config: config?.data as AtivaCRMConfig | null,
    hasConfig: config?.hasConfig || false,
    isLoading,
    saveConfig
  };
}

// Hook para mensagens de um lead específico
export function useLeadMessages(leadId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['lead-messages', leadId],
    queryFn: async () => {
      if (!leadId) return { data: [], total: 0 };
      
      const response = await fetch(`${apiUrl}/api/leads/${leadId}/messages`, {
        headers: getAuthHeaders()
      });
      return response.json();
    },
    enabled: !!leadId,
    refetchInterval: 5000 // Atualizar a cada 5 segundos
  });

  const sendMessage = useMutation({
    mutationFn: async ({ body, media_url }: { body: string; media_url?: string }) => {
      if (!leadId) throw new Error('Lead não selecionado');
      
      const response = await fetch(`${apiUrl}/api/leads/${leadId}/messages/send`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ body, media_url })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar mensagem');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-messages', leadId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao enviar', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  });

  const markAsRead = useMutation({
    mutationFn: async () => {
      if (!leadId) return;
      
      await fetch(`${apiUrl}/api/leads/${leadId}/messages/read`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await fetch(`${apiUrl}/api/leads/${leadId}/messages/${messageId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Erro ao apagar mensagem');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-messages', leadId] });
      toast({ title: 'Mensagem apagada' });
    },
    onError: () => {
      toast({ title: 'Erro ao apagar', variant: 'destructive' });
    }
  });

  const deleteAllMessages = useMutation({
    mutationFn: async () => {
      if (!leadId) return;
      
      const response = await fetch(`${apiUrl}/api/leads/${leadId}/messages`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Erro ao apagar conversa');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-messages', leadId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast({ title: 'Conversa apagada' });
    },
    onError: () => {
      toast({ title: 'Erro ao apagar conversa', variant: 'destructive' });
    }
  });

  return {
    messages: (data?.data || []) as LeadMessage[],
    total: data?.total || 0,
    isLoading,
    refetch,
    sendMessage,
    markAsRead,
    deleteMessage,
    deleteAllMessages,
    isSending: sendMessage.isPending
  };
}

// Hook para lista de conversas
export function useConversations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/api/leads/conversations`, {
        headers: getAuthHeaders()
      });
      return response.json();
    },
    refetchInterval: 10000 // Atualizar a cada 10 segundos
  });

  const updateLeadStatus = useMutation({
    mutationFn: async ({ leadId, status, temperatura }: { leadId: string; status?: string; temperatura?: string }) => {
      const response = await fetch(`${apiUrl}/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, temperatura })
      });
      
      if (!response.ok) {
        throw new Error('Erro ao atualizar status');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Status atualizado!' });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  });

  return {
    conversations: (data?.data || []) as Conversation[],
    isLoading,
    refetch,
    updateLeadStatus
  };
}

