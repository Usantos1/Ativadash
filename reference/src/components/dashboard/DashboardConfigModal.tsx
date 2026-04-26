import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardConfig, DashboardWidgetConfig } from '@/hooks/useDashboardConfig';
import { GripVertical, Settings, LayoutGrid, RefreshCw, Monitor } from 'lucide-react';
import { useState, useEffect } from 'react';

interface DashboardConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WIDGET_LABELS: Record<string, string> = {
  'financial-cards': 'Cards Financeiros',
  'os-status': 'Status de OS',
  'trend-charts': 'Gráficos de Tendência',
  'quick-actions': 'Ações Rápidas',
  'main-sections': 'Seções Principais',
};

const REFRESH_INTERVALS = [
  { value: 30, label: '30 segundos' },
  { value: 60, label: '1 minuto' },
  { value: 120, label: '2 minutos' },
  { value: 300, label: '5 minutos' },
  { value: 600, label: '10 minutos' },
];

export function DashboardConfigModal({ open, onOpenChange }: DashboardConfigModalProps) {
  const { config, saveConfig } = useDashboardConfig();
  const [localConfig, setLocalConfig] = useState({
    widgets: config.widgets,
    presentationMode: config.presentationMode,
    autoRefreshEnabled: config.autoRefreshEnabled,
    autoRefreshInterval: config.autoRefreshInterval,
  });

  useEffect(() => {
    if (open) {
      setLocalConfig({
        widgets: config.widgets,
        presentationMode: config.presentationMode,
        autoRefreshEnabled: config.autoRefreshEnabled,
        autoRefreshInterval: config.autoRefreshInterval,
      });
    }
  }, [open, config]);

  const handleSave = async () => {
    await saveConfig(localConfig);
    onOpenChange(false);
  };

  const handleToggleWidget = (widgetId: string) => {
    setLocalConfig(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => (w.id === widgetId ? { ...w, enabled: !w.enabled } : w))
    }));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newWidgets = [...localConfig.widgets];
    [newWidgets[index - 1], newWidgets[index]] = [newWidgets[index], newWidgets[index - 1]];
    setLocalConfig(prev => ({
      ...prev,
      widgets: newWidgets.map((w, i) => ({ ...w, order: i + 1 }))
    }));
  };

  const handleMoveDown = (index: number) => {
    if (index === localConfig.widgets.length - 1) return;
    const newWidgets = [...localConfig.widgets];
    [newWidgets[index], newWidgets[index + 1]] = [newWidgets[index + 1], newWidgets[index]];
    setLocalConfig(prev => ({
      ...prev,
      widgets: newWidgets.map((w, i) => ({ ...w, order: i + 1 }))
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-w-[95vw] p-0 overflow-hidden">
        <DialogHeader className="px-4 md:px-6 pt-4 md:pt-6 pb-3 border-b-2 border-gray-200">
          <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
            <Settings className="h-5 w-5 text-blue-600" />
            Configurar Dashboard
          </DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
            Personalize widgets, modo apresentação e atualização automática
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="widgets" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mx-4 md:mx-6 mt-4 border-2 border-gray-300 bg-gray-50 h-auto">
            <TabsTrigger 
              value="widgets" 
              className="flex items-center justify-center gap-2 text-xs md:text-sm py-2.5 md:py-3 px-2 md:px-4 border-r-2 border-gray-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
            >
              <LayoutGrid className="h-4 w-4" />
              Widgets
            </TabsTrigger>
            <TabsTrigger 
              value="presentation" 
              className="flex items-center justify-center gap-2 text-xs md:text-sm py-2.5 md:py-3 px-2 md:px-4 border-r-2 border-gray-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white"
            >
              <Monitor className="h-4 w-4" />
              Modo TV
            </TabsTrigger>
            <TabsTrigger 
              value="refresh" 
              className="flex items-center justify-center gap-2 text-xs md:text-sm py-2.5 md:py-3 px-2 md:px-4 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Atualização
            </TabsTrigger>
          </TabsList>

          <div className="px-4 md:px-6 py-4 md:py-6 max-h-[60vh] overflow-y-auto">
            {/* Tab: Widgets */}
            <TabsContent value="widgets" className="mt-4 space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Widgets do Dashboard</Label>
                <p className="text-xs text-muted-foreground">
                  Ative ou desative widgets e organize a ordem de exibição
                </p>
                <div className="space-y-2 border-2 border-gray-300 rounded-lg p-3 bg-gray-50/50">
                  {localConfig.widgets
                    .sort((a, b) => a.order - b.order)
                    .map((widget, index) => (
                      <div
                        key={widget.id}
                        className="flex items-center justify-between p-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <GripVertical className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          <Label htmlFor={`widget-${widget.id}`} className="text-sm font-medium cursor-pointer truncate">
                            {WIDGET_LABELS[widget.id] || widget.id}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-xs"
                              onClick={() => handleMoveUp(index)}
                              disabled={index === 0}
                              title="Mover para cima"
                            >
                              ↑
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-xs"
                              onClick={() => handleMoveDown(index)}
                              disabled={index === localConfig.widgets.length - 1}
                              title="Mover para baixo"
                            >
                              ↓
                            </Button>
                          </div>
                          <Switch
                            id={`widget-${widget.id}`}
                            checked={widget.enabled}
                            onCheckedChange={() => handleToggleWidget(widget.id)}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Modo Apresentação */}
            <TabsContent value="presentation" className="mt-4 space-y-4">
              <div className="space-y-4">
                <div className="p-4 border-2 border-gray-300 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <Label htmlFor="presentation-mode" className="text-sm font-semibold flex items-center gap-2">
                        <Monitor className="h-5 w-5 text-purple-600" />
                        Modo Apresentação (TV)
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Dashboard otimizado para exibição em TV da loja
                      </p>
                    </div>
                    <Switch
                      id="presentation-mode"
                      checked={localConfig.presentationMode}
                      onCheckedChange={(checked) => 
                        setLocalConfig(prev => ({ ...prev, presentationMode: checked }))
                      }
                    />
                  </div>
                  {localConfig.presentationMode && (
                    <div className="mt-3 p-3 bg-white/80 rounded border border-purple-200">
                      <p className="text-xs text-purple-700">
                        <strong>Dica:</strong> Use a tecla ESC ou o botão no canto superior direito para sair do modo apresentação.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Atualização Automática */}
            <TabsContent value="refresh" className="mt-4 space-y-4">
              <div className="space-y-4">
                <div className="p-4 border-2 border-gray-300 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label htmlFor="auto-refresh" className="text-sm font-semibold flex items-center gap-2">
                          <RefreshCw className="h-5 w-5 text-green-600" />
                          Atualização Automática
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Recarregar dados automaticamente apenas no Modo Apresentação (TV)
                        </p>
                      </div>
                      <Switch
                        id="auto-refresh"
                        checked={localConfig.autoRefreshEnabled}
                        onCheckedChange={(checked) => 
                          setLocalConfig(prev => ({ ...prev, autoRefreshEnabled: checked }))
                        }
                        disabled={!localConfig.presentationMode}
                      />
                    </div>

                    {localConfig.autoRefreshEnabled && localConfig.presentationMode && (
                      <div className="mt-4 space-y-3 p-3 bg-white/80 rounded border border-green-200">
                        <Label htmlFor="refresh-interval" className="text-sm font-medium">
                          Intervalo de Atualização
                        </Label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          {REFRESH_INTERVALS.map((interval) => (
                            <Button
                              key={interval.value}
                              variant={localConfig.autoRefreshInterval === interval.value ? 'default' : 'outline'}
                              size="sm"
                              className={`h-9 text-xs border-2 ${
                                localConfig.autoRefreshInterval === interval.value
                                  ? 'bg-green-600 hover:bg-green-700 text-white border-green-700'
                                  : 'border-gray-300'
                              }`}
                              onClick={() => 
                                setLocalConfig(prev => ({ ...prev, autoRefreshInterval: interval.value }))
                              }
                            >
                              {interval.label}
                            </Button>
                          ))}
                        </div>
                        <div className="mt-2">
                          <Label htmlFor="custom-interval" className="text-xs text-muted-foreground">
                            Ou defina um intervalo personalizado (em segundos):
                          </Label>
                          <Input
                            id="custom-interval"
                            type="number"
                            min="10"
                            max="3600"
                            value={localConfig.autoRefreshInterval}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 60;
                              setLocalConfig(prev => ({ 
                                ...prev, 
                                autoRefreshInterval: Math.max(10, Math.min(3600, value))
                              }));
                            }}
                            className="mt-1 h-9 text-base md:text-sm border-2 border-gray-300"
                            placeholder="60"
                          />
                        </div>
                      </div>
                    )}

                    {localConfig.autoRefreshEnabled && !localConfig.presentationMode && (
                      <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                        <p className="text-xs text-yellow-700">
                          <strong>Atenção:</strong> A atualização automática só funciona no Modo Apresentação (TV). 
                          Ative o Modo Apresentação primeiro.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex gap-2 px-4 md:px-6 pb-4 md:pb-6 border-t-2 border-gray-200">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-9 border-2 border-gray-300"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 h-9 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white border-0"
          >
            Salvar Configurações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
