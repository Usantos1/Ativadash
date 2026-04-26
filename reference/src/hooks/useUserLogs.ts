import { useState, useEffect } from 'react';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  description: string;
  entity_type?: string;
  entity_id?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  user_name?: string;
}

export const useUserLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<UserActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await from('user_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
        .execute();

      if (error) {
        console.error('Error fetching logs:', error);
        return;
      }

      const formattedLogs: UserActivityLog[] = (data || []).map(log => ({
        ...log,
        user_name: 'Usuário'
      }));

      setLogs(formattedLogs);
    } catch (error) {
      console.error('Error in fetchLogs:', error);
    } finally {
      setLoading(false);
    }
  };

  const logActivity = async (
    activityType: string,
    description: string,
    entityType?: string,
    entityId?: string,
    additionalData?: Record<string, any>
  ) => {
    if (!user) return;

    try {
      // Get current IP and user agent
      const ipAddress = await getCurrentIP();
      const userAgent = navigator.userAgent;
      
      // 🚫 Supabase RPC removido - TODO: implementar na API quando necessário
      // await supabase.rpc('log_user_activity', { ... });

      // Log to user_activity_logs table
      await from('user_activity_logs')
        .insert({
          user_id: user.id,
          activity_type: activityType,
          description: additionalData 
            ? `${description} - Dados: ${JSON.stringify(additionalData)}`
            : description,
          entity_type: entityType,
          entity_id: entityId,
          ip_address: ipAddress,
          user_agent: userAgent
        })
        .execute();
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const getCurrentIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'Não disponível';
    } catch (error) {
      return 'Não disponível';
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user]);

  return {
    logs,
    loading,
    logActivity,
    refetch: fetchLogs
  };
};