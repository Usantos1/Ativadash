import { forwardRef, ReactNode } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingState?: LoadingState;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  icon?: ReactNode;
  showSuccessIcon?: boolean;
  showErrorIcon?: boolean;
}

export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      children,
      loading = false,
      loadingState = 'idle',
      loadingText,
      successText,
      errorText,
      icon,
      showSuccessIcon = true,
      showErrorIcon = true,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const isLoading = loading || loadingState === 'loading';
    const isSuccess = loadingState === 'success';
    const isError = loadingState === 'error';

    const getContent = () => {
      if (isLoading) {
        return (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {loadingText || 'Carregando...'}
          </>
        );
      }

      if (isSuccess && showSuccessIcon) {
        return (
          <>
            <Check className="h-4 w-4 mr-2 text-success" />
            {successText || children}
          </>
        );
      }

      if (isError && showErrorIcon) {
        return (
          <>
            <X className="h-4 w-4 mr-2 text-destructive" />
            {errorText || children}
          </>
        );
      }

      return (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {children}
        </>
      );
    };

    return (
      <Button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'transition-all duration-200',
          isSuccess && 'bg-success hover:bg-success/90',
          isError && 'bg-destructive hover:bg-destructive/90',
          className
        )}
        {...props}
      >
        {getContent()}
      </Button>
    );
  }
);

LoadingButton.displayName = 'LoadingButton';

