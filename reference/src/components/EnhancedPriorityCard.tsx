import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PriorityConfig {
  value: number;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

const PRIORITY_CONFIGS: Record<number, PriorityConfig> = {
  1: {
    value: 1,
    label: 'Baixa',
    color: 'hsl(var(--priority-low))',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
    borderColor: 'border-l-green-500',
    textColor: 'text-green-700 dark:text-green-400'
  },
  2: {
    value: 2,
    label: 'Média',
    color: 'hsl(var(--priority-medium))',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
    borderColor: 'border-l-yellow-500',
    textColor: 'text-yellow-700 dark:text-yellow-400'
  },
  3: {
    value: 3,
    label: 'Alta',
    color: 'hsl(var(--priority-high))',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    borderColor: 'border-l-orange-500',
    textColor: 'text-orange-700 dark:text-orange-400'
  },
  4: {
    value: 4,
    label: 'Crítica',
    color: 'hsl(var(--priority-critical))',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-l-red-500',
    textColor: 'text-red-700 dark:text-red-400'
  }
};

interface EnhancedPriorityCardProps {
  priority: number;
  children: React.ReactNode;
  className?: string;
}

export const EnhancedPriorityCard = ({ priority, children, className }: EnhancedPriorityCardProps) => {
  const config = PRIORITY_CONFIGS[priority] || PRIORITY_CONFIGS[2];

  return (
    <Card 
      className={cn(
        "relative transition-all duration-300 border-l-4",
        config.bgColor,
        config.borderColor,
        "hover:shadow-lg hover:shadow-primary/10",
        className
      )}
    >
      <div className="absolute top-3 right-3 z-10">
        <Badge 
          variant="outline"
          className={cn(
            "font-medium border-2",
            config.textColor
          )}
          style={{
            backgroundColor: `${config.color}15`,
            borderColor: config.color,
            color: config.color
          }}
        >
          {config.label}
        </Badge>
      </div>
      {children}
    </Card>
  );
};

export const PriorityBadge = ({ priority, size = "default" }: { priority: number; size?: "sm" | "default" | "lg" }) => {
  const config = PRIORITY_CONFIGS[priority] || PRIORITY_CONFIGS[2];
  
  return (
    <Badge 
      variant="outline"
      className={cn(
        "font-medium border-2",
        config.textColor,
        size === "sm" && "text-xs px-2 py-1",
        size === "lg" && "text-sm px-3 py-2"
      )}
      style={{
        backgroundColor: `${config.color}15`,
        borderColor: config.color,
        color: config.color
      }}
    >
      {config.label}
    </Badge>
  );
};

export const getPriorityConfig = (priority: number) => {
  return PRIORITY_CONFIGS[priority] || PRIORITY_CONFIGS[2];
};