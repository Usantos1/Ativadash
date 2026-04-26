import { useState, useEffect } from 'react';
import { from } from '@/integrations/db/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useUserLogs } from '@/hooks/useUserLogs';

export interface TimeClockRecord {
  id: string;
  user_id: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  break_start?: string;
  break_end?: string;
  lunch_start?: string;
  lunch_end?: string;
  total_hours?: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  location?: string;
  ip_address?: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

export const useTimeClock = () => {
  const { user } = useAuth();
  const { logActivity } = useUserLogs();
  const [records, setRecords] = useState<TimeClockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayRecord, setTodayRecord] = useState<TimeClockRecord | null>(null);

  const fetchRecords = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await from('time_clock')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(30)
        .execute();

      if (error) {
        console.error('Error fetching time records:', error);
        return;
      }

      const formattedRecords: TimeClockRecord[] = (data || []).map(record => {
        // Converter location para string se for objeto
        let locationString: string | null = null;
        if (record.location) {
          if (typeof record.location === 'string') {
            locationString = record.location;
          } else if (typeof record.location === 'object') {
            // Se for objeto com latitude e longitude
            if ('latitude' in record.location && 'longitude' in record.location) {
              locationString = `${record.location.latitude}, ${record.location.longitude}`;
            } else {
              // Tentar converter para string
              locationString = JSON.stringify(record.location);
            }
          } else {
            locationString = String(record.location);
          }
        }
        
        return {
          id: record.id,
          user_id: record.user_id,
          date: record.date,
          clock_in: record.clock_in || null,
          clock_out: record.clock_out || null,
          break_start: record.break_start || null,
          break_end: record.break_end || null,
          lunch_start: record.lunch_start || null,
          lunch_end: record.lunch_end || null,
          total_hours: (() => {
            const total = record.total_hours;
            if (typeof total === 'string') return total;
            if (typeof total === 'number') return String(total);
            if (typeof total === 'object' && total !== null) {
              // Se for objeto, tentar converter para string formatada
              if ('hours' in total && 'minutes' in total) {
                return `${total.hours}:${String(total.minutes).padStart(2, '0')}:00`;
              }
              // Se não conseguir converter, retornar null
              return null;
            }
            return total ? String(total) : null;
          })(),
          status: (record.status || 'pending') as 'pending' | 'approved' | 'rejected',
          notes: typeof record.notes === 'string' ? record.notes : (record.notes ? String(record.notes) : null),
          location: locationString,
          ip_address: typeof record.ip_address === 'string' ? record.ip_address : (record.ip_address ? String(record.ip_address) : null),
          created_at: record.created_at,
          updated_at: record.updated_at,
          user_name: 'Usuário'
        };
      });

      setRecords(formattedRecords);

      // Get today's record - comparar apenas a parte da data (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0];
      const todaysRecord = formattedRecords.find(r => {
        // Normalizar a data do registro para comparação
        const recordDate = r.date ? r.date.split('T')[0] : '';
        return recordDate === today && r.user_id === user.id;
      });
      
