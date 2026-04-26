import { useToast } from '@/hooks/use-toast';
import { logger } from '@/utils/logger';

interface ErrorHandlerOptions {
  showToast?: boolean;
  logError?: boolean;
  context?: string;
  fallbackMessage?: string;
}

export function useErrorHandler() {
  const { toast } = useToast();

  const handleError = (
    error: unknown,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      showToast = true,
      logError = true,
      context,
      fallbackMessage = 'Ocorreu um erro inesperado. Tente novamente.',
    } = options;

    // Extrair mensagem do erro
    let errorMessage = fallbackMessage;
    if (error instanceof Error) {
      errorMessage = error.message || fallbackMessage;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    }

    // Log do erro
    if (logError) {
      logger.error(errorMessage, error, context);
    }

    // Mostrar toast
    if (showToast) {
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    }

    return errorMessage;
  };

  const handleSuccess = (message: string, title: string = 'Sucesso!') => {
    toast({
      title,
      description: message,
    });
  };

  return {
    handleError,
    handleSuccess,
  };
}









