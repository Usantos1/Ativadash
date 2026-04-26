import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook para debounce de valores
 * Útil para campos de busca e inputs que disparam requests
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook para callback com debounce
 * Útil quando precisa controlar quando a função é chamada
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Manter referência atualizada do callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );

  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * Hook para busca com debounce integrado
 */
export function useSearch<T>(
  searchFn: (term: string) => Promise<T>,
  delay: number = 300
) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<T | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debouncedTerm = useDebounce(searchTerm, delay);

  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedTerm.trim()) {
        setResults(null);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const data = await searchFn(debouncedTerm);
        setResults(data);
      } catch (err: any) {
        setError(err.message || 'Erro na busca');
        setResults(null);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedTerm, searchFn]);

  return {
    searchTerm,
    setSearchTerm,
    results,
    isSearching,
    error,
    debouncedTerm,
  };
}

