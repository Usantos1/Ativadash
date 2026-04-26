import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Pause, 
  Play, 
  Archive,
  Loader2,
  FileEdit
} from 'lucide-react';

type StatusVariant = 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'info' 
  | 'pending' 
  | 'active' 
  | 'inactive'
  | 'draft'
  | 'archived'
  | 'loading';

interface StatusConfig {
  label: string;
  icon: React.ElementType;
  className: string;
}

const statusConfigs: Record<StatusVariant, StatusConfig> = {
  success: {
    label: 'Sucesso',
    icon: CheckCircle,
    className: 'bg-success/10 text-success border-success/20',
  },
  warning: {
    label: 'Atenção',
    icon: AlertCircle,
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  error: {
    label: 'Erro',
    icon: XCircle,
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  info: {
    label: 'Info',
    icon: AlertCircle,
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  pending: {
    label: 'Pendente',
    icon: Clock,
    className: 'bg-muted text-muted-foreground border-border',
  },
  active: {
    label: 'Ativo',
    icon: Play,
    className: 'bg-success/10 text-success border-success/20',
  },
  inactive: {
    label: 'Inativo',
    icon: Pause,
    className: 'bg-muted text-muted-foreground border-border',
  },
  draft: {
    label: 'Rascunho',
    icon: FileEdit,
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  archived: {
    label: 'Arquivado',
    icon: Archive,
    className: 'bg-muted text-muted-foreground border-border',
  },
  loading: {
    label: 'Carregando',
    icon: Loader2,
    className: 'bg-muted text-muted-foreground border-border',
  },
};

// Mapeamento de status comuns do sistema
const statusMappings: Record<string, StatusVariant> = {
  // Status de processo
  'active': 'active',
  'ativo': 'active',
  'draft': 'draft',
  'rascunho': 'draft',
  'review': 'warning',
  'em_revisao': 'warning',
  'archived': 'archived',
  'arquivado': 'archived',
  
  // Status de candidato
  'pending': 'pending',
  'pendente': 'pending',
  'approved': 'success',
  'aprovado': 'success',
  'rejected': 'error',
  'rejeitado': 'error',
  'interview': 'info',
  'entrevista': 'info',
  
  // Status genéricos
  'success': 'success',
  'sucesso': 'success',
  'error': 'error',
  'erro': 'error',
  'warning': 'warning',
  'aviso': 'warning',
  'completed': 'success',
  'concluido': 'success',
  'cancelled': 'error',
  'cancelado': 'error',
};

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function StatusBadge({
  status,
  variant,
  label,
  showIcon = true,
  size = 'default',
  className,
}: StatusBadgeProps) {
  // Determinar variante
  const resolvedVariant = variant || statusMappings[status.toLowerCase()] || 'info';
  const config = statusConfigs[resolvedVariant];
  const Icon = config.icon;

  // Determinar label
  const resolvedLabel = label || statusMappings[status.toLowerCase()] 
    ? config.label 
    : status;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    default: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    default: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium gap-1.5 border',
        config.className,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && (
        <Icon className={cn(
          iconSizes[size],
          resolvedVariant === 'loading' && 'animate-spin'
        )} />
      )}
      {resolvedLabel}
    </Badge>
  );
}

/**
 * Componente para múltiplos status em linha
 */
interface StatusGroupProps {
  statuses: Array<{
    status: string;
    variant?: StatusVariant;
    label?: string;
  }>;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function StatusGroup({ statuses, size = 'sm', className }: StatusGroupProps) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {statuses.map((item, index) => (
        <StatusBadge
          key={index}
          status={item.status}
          variant={item.variant}
          label={item.label}
          size={size}
          showIcon={false}
        />
      ))}
    </div>
  );
}

