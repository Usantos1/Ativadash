import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSunday, isSameDay, startOfWeek, endOfWeek, addDays, isSameMonth, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTimeClock } from '@/hooks/useTimeClock';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { from } from '@/integrations/db/client';

interface TimeRecord {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  break_start: string | null;
  break_end: string | null;
  total_hours: unknown;
  status: string;
  location: string | null;
  created_at?: string;
  updated_at?: string;
}

export function TimeSheetManager() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [monthlyRecords, setMonthlyRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  
  const { users } = useUsers();
  const { user, isAdmin } = useAuth();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  // Grid de calendário completo (6 semanas)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Domingo = 0
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const fetchMonthlyRecords = async () => {
    if (!selectedUser) return;
    
    setLoading(true);
    try {
      const { data, error } = await from('time_clock')
        .select('*')
        .eq('user_id', selectedUser)
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: true })
        .execute();

      if (error) throw error;
      
      // Converter location para string se for objeto
      const formattedRecords = (data || []).map((record: any) => {
        let locationString: string | null = null;
        if (record.location) {
          if (typeof record.location === 'string') {
            locationString = record.location;
          } else if (typeof record.location === 'object') {
            if ('latitude' in record.location && 'longitude' in record.location) {
              locationString = `${record.location.latitude}, ${record.location.longitude}`;
            } else {
              locationString = JSON.stringify(record.location);
            }
          } else {
            locationString = String(record.location);
          }
        }
        
        return {
          ...record,
          location: locationString,
          total_hours: typeof record.total_hours === 'string' ? record.total_hours : (record.total_hours ? String(record.total_hours) : null)
        };
      });
      
      // Remover duplicatas: manter apenas o registro mais recente para cada data
      const uniqueRecords = formattedRecords.reduce((acc: TimeRecord[], record: TimeRecord) => {
        const existingIndex = acc.findIndex(r => {
          const rDate = typeof r.date === 'string' ? r.date.split('T')[0] : format(new Date(r.date), 'yyyy-MM-dd');
          const recordDate = typeof record.date === 'string' ? record.date.split('T')[0] : format(new Date(record.date), 'yyyy-MM-dd');
          return rDate === recordDate && r.user_id === record.user_id;
        });
        
        if (existingIndex === -1) {
          acc.push(record);
        } else {
          // Se já existe, manter o mais recente (comparar created_at ou updated_at)
          const existing = acc[existingIndex];
          const existingDate = existing.updated_at || existing.created_at || '';
          const recordDate = record.updated_at || record.created_at || '';
          if (recordDate > existingDate) {
            acc[existingIndex] = record;
          }
        }
        
        return acc;
      }, []);
      
      console.log('[TimeSheetManager] Registros encontrados:', formattedRecords.length, 'Únicos:', uniqueRecords.length);
      setMonthlyRecords(uniqueRecords);
    } catch (error) {
      console.error('Erro ao buscar registros:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUser) {
      fetchMonthlyRecords();
    }
  }, [selectedUser, currentDate]);

  useEffect(() => {
    if (user && !selectedUser) {
      setSelectedUser(user.id);
    }
  }, [user, selectedUser]);

  const getRecordForDay = (date: Date) => {
    // Normalizar a data alvo para YYYY-MM-DD
    const targetDateStr = format(date, 'yyyy-MM-dd');
    
    return monthlyRecords.find(record => {
      if (!record.date) return false;
      
      // Extrair apenas a parte da data (YYYY-MM-DD) do registro
      let recordDateStr = '';
      if (typeof record.date === 'string') {
        // Se for string ISO completa, pegar apenas a parte da data
        recordDateStr = record.date.split('T')[0];
      } else {
        // Se for Date object, formatar
        try {
          const date = new Date(record.date);
          if (isValid(date)) {
            recordDateStr = format(date, 'yyyy-MM-dd');
          } else {
            return false;
          }
        } catch {
          return false;
        }
      }
      
      return recordDateStr === targetDateStr;
    });
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '--:--';
    try {
      const date = typeof timeString === 'string' ? parseISO(timeString) : new Date(timeString);
      if (!isValid(date)) return '--:--';
      return format(date, 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  const calculateTotalHours = (record: TimeRecord | undefined) => {
    if (!record?.clock_in || !record?.clock_out) return '0h 0m';
    
    try {
      const clockIn = typeof record.clock_in === 'string' ? parseISO(record.clock_in) : new Date(record.clock_in);
      const clockOut = typeof record.clock_out === 'string' ? parseISO(record.clock_out) : new Date(record.clock_out);
      
      if (!isValid(clockIn) || !isValid(clockOut)) return '0h 0m';
      
      let totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
      
      // Subtrair tempo de almoço
      if (record.lunch_start && record.lunch_end) {
        const lunchStart = typeof record.lunch_start === 'string' ? parseISO(record.lunch_start) : new Date(record.lunch_start);
        const lunchEnd = typeof record.lunch_end === 'string' ? parseISO(record.lunch_end) : new Date(record.lunch_end);
        if (isValid(lunchStart) && isValid(lunchEnd)) {
          const lunchMinutes = (lunchEnd.getTime() - lunchStart.getTime()) / (1000 * 60);
          totalMinutes -= lunchMinutes;
        }
      }
      
      // Subtrair tempo de pausa
      if (record.break_start && record.break_end) {
        const breakStart = typeof record.break_start === 'string' ? parseISO(record.break_start) : new Date(record.break_start);
        const breakEnd = typeof record.break_end === 'string' ? parseISO(record.break_end) : new Date(record.break_end);
        if (isValid(breakStart) && isValid(breakEnd)) {
          const breakMinutes = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
          totalMinutes -= breakMinutes;
        }
      }
      
      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.floor(totalMinutes % 60);
      
      return `${hours}h ${minutes}m`;
    } catch {
      return '0h 0m';
    }
  };

  const getStatusBadge = (date: Date, record: TimeRecord | undefined) => {
    if (isSunday(date)) {
      return <Badge variant="secondary" className="text-xs">Descanso</Badge>;
    }
    
    if (!record && isSameMonth(date, currentDate)) {
      return <Badge variant="destructive" className="text-xs">Falta</Badge>;
    }
    
    if (!record) {
      return null; // Não mostrar badge para dias de outros meses
    }
    
    if (record.clock_in && record.clock_out) {
      return <Badge variant="default" className="text-xs bg-green-500">Completo</Badge>;
    }
    
    if (record.clock_in && !record.clock_out) {
      return <Badge variant="default" className="text-xs bg-yellow-500">Em andamento</Badge>;
    }
    
    return <Badge variant="secondary" className="text-xs">Parcial</Badge>;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  return (
    <div className="space-y-4 md:space-y-6 px-1 md:px-0">
      <Card className="border-2 border-gray-300 shadow-sm">
        <CardHeader className="pb-3 pt-3 md:pt-6 px-3 md:px-6 border-b-2 border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base md:text-xl">
              <div className="p-1.5 md:p-2 rounded-lg bg-[#00F7A5]/15 border-2 border-[#00F7A5]/30">
                <Clock className="h-4 w-4 md:h-5 md:w-5 text-[#00C27F]" />
              </div>
              Espelho de Ponto
            </CardTitle>
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
              {isAdmin && (
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="w-full md:w-48 h-9 md:h-10 text-base md:text-sm border-2 border-gray-300">
                    <SelectValue placeholder="Selecionar usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {user.display_name || 'Usuário'}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <div className="flex items-center justify-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigateMonth('prev')}
                  className="h-9 w-9 border-2 border-gray-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium min-w-[120px] md:min-w-32 text-center text-sm md:text-base">
                  {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigateMonth('next')}
                  className="h-9 w-9 border-2 border-gray-300"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-3 md:p-6">
          {loading ? (
            <div className="text-center py-8 text-sm md:text-base text-muted-foreground">Carregando registros...</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-7 gap-1.5 md:gap-2 min-w-[700px]">
              {/* Headers dos dias da semana */}
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div 
                  key={day} 
                  className="p-1.5 md:p-2 text-center font-semibold text-[10px] md:text-sm bg-gray-100 border-2 border-gray-300 rounded"
                >
                  {day}
                </div>
              ))}
              
              {/* Dias do calendário */}
              {calendarDays.map(date => {
                const record = getRecordForDay(date);
                const isToday = isSameDay(date, new Date());
                const isSundayDay = isSunday(date);
                const isCurrentMonth = isSameMonth(date, currentDate);
                
                return (
                  <Card 
                    key={date.toISOString()} 
                    className={`p-2 md:p-3 min-h-[80px] md:min-h-24 border-2 ${isToday ? 'border-[#00C27F] ring-2 ring-[#00F7A5]/30' : 'border-gray-300'} ${isSundayDay ? 'bg-gray-50' : ''} ${!isCurrentMonth ? 'opacity-30' : ''} shadow-sm`}
                  >
                    <div className="space-y-1.5 md:space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs md:text-sm font-semibold">
                          {format(date, 'dd')}
                        </span>
                        {getStatusBadge(date, record)}
                      </div>
                      
                      {!isSundayDay && record && isCurrentMonth && (
                        <div className="space-y-1 text-[10px] md:text-xs">
                          <div className="flex justify-between">
                            <span>Entrada:</span>
                            <span className="font-mono">{formatTime(record.clock_in)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Saída:</span>
                            <span className="font-mono">{formatTime(record.clock_out)}</span>
                          </div>
                          {record.lunch_start && record.lunch_end && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>Almoço:</span>
                              <span className="font-mono text-[9px] md:text-xs">
                                {formatTime(record.lunch_start)}-{formatTime(record.lunch_end)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between font-medium pt-1 border-t border-gray-200">
                            <span>Total:</span>
                            <span className="font-mono">{calculateTotalHours(record)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}