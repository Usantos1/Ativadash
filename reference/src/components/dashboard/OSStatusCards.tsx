import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench, Clock, CheckCircle, AlertCircle, Package } from 'lucide-react';
import { DashboardOSData } from '@/hooks/useDashboardData';
import { useNavigate } from 'react-router-dom';

interface OSStatusCardsProps {
  data: DashboardOSData;
  showValues?: boolean;
}

export function OSStatusCards({ data, showValues = false }: OSStatusCardsProps) {
  const navigate = useNavigate();

  const cards = [
    {
      title: 'Total',
      value: data.total,
      icon: Wrench,
      color: 'bg-blue-500',
      path: '/os',
    },
    {
      title: 'Abertas',
      value: data.abertas,
      icon: AlertCircle,
      color: 'bg-yellow-500',
      path: '/os?status=aberta',
    },
    {
      title: 'Em Andamento',
      value: data.emAndamento,
      icon: Clock,
      color: 'bg-purple-500',
      path: '/os?status=em_andamento',
    },
    {
      title: 'Aguardando',
      value: data.aguardando,
      icon: Clock,
      color: 'bg-orange-500',
      path: '/os?status=aguardando',
    },
    {
      title: 'Finalizadas',
      value: data.finalizadas,
      icon: CheckCircle,
      color: 'bg-green-500',
      path: '/os?status=finalizada',
    },
    {
      title: 'Ag. Retirada',
      value: data.aguardandoRetirada,
      icon: Package,
      color: 'bg-indigo-500',
      path: '/os?status=aguardando_retirada',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.title}
            className="border-2 border-gray-300 dark:border-gray-600 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99] rounded-xl md:rounded-lg min-h-[52px] sm:min-h-[56px] md:min-h-0 touch-manipulation"
            onClick={() => navigate(card.path)}
          >
            <CardHeader className="pb-2 pt-2 px-3 sm:py-2 sm:px-3 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-xs md:text-xs font-semibold flex items-center gap-1.5 min-w-0">
                <Icon className={`h-4 w-4 shrink-0 ${card.color.replace('bg-', 'text-')}`} />
                <span className="truncate">{card.title}</span>
              </CardTitle>
              <span className="text-base md:text-xl font-bold tabular-nums shrink-0">{card.value}</span>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}


