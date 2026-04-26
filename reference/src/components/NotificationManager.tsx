import { useEffect } from 'react';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { from } from '@/integrations/db/client';

interface NotificationManagerProps {
  children: React.ReactNode;
}

export function NotificationManager({ children }: NotificationManagerProps) {
  const { 
    sendJobCandidateNotification,
    sendDiscTestCompletedNotification,
    getUserPhoneByName 
  } = useWhatsApp();

  useEffect(() => {
    // Real-time notifications desabilitadas (Supabase removido)
    // TODO: Implementar real-time via PostgreSQL quando necessário
    
    // 🚫 DESABILITADO - Não buscar settings do Supabase
    // TODO: Implementar busca de settings via API PostgreSQL se necessário
    // const checkSettings = async () => {
    //   try {
    //     const { data: settings } = await from('kv_store_2c4defad')
    //       .select('value')
    //       .eq('key', 'integration_settings')
    //       .single()
    //       .execute();
    //     console.log('NotificationManager: Current integration settings:', settings?.value);
    //   } catch (error) {
    //     console.error('NotificationManager: Error fetching settings:', error);
    //   }
    // };
    
    // 🚫 DESABILITAR TODAS AS SUBSCRIPTIONS - Supabase removido
    // Real-time não está disponível no PostgreSQL ainda
    return () => {
      // Cleanup silencioso
    };
    
    // 🚫 TODAS AS SUBSCRIPTIONS DESABILITADAS - Supabase removido
    // Real-time não está disponível no PostgreSQL ainda
    // TODO: Implementar polling ou WebSockets quando necessário
  }, [sendJobCandidateNotification, sendDiscTestCompletedNotification, getUserPhoneByName]);

  return <>{children}</>;
}