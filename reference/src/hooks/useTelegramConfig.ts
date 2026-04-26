import { useCallback } from 'react';
import { from } from '@/integrations/db/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

interface TelegramConfig {
  id: string;
  key: string;
  value: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

const CONFIG_KEYS = {
  CHAT_ID_ENTRADA: 'chat_id_entrada',
  CHAT_ID_PROCESSO: 'chat_id_processo',
  CHAT_ID_SAIDA: 'chat_id_saida',
} as const;

export function useTelegramConfig() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Buscar configurações da empresa do usuário (cada empresa tem seus próprios Chat IDs)
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['telegram_config', user?.company_id],
    queryFn: async () => {
      let q = from('telegram_config').select('*');
      if (user?.company_id) q = q.eq('company_id', user.company_id);
      const { data, error } = await q.execute();
      if (error) throw error;
      return (data || []) as TelegramConfig[];
    },
  });

  // Função auxiliar para buscar um valor específico
  const getConfigValue = useCallback(
    (key: string): string => {
      const config = configs.find((c) => c.key === key);
      return config?.value || '';
    },
    [configs]
  );

  // Valores específicos
  const chatIdEntrada = getConfigValue(CONFIG_KEYS.CHAT_ID_ENTRADA);
  const chatIdProcesso = getConfigValue(CONFIG_KEYS.CHAT_ID_PROCESSO);
  const chatIdSaida = getConfigValue(CONFIG_KEYS.CHAT_ID_SAIDA);

  // Mutation para atualizar configuração (sempre no contexto da empresa do usuário)
  const updateConfig = useMutation({
    mutationFn: async ({
      key,
      value,
    }: {
      key: string;
      value: string;
    }): Promise<TelegramConfig> => {
      const existing = configs.find((c) => c.key === key);

      if (existing) {
        let updateQ = from('telegram_config')
          .eq('key', key)
          .update({ value: value.trim(), updated_at: new Date().toISOString() });
        if (user?.company_id) updateQ = updateQ.eq('company_id', user.company_id);
        const result = await updateQ as any;
        if (result.error) throw result.error;
        return {
          ...existing,
          value: value.trim(),
          updated_at: new Date().toISOString(),
        } as TelegramConfig;
      } else {
        const payload: Record<string, unknown> = { key, value: value.trim() };
        if (user?.company_id) payload.company_id = user.company_id;
        const result = await from('telegram_config').insert(payload);
        if (result.error) throw result.error;
        return {
          id: (result as any).data?.id || '',
          key,
          value: value.trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as TelegramConfig;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram_config', user?.company_id] });
    },
  });

  // Funções específicas para atualizar cada chat ID
  const updateChatIdEntrada = useCallback(
    async (value: string) => {
      return updateConfig.mutateAsync({
        key: CONFIG_KEYS.CHAT_ID_ENTRADA,
        value,
      });
    },
    [updateConfig]
  );

  const updateChatIdProcesso = useCallback(
    async (value: string) => {
      return updateConfig.mutateAsync({
        key: CONFIG_KEYS.CHAT_ID_PROCESSO,
        value,
      });
    },
    [updateConfig]
  );

  const updateChatIdSaida = useCallback(
    async (value: string) => {
      return updateConfig.mutateAsync({
        key: CONFIG_KEYS.CHAT_ID_SAIDA,
        value,
      });
    },
    [updateConfig]
  );

  return {
    configs,
    isLoading,
    chatIdEntrada,
    chatIdProcesso,
    chatIdSaida,
    updateConfig: updateConfig.mutateAsync,
    updateChatIdEntrada,
    updateChatIdProcesso,
    updateChatIdSaida,
    isUpdating: updateConfig.isPending,
  };
}

