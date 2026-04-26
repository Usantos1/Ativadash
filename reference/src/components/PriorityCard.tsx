import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PriorityCardProps {
  priority: number;
  className?: string;
}

export function PriorityCard({ priority, className = '' }: PriorityCardProps) {
  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1: return 'Baixa';
      case 2: return 'Média';
      case 3: return 'Alta';
      case 4: return 'Crítica';
      default: return 'Baixa';
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'bg-green-500 text-white border-green-600';
      case 2: return 'bg-yellow-500 text-white border-yellow-600';
      case 3: return 'bg-orange-500 text-white border-orange-600';
      case 4: return 'bg-red-500 text-white border-red-600';
      default: return 'bg-green-500 text-white border-green-600';
    }
  };

  const getPriorityBg = (priority: number) => {
    switch (priority) {
      case 1: return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800';
      case 2: return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800';
      case 3: return 'bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800';
      case 4: return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800';
      default: return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800';
    }
  };

  return (
    <Card className={`${getPriorityBg(priority)} ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Prioridade do Processo</h3>
          <Badge className={getPriorityColor(priority)}>
            {getPriorityLabel(priority)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Nível de importância: {getPriorityLabel(priority).toLowerCase()}
        </p>
      </CardContent>
    </Card>
  );
}