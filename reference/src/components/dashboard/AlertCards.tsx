import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Package, Wallet, Clock } from 'lucide-react';
import { DashboardAlerts } from '@/hooks/useDashboardData';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface AlertCardsProps {
  alerts: DashboardAlerts;
  /** Ocultar Estoque Baixo e Caixa Aberto (já exibidos na linha de 6 do topo) */
  excludeTopRow?: boolean;
}

export function AlertCards({ alerts, excludeTopRow = false }: AlertCardsProps) {
  const navigate = useNavigate();

  const alertItems = [
    {
      title: 'OS Paradas',
      id: 'os_paradas',
      value: alerts.osParadas,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-300',
      path: '/os?filter=paradas',
      description: 'Sem atualização há mais de 3 dias',
    },
    {
      title: 'Estoque Baixo',
      id: 'estoque_baixo',
      value: alerts.estoqueBaixo,
      icon: Package,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-300',
      path: '/produtos?filter=estoque_baixo',
      description: 'Produtos com menos de 5 unidades',
    },
    {
      title: 'Caixa Aberto',
      id: 'caixa_aberto',
      value: alerts.caixaAberto ? 'Sim' : 'Não',
      icon: Wallet,
      color: alerts.caixaAberto ? 'text-green-600' : 'text-gray-600',
      bgColor: alerts.caixaAberto ? 'bg-green-50' : 'bg-gray-50',
      borderColor: alerts.caixaAberto ? 'border-green-300' : 'border-gray-300',
      path: '/pdv/caixa',
      description: alerts.caixaAberto ? 'Caixa está aberto' : 'Caixa está fechado',
    },
    {
      title: 'OS Sem Atualização',
      id: 'os_sem_atualizacao',
      value: alerts.osSemAtualizacao,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-300',
      path: '/os?filter=sem_atualizacao',
      description: 'Sem atualização há mais de 7 dias',
    },
  ]
    .filter(item => {
      if (excludeTopRow && (item.id === 'estoque_baixo' || item.id === 'caixa_aberto')) return false;
      if (item.title === 'Caixa Aberto') return true;
      return typeof item.value === 'number' && item.value > 0;
    });

  if (alertItems.length === 0) {
    return (
      <Card className="border-2 border-gray-300 shadow-sm">
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          Nenhum alerta no momento
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {alertItems.map((alert) => {
        const Icon = alert.icon;
        return (
          <Card
            key={alert.title}
            className={`border-2 ${alert.borderColor} shadow-sm hover:shadow-md transition-all cursor-pointer ${alert.bgColor}`}
            onClick={() => navigate(alert.path)}
          >
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Icon className={`h-5 w-5 ${alert.color}`} />
                {alert.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center justify-between">
                <Badge 
                  variant={typeof alert.value === 'number' && alert.value > 0 ? 'destructive' : 'secondary'}
                  className="text-base md:text-xl font-bold"
                >
                  {alert.value}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{alert.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}


