import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';

export interface ApiToken {
  id: string;
  nome: string;
  descricao?: string;
  token: string;
  permissoes: string[];
  ativo: boolean;
  expires_at?: string;
  ultimo_uso?: string;
  uso_count: number;
  created_at: string;
  updated_at?: string;
}

export interface ApiAccessLog {
  id: string;
  token_id: string;
  endpoint: string;
  method: string;
  ip_address: string;
  user_agent: string;
  query_params: Record<string, any>;
  response_status?: number;
  response_body?: string;
  created_at: string;
}

export interface CreateTokenData {
  nome: string;
  descricao?: string;
  permissoes?: string[];
  expires_at?: string;
}

export function useApiTokens() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Listar tokens
  const { data: tokensData, isLoading, refetch } = useQuery({
    queryKey: ['api-tokens'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: ApiToken[] }>('/api-tokens');
      if (response.error) {
        throw new Error(response.error);
      }
      // Garantir que sempre retornamos um array
      const data = response.data?.data;
      return Array.isArray(data) ? data : [];
    },
  });

  // Garantir que tokens seja sempre um array
  const tokens = Array.isArray(tokensData) ? tokensData : [];

  // Criar token
  const createMutation = useMutation({
    mutationFn: async (data: CreateTokenData) => {
      const response = await apiClient.post<{ success: boolean; data: ApiToken }>('/api-tokens', data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
      toast({ title: 'Token criado com sucesso!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao criar token', description: error.message, variant: 'destructive' });
    },
  });

  // Atualizar token
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ApiToken> }) => {
      const response = await apiClient.put<{ success: boolean; data: ApiToken }>(`/api-tokens/${id}`, data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
      toast({ title: 'Token atualizado!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao atualizar token', description: error.message, variant: 'destructive' });
    },
  });

  // Excluir token
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/api-tokens/${id}`);
      if (response.error) {
        throw new Error(response.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
      toast({ title: 'Token excluído!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao excluir token', description: error.message, variant: 'destructive' });
    },
  });

  // Buscar logs de um token
  const fetchLogs = useCallback(async (tokenId: string): Promise<ApiAccessLog[]> => {
    try {
      const response = await apiClient.get<{ success: boolean; data: ApiAccessLog[] }>(`/api-tokens/${tokenId}/logs`);
      if (response.error) {
        throw new Error(response.error);
      }
      const data = response.data?.data;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      return [];
    }
  }, []);

  return {
    tokens,
    isLoading,
    refetch,
    createToken: createMutation.mutateAsync,
    updateToken: updateMutation.mutateAsync,
    deleteToken: deleteMutation.mutateAsync,
    fetchLogs,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Permissões disponíveis
export const API_PERMISSIONS = [
  { value: 'produtos:read', label: 'Ler Produtos', description: 'Permite buscar e listar produtos' },
  { value: 'produtos:write', label: 'Editar Produtos', description: 'Permite criar e editar produtos' },
  { value: 'marcas:read', label: 'Ler Marcas', description: 'Permite listar marcas' },
  { value: 'modelos:read', label: 'Ler Modelos', description: 'Permite listar modelos' },
  { value: 'clientes:read', label: 'Ler Clientes', description: 'Permite buscar clientes' },
  { value: 'os:read', label: 'Ler OS', description: 'Permite consultar ordens de serviço' },
];

