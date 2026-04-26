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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Bell, Mail, MessageSquare, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AlertConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  threshold: number;
  frequency: 'immediate' | 'daily' | 'weekly';
  channels: ('email' | 'whatsapp')[];
}

export function AlertsConfigModal() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertConfig[]>([
    {
      id: 'overdue_tasks',
      name: 'Tarefas Atrasadas',
      description: 'Alerta quando há muitas tarefas atrasadas',
      enabled: true,
      threshold: 5,
      frequency: 'daily',
      channels: ['email', 'whatsapp']
    },
    {
      id: 'low_productivity',
      name: 'Produtividade Baixa',
      description: 'Alerta quando a produtividade está abaixo do esperado',
      enabled: false,
      threshold: 70,
      frequency: 'weekly',
      channels: ['email']
    },
    {
      id: 'inactive_processes',
      name: 'Processos Inativos',
      description: 'Alerta quando processos ficam sem atividade',
      enabled: true,
      threshold: 7,
      frequency: 'daily',
      channels: ['email']
    },
    {
      id: 'nps_low_score',
      name: 'NPS Baixo',
      description: 'Alerta quando o NPS está abaixo do limite',
      enabled: false,
      threshold: 6,
      frequency: 'immediate',
      channels: ['email', 'whatsapp']
    }
  ]);
  const { toast } = useToast();

  const updateAlert = (id: string, updates: Partial<AlertConfig>) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, ...updates } : alert
    ));
  };

  const handleSave = () => {
    // Aqui você salvaria as configurações no banco de dados
    toast({
      title: "Configurações salvas",
      description: "Os alertas foram configurados com sucesso",
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Bell className="h-4 w-4" />
          Configurar Alertas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Configurar Alertas Automáticos
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card key={alert.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{alert.name}</CardTitle>
                  <Switch
                    checked={alert.enabled}
                    onCheckedChange={(enabled) => updateAlert(alert.id, { enabled })}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{alert.description}</p>
              </CardHeader>
              
              {alert.enabled && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Limite</Label>
                      <Input
                        type="number"
                        value={alert.threshold}
                        onChange={(e) => updateAlert(alert.id, { threshold: Number(e.target.value) })}
                        placeholder="Valor limite"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Frequência</Label>
                      <Select
                        value={alert.frequency}
                        onValueChange={(frequency: 'immediate' | 'daily' | 'weekly') =>
                          updateAlert(alert.id, { frequency })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Imediato</SelectItem>
                          <SelectItem value="daily">Diário</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Canais de Notificação</Label>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={alert.channels.includes('email')}
                          onCheckedChange={(checked) => {
                          const channels = checked
                            ? [...alert.channels, 'email' as const]
                            : alert.channels.filter(c => c !== 'email');
                          updateAlert(alert.id, { channels });
                          }}
                        />
                        <Label className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={alert.channels.includes('whatsapp')}
                          onCheckedChange={(checked) => {
                          const channels = checked
                            ? [...alert.channels, 'whatsapp' as const]
                            : alert.channels.filter(c => c !== 'whatsapp');
                          updateAlert(alert.id, { channels });
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
              Salvar Configurações
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