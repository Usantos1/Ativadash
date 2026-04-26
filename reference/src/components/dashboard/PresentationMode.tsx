import { useEffect, useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FinancialCards } from './FinancialCards';
import { OSStatusCards } from './OSStatusCards';
import { TrendCharts } from './TrendCharts';
import { DashboardFinancialData, DashboardOSData, DashboardAlerts, DashboardTrendData } from '@/hooks/useDashboardData';
import { useDashboardConfig } from '@/hooks/useDashboardConfig';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Monitor, Eye, EyeOff } from 'lucide-react';
import { getStoredValuesVisible, setStoredValuesVisible } from './FinancialCards';

interface PresentationModeProps {
  financialData: DashboardFinancialData;
  osData: DashboardOSData;
  alerts: DashboardAlerts;
  trendData: DashboardTrendData[];
}

export function PresentationMode({ financialData, osData, alerts, trendData }: PresentationModeProps) {
  const { togglePresentationMode } = useDashboardConfig();
  const [valuesVisible, setValuesVisible] = useState(getStoredValuesVisible);

  const handleExit = useCallback(async () => {
    await togglePresentationMode();
  }, [togglePresentationMode]);

  // Listener para tecla ESC
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExit();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleExit]);

  // Sem auto-refresh/reload: modo apresentação apenas exibe o estado atual dos dados recebidos via props.

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8 relative">
      {/* Botão para sair do modo apresentação */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          onClick={handleExit}
          className="bg-red-500 hover:bg-red-600 text-white shadow-lg border-0 h-10 px-4 gap-2"
          title="Sair do Modo Apresentação (ESC)"
        >
          <X className="h-4 w-4" />
          <span className="hidden md:inline">Sair do Modo TV</span>
        </Button>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header com data/hora */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Monitor className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
              Dashboard - PRIME CAMP
            </h1>
          </div>
          <p className="text-lg md:text-xl text-gray-600">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <p className="text-base md:text-lg text-gray-500">
            {format(new Date(), "HH:mm", { locale: ptBR })}h
          </p>
        </div>

        {/* Cards Financeiros */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="text-sm font-medium text-gray-600">Indicadores Financeiros</span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              const next = !valuesVisible;
              setStoredValuesVisible(next);
              setValuesVisible(next);
            }}
            title={valuesVisible ? 'Ocultar valores' : 'Exibir valores'}
          >
            {valuesVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        </div>
        <FinancialCards data={financialData} valuesVisible={valuesVisible} />

        {/* Status de OS */}
        <Card className="border-2 border-gray-300 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Ordens de Serviço</h2>
            <OSStatusCards data={osData} />
          </CardContent>
        </Card>

        {/* Gráficos de Tendência */}
        {trendData.length > 0 && <TrendCharts data={trendData} valuesVisible={valuesVisible} />}
      </div>
    </div>
  );
}

