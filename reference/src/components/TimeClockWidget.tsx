import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Clock, MapPin, Wifi, Play, Square, Coffee, Utensils, CheckCircle, AlertCircle, Edit, Users, Star } from 'lucide-react';
import { useTimeClock } from '@/hooks/useTimeClock';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/useUsers';
import { LocationPermissionModal } from './LocationPermissionModal';
import { LocationDisplay } from '@/utils/locationUtils';
import { from } from '@/integrations/db/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface CorrectionModalData {
  field: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out';
  currentValue: string;
  label: string;
}

export const TimeClockWidget = () => {
  const { user, profile } = useAuth();
  const { records, loading, todayRecord, clockIn, clockOut, startLunch, endLunch, refetch } = useTimeClock();
  const { users } = useUsers();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [processing, setProcessing] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>('');
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [correctionData, setCorrectionData] = useState<CorrectionModalData | null>(null);
  const [correctionTime, setCorrectionTime] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Atualizar horário a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Buscar registros de todos os usuários para hoje
  useEffect(() => {
    const fetchAllTodayRecords = async () => {
      if (!user) return;

      try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await from('time_clock')
          .select('*')
          .eq('date', today)
          .order('created_at', { ascending: false })
          .execute();

        if (error) {
          console.error('Erro ao buscar registros do dia:', error);
          return;
        }

        // Converter location para string se for objeto
        const formattedRecords = (data || []).map((record: any) => {
          if (record.location && typeof record.location === 'object') {
            if ('latitude' in record.location && 'longitude' in record.location) {
              return { ...record, location: `${record.location.latitude}, ${record.location.longitude}` };
            } else {
              return { ...record, location: JSON.stringify(record.location) };
            }
          }
          return record;
        });

        setAllRecords(formattedRecords);
      } catch (error) {
        console.error('Erro ao buscar registros:', error);
      }
    };

    fetchAllTodayRecords();
  }, [user]);

  // Polling para atualizar registros periodicamente
  useEffect(() => {
    if (!user) return;

    // Atualizar registros a cada 60 segundos
    const interval = setInterval(() => {
      refetch();
    }, 60000);
    
    return () => {
      clearInterval(interval);
    };
  }, [user, refetch]);

  if (!profile) {
    return null;
  }

  // Determinar o próximo passo baseado no status atual
  const getNextStep = () => {
    if (!todayRecord) return 'clock_in';
    if (!todayRecord.clock_in) return 'clock_in';
    if (!todayRecord.lunch_start) return 'lunch_start';
    if (!todayRecord.lunch_end) return 'lunch_end';
    if (!todayRecord.clock_out) return 'clock_out';
    return 'completed';
  };

  const nextStep = getNextStep();

  // Determinar status atual
  const getCurrentStatus = () => {
    if (!todayRecord || !todayRecord.clock_in) return 'not_started';
    if (todayRecord.clock_out) return 'completed';
    if (todayRecord.lunch_start && !todayRecord.lunch_end) return 'on_lunch';
    if (todayRecord.lunch_end) return 'working_afternoon';
    return 'working_morning';
  };

  const currentStatus = getCurrentStatus();

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'not_started':
        return { text: 'Não iniciado', color: 'bg-gray-500' };
      case 'working_morning':
        return { text: 'Trabalhando', color: 'bg-green-500' };
      case 'on_lunch':
        return { text: 'No almoço', color: 'bg-yellow-500' };
      case 'working_afternoon':
        return { text: 'Trabalhando', color: 'bg-green-500' };
      case 'completed':
        return { text: 'Concluído', color: 'bg-blue-500' };
      default:
        return { text: 'Pendente', color: 'bg-gray-500' };
    }
  };

  const handleAction = async (action: string) => {
    setProcessing(true);
    setPendingAction(action);
    setLocationModalOpen(true);
  };

  const executeAction = async () => {
    try {
      setProcessing(true);

      switch (pendingAction) {
        case 'clock_in':
          await clockIn();
          break;
        case 'lunch_start':
          await startLunch();
          break;
        case 'lunch_end':
          await endLunch();
          break;
        case 'clock_out':
          await clockOut();
          break;
      }

      setSuccessDialogOpen(true);
    } catch (error) {
      console.error('Erro ao executar ação:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar o ponto. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
      setPendingAction('');
    }
  };

  const handleCorrection = async () => {
    if (!correctionData || !correctionTime || !correctionReason) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos para correção",
        variant: "destructive"
      });
      return;
    }

    try {
      const correctionDateTime = new Date();
      correctionDateTime.setHours(parseInt(correctionTime.split(':')[0]));
      correctionDateTime.setMinutes(parseInt(correctionTime.split(':')[1]));
      
      const { error } = await from('time_clock')
        .update({
          [correctionData.field]: correctionDateTime.toISOString(),
          notes: (todayRecord?.notes || '') + `\n[CORREÇÃO ${format(new Date(), 'dd/MM/yyyy HH:mm')}] ${correctionData.label}: ${correctionReason}`
        })
        .eq('id', todayRecord?.id)
        .execute();

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Ponto corrigido com sucesso"
      });

      setCorrectionModalOpen(false);
      setCorrectionData(null);
      setCorrectionTime('');
      setCorrectionReason('');
      refetch();
    } catch (error) {
      console.error('Erro ao corrigir ponto:', error);
      toast({
        title: "Erro",
        description: "Erro ao corrigir o ponto",
        variant: "destructive"
      });
    }
  };

  const getActionButton = () => {
    switch (nextStep) {
      case 'clock_in':
        return (
          <Button 
            onClick={() => handleAction('clock_in')} 
            disabled={processing}
            size="lg"
            className="w-full h-14 text-lg"
          >
            <Play className="mr-2 h-5 w-5" />
            Entrada
          </Button>
        );
      case 'lunch_start':
        return (
          <Button 
            onClick={() => handleAction('lunch_start')} 
            disabled={processing}
            variant="outline"
            size="lg"
            className="w-full h-14 text-lg"
          >
            <Utensils className="mr-2 h-5 w-5" />
            Início do Almoço
          </Button>
        );
      case 'lunch_end':
        return (
          <Button 
            onClick={() => handleAction('lunch_end')} 
            disabled={processing}
            size="lg"
            className="w-full h-14 text-lg"
          >
            <Coffee className="mr-2 h-5 w-5" />
            Retorno do Almoço
          </Button>
        );
      case 'clock_out':
        return (
          <Button 
            onClick={() => handleAction('clock_out')} 
            disabled={processing}
            variant="destructive"
            size="lg"
            className="w-full h-14 text-lg"
          >
            <Square className="mr-2 h-5 w-5" />
            Saída
          </Button>
        );
      case 'completed':
        return (
          <Button disabled size="lg" className="w-full h-14 text-lg">
            <CheckCircle className="mr-2 h-5 w-5" />
            Dia Concluído
          </Button>
        );
      default:
        return null;
    }
  };

  const formatTime = (timeString: string | null | undefined | object) => {
    // Garantir que seja string ou null
    if (!timeString) return '--:--';
    if (typeof timeString !== 'string') {
      // Se for objeto, tentar converter
      if (typeof timeString === 'object') {
        return '--:--';
      }
      return String(timeString);
    }
    try {
      return format(new Date(timeString), 'HH:mm', { locale: ptBR });
    } catch {
      return '--:--';
    }
  };

  const getUserName = (userId: string) => {
    const foundUser = users.find(u => u.id === userId);
    return foundUser?.display_name || 'Usuário';
  };

  const statusInfo = getStatusInfo(currentStatus);

  return (
    <>
      <Card className="w-full max-w-md mx-auto border-2 border-gray-300 shadow-sm">
        <CardHeader className="text-center pb-3 pt-3 md:pt-6 px-3 md:px-6 border-b-2 border-gray-200">
          <CardTitle className="flex items-center justify-center gap-2 text-base md:text-xl">
            <div className="p-1.5 md:p-2 rounded-lg bg-[#00F7A5]/15 border-2 border-[#00F7A5]/30">
              <Clock className="h-4 w-4 md:h-6 md:w-6 text-[#00C27F]" />
            </div>
            Ponto Eletrônico
          </CardTitle>
          <div className="space-y-2 mt-3 md:mt-4">
            <div className="text-2xl md:text-3xl font-bold text-[#00C27F] md:text-primary">
              {format(currentTime, 'HH:mm:ss')}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground">
              {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </div>
            <Badge className={`${statusInfo.color} text-white text-[10px] md:text-xs border-2 border-gray-200`}>
              {statusInfo.text}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-3 md:p-6 space-y-3 md:space-y-4">
          {/* Resumo do dia atual */}
          {todayRecord && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">Registro de hoje</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span>Entrada:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono">{formatTime(todayRecord.clock_in)}</span>
                    {todayRecord.clock_in && profile?.role === 'admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setCorrectionData({
                            field: 'clock_in',
                            currentValue: todayRecord.clock_in,
                            label: 'Entrada'
                          });
                          setCorrectionTime(format(new Date(todayRecord.clock_in), 'HH:mm'));
                          setCorrectionModalOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Almoço:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono">{formatTime(todayRecord.lunch_start)}</span>
                    {todayRecord.lunch_start && profile?.role === 'admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setCorrectionData({
                            field: 'lunch_start',
                            currentValue: todayRecord.lunch_start,
                            label: 'Início do Almoço'
                          });
                          setCorrectionTime(format(new Date(todayRecord.lunch_start), 'HH:mm'));
                          setCorrectionModalOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Retorno:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono">{formatTime(todayRecord.lunch_end)}</span>
                    {todayRecord.lunch_end && profile?.role === 'admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setCorrectionData({
                            field: 'lunch_end',
                            currentValue: todayRecord.lunch_end,
                            label: 'Retorno do Almoço'
                          });
                          setCorrectionTime(format(new Date(todayRecord.lunch_end), 'HH:mm'));
                          setCorrectionModalOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Saída:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono">{formatTime(todayRecord.clock_out)}</span>
                    {todayRecord.clock_out && profile?.role === 'admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setCorrectionData({
                            field: 'clock_out',
                            currentValue: todayRecord.clock_out,
                            label: 'Saída'
                          });
                          setCorrectionTime(format(new Date(todayRecord.clock_out), 'HH:mm'));
                          setCorrectionModalOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              {todayRecord.total_hours && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Total:</span>
                    <span className="font-mono">
                      {(() => {
                        const total = todayRecord.total_hours;
                        if (typeof total === 'string') {
                          return total;
                        }
                        if (typeof total === 'number') {
                          return String(total);
                        }
                        if (typeof total === 'object' && total !== null) {
                          // Se for objeto, tentar extrair valor ou usar JSON
                          if ('hours' in total && 'minutes' in total) {
                            return `${total.hours}:${String(total.minutes).padStart(2, '0')}`;
                          }
                          return '--:--';
                        }
                        return String(total || '--:--');
                      })()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botão de ação */}
          <div className="space-y-2">
            {getActionButton()}
          </div>

          {/* Informações de localização */}
          {todayRecord && (todayRecord.location || todayRecord.ip_address) && (
            <div className="text-xs text-muted-foreground space-y-1">
              {todayRecord.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <LocationDisplay location={
                    typeof todayRecord.location === 'string' 
                      ? todayRecord.location 
                      : (todayRecord.location?.latitude && todayRecord.location?.longitude
                          ? `${todayRecord.location.latitude}, ${todayRecord.location.longitude}`
                          : JSON.stringify(todayRecord.location))
                  } />
                </div>
              )}
              {todayRecord.ip_address && (
                <div className="flex items-center gap-1">
                  <Wifi className="h-3 w-3" />
                  <span>{todayRecord.ip_address}</span>
                </div>
              )}
            </div>
          )}

          {/* Toggle para mostrar registros de outros colaboradores */}
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full"
            >
              <Users className="h-4 w-4 mr-2" />
              {showHistory ? 'Ocultar' : 'Ver'} Registros do Dia ({allRecords.length})
            </Button>
          </div>

          {/* Registros de outros colaboradores */}
          {showHistory && allRecords.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-1">
                <Users className="h-4 w-4" />
                Registros de hoje
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {allRecords.map((record) => {
                  const userName = getUserName(record.user_id);
                  const isCurrentUser = record.user_id === user?.id;
                  
                  return (
                    <div 
                      key={record.id} 
                      className={`text-xs p-2 rounded ${isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'bg-background'}`}
                    >
                      <div className="font-medium">
                        {isCurrentUser ? 'Você' : userName}
                      </div>
                      <div className="text-muted-foreground grid grid-cols-2 gap-1">
                        <span>Entrada: {formatTime(record.clock_in)}</span>
                        <span>Saída: {formatTime(record.clock_out)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Permissão de Localização */}
      <LocationPermissionModal
        open={locationModalOpen}
        onOpenChange={setLocationModalOpen}
        onPermissionGranted={() => {
          setLocationModalOpen(false);
          executeAction();
        }}
        onPermissionDenied={() => {
          setLocationModalOpen(false);
          setProcessing(false);
          setPendingAction('');
          toast({
            title: "Permissão necessária",
            description: "A localização é obrigatória para registrar o ponto eletrônico.",
            variant: "destructive"
          });
        }}
      />

      {/* Modal de Sucesso */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="sm:max-w-[300px] mx-4">
          <DialogHeader>
            <DialogTitle className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              Ponto Registrado!
            </DialogTitle>
            <DialogDescription className="text-center">
              Seu ponto foi registrado com sucesso às {format(new Date(), 'HH:mm')}.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setSuccessDialogOpen(false)} className="w-full mt-4">
            OK
          </Button>
        </DialogContent>
      </Dialog>

      {/* Modal de Correção */}
      <Dialog open={correctionModalOpen} onOpenChange={setCorrectionModalOpen}>
        <DialogContent className="sm:max-w-[400px] mx-4">
          <DialogHeader>
            <DialogTitle>Corrigir Horário</DialogTitle>
            <DialogDescription>
              Corrija o horário de {correctionData?.label}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="correction-time">Novo horário</Label>
              <Input
                id="correction-time"
                type="time"
                value={correctionTime}
                onChange={(e) => setCorrectionTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="correction-reason">Motivo da correção *</Label>
              <Textarea
                id="correction-reason"
                placeholder="Informe o motivo da correção..."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCorrectionModalOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleCorrection} className="flex-1">
                Corrigir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
};