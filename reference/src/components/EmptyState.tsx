import React, { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  FileText, 
  Search, 
  Users, 
  FolderOpen, 
  Inbox,
  AlertCircle,
  Plus,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateVariant = 
  | 'no-data' 
  | 'no-results' 
  | 'no-users' 
  | 'no-files' 
  | 'empty-inbox' 
  | 'error';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const variantConfig = {
  'no-data': {
    icon: FolderOpen,
    title: 'Nenhum dado encontrado',
    description: 'Não há dados para exibir no momento.',
  },
  'no-results': {
    icon: Search,
    title: 'Nenhum resultado',
    description: 'Nenhum resultado foi encontrado para sua busca.',
  },
  'no-users': {
    icon: Users,
    title: 'Nenhum usuário',
    description: 'Não há usuários cadastrados ainda.',
  },
  'no-files': {
    icon: FileText,
    title: 'Nenhum arquivo',
    description: 'Não há arquivos para exibir.',
  },
  'empty-inbox': {
    icon: Inbox,
    title: 'Caixa vazia',
    description: 'Não há itens na sua caixa de entrada.',
  },
  'error': {
    icon: AlertCircle,
    title: 'Erro ao carregar',
    description: 'Ocorreu um erro ao carregar os dados. Tente novamente.',
  },
};

export function EmptyState({
  variant = 'no-data',
  title,
  description,
  icon,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant];
  const DefaultIcon = config.icon;

  // Se icon for um componente React (função), renderiza como JSX
  // Se for JSX ou outro ReactNode, renderiza diretamente
  const renderIcon = () => {
    if (icon) {
      // Se é uma função (componente React), renderiza como componente
      if (typeof icon === 'function') {
        const IconComponent = icon as React.ComponentType<{ className?: string }>;
        return <IconComponent className="h-12 w-12" />;
      }
      // Se já for um elemento React válido, renderiza diretamente
      if (React.isValidElement(icon)) {
        return icon;
      }
      // Caso contrário, tenta renderizar como está (pode ser string, número, etc)
      return icon;
    }
    return <DefaultIcon className="h-12 w-12" />;
  };

  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4 text-muted-foreground">
          {renderIcon()}
        </div>
        
        <h3 className="text-lg font-semibold mb-2">
          {title || config.title}
        </h3>
        
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          {description || config.description}
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          {action && (
            <Button onClick={action.onClick} className="gap-2">
              {action.icon || <Plus className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
          
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Componente wrapper para mostrar EmptyState ou children
 */
interface WithEmptyStateProps {
  isEmpty: boolean;
  children: ReactNode;
  emptyProps: EmptyStateProps;
}

export function WithEmptyState({ isEmpty, children, emptyProps }: WithEmptyStateProps) {
  if (isEmpty) {
    return <EmptyState {...emptyProps} />;
  }
  return <>{children}</>;
}