      console.log('[TimeClock] Today:', today, 'Records:', formattedRecords.length, 'TodayRecord:', todaysRecord);
      setTodayRecord(todaysRecord || null);
    } catch (error) {
      console.error('Error in fetchRecords:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAddressFromIP = async (ip: string): Promise<string> => {
    if (!ip || ip === 'Não disponível') return 'Localização não disponível';
    
    try {
      // Tentar buscar localização pelo IP usando ipapi.co (gratuito)
      const response = await fetch(`https://ipapi.co/${ip}/json/`, {
        signal: AbortSignal.timeout(3000)
      });
      
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      
      if (data.error) throw new Error(data.reason || 'IP lookup failed');
      
      // Construir endereço completo a partir dos dados
      const parts = [];
      if (data.road) parts.push(data.road);
      if (data.house_number) parts.push(data.house_number);
      if (data.neighbourhood || data.suburb) parts.push(data.neighbourhood || data.suburb);
      if (data.city) parts.push(data.city);
      if (data.region) parts.push(data.region);
      if (data.postal) parts.push(`CEP: ${data.postal}`);
      if (data.country_name) parts.push(data.country_name);
      
      if (parts.length > 0) {
        return parts.join(', ');
      }
      
      // Fallback: usar coordenadas se disponíveis
      if (data.latitude && data.longitude) {
        return `${data.latitude}, ${data.longitude}`;
      }
      
      return 'Localização não disponível';
    } catch (error) {
      console.warn('Error getting address from IP:', error);
      return 'Localização não disponível';
    }
  };

  const getLocation = async (): Promise<{location: string, ip: string}> => {
    try {
      // Buscar IP primeiro
      const ipAddress = await Promise.race([
        fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) })
          .then(res => res.json())
          .then(data => data.ip || 'Não disponível')
          .catch(() => 'Não disponível'),
        new Promise<string>(resolve => setTimeout(() => resolve('Não disponível'), 3000))
      ]);

      // Buscar geolocalização em paralelo
      const geoPromise = new Promise<{location: string}>((resolve) => {
        if (!navigator.geolocation) {
          resolve({ location: 'Não suportado' });
          return;
        }

        // Timeout aumentado para permitir GPS de alta precisão
        const timeoutId = setTimeout(() => {
          console.warn('[TimeClock] GPS timeout após 10s');
          resolve({ location: 'Timeout' });
        }, 10000); // 10 segundos para GPS de alta precisão

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy; // Precisão em metros
            
            console.log('[TimeClock] GPS obtido:', { 
              lat, 
              lng, 
              accuracy: `${accuracy}m`,
              highAccuracy: accuracy < 50 ? 'SIM (GPS)' : 'NÃO (Rede)'
            });
            
            // Usar coordenadas com mais casas decimais para maior precisão
            const location = `${lat.toFixed(7)}, ${lng.toFixed(7)}`;
            resolve({ location });
          },
          (error) => {
            clearTimeout(timeoutId);
            console.warn('[TimeClock] Erro GPS:', error.code, error.message);
            
            // Códigos de erro do Geolocation API
            // 1 = PERMISSION_DENIED
            // 2 = POSITION_UNAVAILABLE
            // 3 = TIMEOUT
            if (error.code === 1) {
              resolve({ location: 'Permissão negada' });
            } else if (error.code === 2) {
              resolve({ location: 'Indisponível' });
            } else {
              resolve({ location: 'Timeout' });
            }
          },
          { 
            enableHighAccuracy: true, // Ativar GPS de alta precisão
            timeout: 10000, // 10 segundos para GPS
            maximumAge: 0 // Sempre buscar nova localização (não usar cache)
          }
        );
      });

      // Aguardar geolocalização
      const geoResult = await geoPromise;
      
      // Se geolocalização falhou ou não retornou coordenadas, buscar pelo IP
      if (geoResult.location === 'Permissão negada' || 
          geoResult.location === 'Timeout' || 
          geoResult.location === 'Não suportado' ||
          !geoResult.location.includes(',')) {
        
        // Buscar endereço pelo IP em background (não bloquear)
        getAddressFromIP(ipAddress).then(address => {
          // Atualizar o registro com o endereço do IP se necessário
          // Isso será feito em background, não bloqueia o registro
        }).catch(() => {});
        
        // Retornar IP como fallback para busca posterior
        return { 
          location: ipAddress, // Usar IP como identificador temporário
          ip: ipAddress 
        };
      }
      
      return { 
        location: geoResult.location, 
        ip: ipAddress 
      };
    } catch (error) {
      console.error('Error in getLocation:', error);
      return { location: 'Erro', ip: 'Não disponível' };
    }
  };

  const clockIn = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      // Verificar registro existente e buscar localização em paralelo
      const [existingRecord, locationData] = await Promise.all([
        from('time_clock')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .single(),
        getLocation().catch(() => ({ location: 'Erro', ip: 'Não disponível' }))
      ]);

      if (existingRecord.data?.clock_in) {
        const existingTime = new Date(existingRecord.data.clock_in);
        const currentTime = new Date(now);
        const timeDiff = Math.abs(currentTime.getTime() - existingTime.getTime());
        
        if (timeDiff < 60000) { // Less than 1 minute
          toast({
            title: "Aviso",
            description: "Você já registrou entrada recentemente",
            variant: "destructive"
          });
          return;
        }
      }

      let { location, ip } = locationData;

      // Se geolocalização falhou, tentar buscar endereço pelo IP antes de salvar
      if ((!location || location === 'Permissão negada' || location === 'Timeout' || location === 'Não suportado' || !location.includes(',')) && ip && ip !== 'Não disponível') {
        // Tentar buscar endereço pelo IP rapidamente (timeout de 2s)
        try {
          const addressFromIP = await Promise.race([
            getAddressFromIP(ip),
            new Promise<string>(resolve => setTimeout(() => resolve(ip), 2000))
          ]);
          if (addressFromIP && addressFromIP !== 'Localização não disponível' && addressFromIP !== ip) {
            location = addressFromIP;
          } else {
            location = ip; // Usar IP como fallback
          }
        } catch {
          location = ip; // Usar IP como fallback
        }
      }

      let data, error;
      if (existingRecord.data?.id) {
        // Update existing record
        const result = await from('time_clock')
          .eq('id', existingRecord.data.id)
          .update({
            clock_in: now,
            location: location || ip,
            ip_address: ip
          })
          .execute();
        data = existingRecord.data;
        error = result.error;
      } else {
        // Insert new record
        const result = await from('time_clock')
          .insert({
            user_id: user.id,
            date: today,
            clock_in: now,
            location: location || ip,
            ip_address: ip,
            status: 'pending'
          })
          .select('*')
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) {
        toast({
          title: "Erro",
          description: "Erro ao registrar entrada",
          variant: "destructive"
        });
        return;
      }

      // Se ainda não temos endereço completo, tentar buscar em background e atualizar
      if (data?.id && location && (!location.includes(',') || location === ip) && ip && ip !== 'Não disponível') {
        getAddressFromIP(ip).then(address => {
          if (address && address !== 'Localização não disponível' && address !== ip) {
            from('time_clock')
              .eq('id', data.id)
              .update({ location: address })
              .execute()
              .then(() => fetchRecords())
              .catch(() => {});
          }
        }).catch(() => {});
      }

      // Mostrar sucesso imediatamente
      toast({
        title: "Entrada registrada",
        description: "Horário de entrada registrado com sucesso"
      });

      // Atualizar registros e log em background (não bloquear)
      Promise.all([
        fetchRecords(),
        logActivity('time_clock', 'Registro de entrada', 'time_clock', data?.id || '').catch(() => {})
      ]).catch(() => {});
    } catch (error) {
      console.error('Error clocking in:', error);
    }
  };

  const clockOut = async () => {
    if (!user || !todayRecord) return;

    try {
      const now = new Date().toISOString();
      
      // Calculate total hours
      const clockInTime = new Date(todayRecord.clock_in!);
      const clockOutTime = new Date(now);
      const totalMs = clockOutTime.getTime() - clockInTime.getTime();
      const totalHours = Math.floor(totalMs / (1000 * 60 * 60));
      const totalMinutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
      const totalHoursFormatted = `${totalHours}:${totalMinutes.toString().padStart(2, '0')}:00`;

      const { error } = await from('time_clock')
        .eq('id', todayRecord.id)
        .update({
          clock_out: now,
          total_hours: totalHoursFormatted
        })
        .execute();

      if (error) {
        toast({
          title: "Erro",
          description: "Erro ao registrar saída",
          variant: "destructive"
        });
        return;
      }

      // Log activity
      await logActivity('time_clock', 'Registro de saída', 'time_clock', todayRecord.id);

      toast({
        title: "Saída registrada",
        description: "Horário de saída registrado com sucesso"
      });

      fetchRecords();
    } catch (error) {
      console.error('Error clocking out:', error);
    }
  };

  const startBreak = async () => {
    if (!user || !todayRecord) return;

    try {
      const now = new Date().toISOString();

      const { error } = await from('time_clock')
        .eq('id', todayRecord.id)
        .update({
          break_start: now
        })
        .execute();

      if (error) {
        toast({
          title: "Erro",
          description: "Erro ao iniciar pausa",
          variant: "destructive"
        });
        return;
      }

      // Log activity
      await logActivity('time_clock', 'Início de pausa', 'time_clock', todayRecord.id);

      toast({
        title: "Pausa iniciada",
        description: "Horário de pausa registrado"
      });

      fetchRecords();
    } catch (error) {
      console.error('Error starting break:', error);
    }
  };

  const endBreak = async () => {
    if (!user || !todayRecord) return;

    try {
      const now = new Date().toISOString();

      const { error } = await from('time_clock')
        .eq('id', todayRecord.id)
        .update({
          break_end: now
        })
        .execute();

      if (error) {
        toast({
          title: "Erro",
          description: "Erro ao finalizar pausa",
          variant: "destructive"
        });
        return;
      }

      // Log activity
      await logActivity('time_clock', 'Fim de pausa', 'time_clock', todayRecord.id);

      toast({
        title: "Pausa finalizada",
        description: "Retorno da pausa registrado"
      });

      fetchRecords();
    } catch (error) {
      console.error('Error ending break:', error);
    }
  };

  const startLunch = async () => {
    if (!user || !todayRecord) return;

    try {
      const now = new Date().toISOString();

      const { error } = await from('time_clock')
        .eq('id', todayRecord.id)
        .update({
          lunch_start: now
        })
        .execute();

      if (error) {
        toast({
          title: "Erro",
          description: "Erro ao iniciar almoço",
          variant: "destructive"
        });
        return;
      }

      // Log activity
      await logActivity('time_clock', 'Início de almoço', 'time_clock', todayRecord.id);

      toast({
        title: "Almoço iniciado",
        description: "Saída para almoço registrada"
      });

      fetchRecords();
    } catch (error) {
      console.error('Error starting lunch:', error);
    }
  };

  const endLunch = async () => {
    if (!user || !todayRecord) return;

    try {
      const now = new Date().toISOString();

      const { error } = await from('time_clock')
        .eq('id', todayRecord.id)
        .update({
          lunch_end: now
        })
        .execute();

      if (error) {
        toast({
          title: "Erro",
          description: "Erro ao finalizar almoço",
          variant: "destructive"
        });
        return;
      }

      // Log activity
      await logActivity('time_clock', 'Fim de almoço', 'time_clock', todayRecord.id);

      toast({
        title: "Almoço finalizado",
        description: "Retorno do almoço registrado"
      });

      fetchRecords();
    } catch (error) {
      console.error('Error ending lunch:', error);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [user]);

  return {
    records,
    loading,
    todayRecord,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    startLunch,
    endLunch,
    refetch: fetchRecords
  };
};