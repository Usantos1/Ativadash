import { useState, useEffect, useCallback } from 'react';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';

interface SystemSettings {
  os_numero_inicial: number;
}

const DEFAULT_SETTINGS: SystemSettings = {
  os_numero_inicial: 1,
};

export function useSystemSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Buscar configurações do banco
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await from('kv_store_2c4defad')
        .select('value')
        .eq('key', 'system_settings')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[useSystemSettings] Erro ao buscar:', error);
        return;
      }

      if (data?.value) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.value });
      }
    } catch (err) {
      console.error('[useSystemSettings] Erro:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Salvar configurações
  const saveSettings = useCallback(async (newSettings: Partial<SystemSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    
    try {
      const { error } = await from('kv_store_2c4defad')
        .upsert({
          key: 'system_settings',
          value: updatedSettings,
        }, { onConflict: 'key' });

      if (error) throw error;
      
      setSettings(updatedSettings);
      return true;
    } catch (err) {
      console.error('[useSystemSettings] Erro ao salvar:', err);
      throw err;
    }
  }, [settings]);

  // Buscar próximo número de OS considerando o número inicial configurado
  const getProximoNumeroOS = useCallback(async (): Promise<number> => {
    try {
      // Buscar a maior OS existente no banco
      const { data: lastOS } = await from('ordens_servico')
        .select('numero')
        .order('numero', { ascending: false })
        .limit(1)
        .single();

      const maiorNumeroExistente = lastOS?.numero || 0;
      const numeroInicial = settings.os_numero_inicial || 1;

      // O próximo número é o maior entre (maior existente + 1) e o número inicial
      return Math.max(maiorNumeroExistente + 1, numeroInicial);
    } catch (err) {
      console.error('[useSystemSettings] Erro ao buscar próximo número:', err);
      return settings.os_numero_inicial || 1;
    }
  }, [settings.os_numero_inicial]);

  return {
    settings,
    loading,
    saveSettings,
    getProximoNumeroOS,
    refetch: fetchSettings,
  };
}

