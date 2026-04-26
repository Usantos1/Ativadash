import { useState, useCallback, useRef, useEffect } from 'react';
import { useErrorHandler } from './useErrorHandler';

type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseAsyncOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  showToastOnError?: boolean;
  errorContext?: string;
}

interface UseAsyncReturn<T, P extends any[]> {
  data: T | null;
  error: Error | null;
  status: AsyncStatus;
  isIdle: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  execute: (...params: P) => Promise<T | null>;
  reset: () => void;
  setData: (data: T | null) => void;
}

/**
 * Hook para gerenciar operações assíncronas de forma padronizada
 */
export function useAsync<T, P extends any[] = []>(
  asyncFunction: (...params: P) => Promise<T>,
  options: UseAsyncOptions = {}
): UseAsyncReturn<T, P> {
  const {
    immediate = false,
    onSuccess,
    onError,
    showToastOnError = true,
    errorContext,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const { handleError } = useErrorHandler();

  // Ref para cancelar operações pendentes ao desmontar
  const mountedRef = useRef(true);
  const currentRequestRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...params: P): Promise<T | null> => {
      const requestId = ++currentRequestRef.current;
      
      setStatus('loading');
      setError(null);

      try {
        const result = await asyncFunction(...params);
        
        // Verificar se ainda é a requisição mais recente e se o componente está montado
        if (requestId === currentRequestRef.current && mountedRef.current) {
          setData(result);
          setStatus('success');
          onSuccess?.(result);
          return result;
        }
        return null;
      } catch (err: any) {
        if (requestId === currentRequestRef.current && mountedRef.current) {
          const error = err instanceof Error ? err : new Error(err?.message || 'Erro desconhecido');
          setError(error);
          setStatus('error');
          
          if (showToastOnError) {
            handleError(error, {
              context: errorContext,
              showToast: true,
            });
          }
          
          onError?.(error);
        }
        return null;
      }
    },
    [asyncFunction, onSuccess, onError, showToastOnError, errorContext, handleError]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setStatus('idle');
  }, []);

  // Executar imediatamente se configurado
  useEffect(() => {
    if (immediate) {
      execute(...([] as unknown as P));
    }
  }, [immediate]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    error,
    status,
    isIdle: status === 'idle',
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    execute,
    reset,
    setData,
  };
}

/**
 * Hook para múltiplas operações assíncronas paralelas
 */
export function useAsyncParallel<T>(
  asyncFunctions: Array<() => Promise<T>>,
  options: UseAsyncOptions = {}
) {
  const [results, setResults] = useState<Array<T | null>>([]);
  const [errors, setErrors] = useState<Array<Error | null>>([]);
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const { handleError } = useErrorHandler();

  const execute = useCallback(async () => {
    setStatus('loading');
    setErrors([]);

    try {
      const promises = asyncFunctions.map((fn, index) =>
        fn()
          .then((result) => ({ index, result, error: null }))
          .catch((err) => ({ index, result: null, error: err }))
      );

      const outcomes = await Promise.all(promises);
      
      const newResults: Array<T | null> = [];
      const newErrors: Array<Error | null> = [];
      
      outcomes.forEach(({ index, result, error }) => {
        newResults[index] = result;
        newErrors[index] = error;
      });

      setResults(newResults);
      setErrors(newErrors);
      
      const hasErrors = newErrors.some((e) => e !== null);
      setStatus(hasErrors ? 'error' : 'success');
      
      if (hasErrors && options.showToastOnError) {
        const firstError = newErrors.find((e) => e !== null);
        if (firstError) {
          handleError(firstError, { context: options.errorContext });
        }
      }

      return newResults;
    } catch (err: any) {
      setStatus('error');
      if (options.showToastOnError) {
        handleError(err, { context: options.errorContext });
      }
      return [];
    }
  }, [asyncFunctions, options.showToastOnError, options.errorContext, handleError]);

  return {
    results,
    errors,
    status,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    execute,
  };
}

/**
 * Hook para operação assíncrona com retry automático
 */
export function useAsyncWithRetry<T, P extends any[] = []>(
  asyncFunction: (...params: P) => Promise<T>,
  options: UseAsyncOptions & { maxRetries?: number; retryDelay?: number } = {}
) {
  const { maxRetries = 3, retryDelay = 1000, ...asyncOptions } = options;
  const [retryCount, setRetryCount] = useState(0);

  const executeWithRetry = useCallback(
    async (...params: P): Promise<T> => {
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await asyncFunction(...params);
          setRetryCount(0);
          return result;
        } catch (err: any) {
          lastError = err instanceof Error ? err : new Error(err?.message || 'Erro');
          setRetryCount(attempt + 1);
          
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
          }
        }
      }
      
      throw lastError;
    },
    [asyncFunction, maxRetries, retryDelay]
  );

  const asyncState = useAsync(executeWithRetry, asyncOptions);

  return {
    ...asyncState,
    retryCount,
  };
}

