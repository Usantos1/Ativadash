import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Calendar, Clock, Mail, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ScheduledReport {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  reportTypes: string[];
  recipients: string[];
  channels: ('email' | 'whatsapp')[];
}

export function ScheduledReportsModal() {
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState<ScheduledReport[]>([
    {
      id: '1',
      name: 'Relatório Semanal de Produtividade',
      description: 'Resumo semanal das métricas de produtividade',
      enabled: true,
      frequency: 'weekly',
      time: '08:00',
      dayOfWeek: 1, // Segunda-feira
      reportTypes: ['productivity', 'tasks'],
      recipients: ['admin@empresa.com'],
      channels: ['email']
    },
    {
      id: '2',
      name: 'Relatório Mensal Executivo',
      description: 'Relatório executivo completo mensal',
      enabled: false,
      frequency: 'monthly',
      time: '09:00',
      dayOfMonth: 1,
      reportTypes: ['productivity', 'processes', 'teams'],
      recipients: ['diretor@empresa.com'],
      channels: ['email', 'whatsapp']
    }
  ]);
  const [newRecipient, setNewRecipient] = useState('');
  const { toast } = useToast();

  const updateReport = (id: string, updates: Partial<ScheduledReport>) => {
    setReports(prev => prev.map(report => 
      report.id === id ? { ...report, ...updates } : report
    ));
  };

  const addRecipient = (reportId: string) => {
    if (newRecipient.trim()) {
      updateReport(reportId, {
        recipients: [...reports.find(r => r.id === reportId)?.recipients || [], newRecipient.trim()]
      });
      setNewRecipient('');
    }
  };

  const removeRecipient = (reportId: string, recipientIndex: number) => {
    const report = reports.find(r => r.id === reportId);
    if (report) {
      const newRecipients = report.recipients.filter((_, index) => index !== recipientIndex);
      updateReport(reportId, { recipients: newRecipients });
    }
  };

  const createNewReport = () => {
    const newReport: ScheduledReport = {
      id: Date.now().toString(),
      name: 'Novo Relatório',
      description: '',
      enabled: false,
      frequency: 'weekly',
      time: '08:00',
      dayOfWeek: 1,
      reportTypes: ['productivity'],
      recipients: [],
      channels: ['email']
    };
    setReports(prev => [...prev, newReport]);
  };

  const deleteReport = (id: string) => {
    setReports(prev => prev.filter(report => report.id !== id));
  };

  const handleSave = () => {
    // Aqui você salvaria os agendamentos no banco de dados
    toast({
      title: "Agendamentos salvos",
      description: "Os relatórios foram agendados com sucesso",
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Calendar className="h-4 w-4" />
          Agendar Relatórios
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Agendar Relatórios Automáticos
            </DialogTitle>
            <Button onClick={createNewReport} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Relatório
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={report.name}
                      onChange={(e) => updateReport(report.id, { name: e.target.value })}
                      className="font-semibold"
                    />
                    <Textarea
                      value={report.description}
                      onChange={(e) => updateReport(report.id, { description: e.target.value })}
                      placeholder="Descrição do relatório"
                      className="text-sm"
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={report.enabled}
                      onCheckedChange={(enabled) => updateReport(report.id, { enabled })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteReport(report.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {report.enabled && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Frequência</Label>
                      <Select
                        value={report.frequency}
                        onValueChange={(frequency: 'daily' | 'weekly' | 'monthly') =>
                          updateReport(report.id, { frequency })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Diário</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Horário</Label>
                      <Input
                        type="time"
                        value={report.time}
                        onChange={(e) => updateReport(report.id, { time: e.target.value })}
                      />
                    </div>
                    
                    {report.frequency === 'weekly' && (
                      <div className="space-y-2">
                        <Label>Dia da Semana</Label>
                        <Select
                          value={report.dayOfWeek?.toString()}
                          onValueChange={(day) => updateReport(report.id, { dayOfWeek: Number(day) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Segunda-feira</SelectItem>
                            <SelectItem value="2">Terça-feira</SelectItem>
                            <SelectItem value="3">Quarta-feira</SelectItem>
                            <SelectItem value="4">Quinta-feira</SelectItem>
                            <SelectItem value="5">Sexta-feira</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {report.frequency === 'monthly' && (
                      <div className="space-y-2">
                        <Label>Dia do Mês</Label>
                        <Input
                          type="number"
                          min="1"
                          max="28"
                          value={report.dayOfMonth}
                          onChange={(e) => updateReport(report.id, { dayOfMonth: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Tipos de Relatório</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'productivity', label: 'Produtividade' },
                        { id: 'processes', label: 'Processos' },
                        { id: 'teams', label: 'Equipes' },
                        { id: 'time', label: 'Tempo & Eficiência' },
                        { id: 'events', label: 'Agenda & Eventos' },
                        { id: 'nps', label: 'NPS' }
                      ].map((type) => (
                        <div key={type.id} className="flex items-center space-x-2">
                          <Switch
                            checked={report.reportTypes.includes(type.id)}
                            onCheckedChange={(checked) => {
                              const types = checked
                                ? [...report.reportTypes, type.id]
                                : report.reportTypes.filter(t => t !== type.id);
                              updateReport(report.id, { reportTypes: types });
                            }}
                          />
                          <Label>{type.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Destinatários</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newRecipient}
                        onChange={(e) => setNewRecipient(e.target.value)}
                        placeholder="email@exemplo.com"
                        onKeyPress={(e) => e.key === 'Enter' && addRecipient(report.id)}
                      />
                      <Button
                        type="button"
                        onClick={() => addRecipient(report.id)}
                        size="sm"
                      >
                        Adicionar
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {report.recipients.map((recipient, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-1 bg-secondary px-2 py-1 rounded text-sm"
                        >
                          {recipient}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRecipient(report.id, index)}
                            className="h-auto p-0 ml-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Canais de Envio</Label>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={report.channels.includes('email')}
                          onCheckedChange={(checked) => {
                            const channels = checked
                              ? [...report.channels, 'email' as const]
                              : report.channels.filter(c => c !== 'email');
                            updateReport(report.id, { channels });
                          }}
                        />
                        <Label className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={report.channels.includes('whatsapp')}
                          onCheckedChange={(checked) => {
                            const channels = checked
                              ? [...report.channels, 'whatsapp' as const]
                              : report.channels.filter(c => c !== 'whatsapp');
                            updateReport(report.id, { channels });
                          }}
                        />
                        <Label className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          WhatsApp
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
          
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} className="flex-1">
              Salvar Agendamentos
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}