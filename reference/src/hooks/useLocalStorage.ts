import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para gerenciar estado sincronizado com localStorage
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Função para obter valor inicial
  const getInitialValue = (): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Erro ao ler localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(getInitialValue);

  // Função para atualizar valor
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          // Disparar evento para outras abas
          window.dispatchEvent(
            new StorageEvent('storage', {
              key,
              newValue: JSON.stringify(valueToStore),
            })
          );
        }
      } catch (error) {
        console.warn(`Erro ao salvar localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  // Função para remover valor
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Erro ao remover localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Sincronizar com outras abas
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.warn(`Erro ao parsear storage event para key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue, removeValue];
}

/**
 * Hook para persistir tema (dark/light mode)
 */
export function useThemeStorage() {
  const [theme, setTheme, removeTheme] = useLocalStorage<'light' | 'dark' | 'system'>(
    'theme',
    'system'
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  }, [setTheme]);

  return { theme, setTheme, removeTheme, toggleTheme };
}

/**
 * Hook para persistir preferências do usuário
 */
export function useUserPreferences() {
  const [preferences, setPreferences, removePreferences] = useLocalStorage(
    'user-preferences',
    {
      sidebarCollapsed: false,
      viewMode: 'cards' as 'cards' | 'table' | 'kanban',
      itemsPerPage: 10,
      notifications: true,
    }
  );

  const updatePreference = useCallback(
    <K extends keyof typeof preferences>(key: K, value: typeof preferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    [setPreferences]
  );

  return { preferences, setPreferences, updatePreference, removePreferences };
}

/**
 * Hook para histórico de busca
 */
export function useSearchHistory(maxItems: number = 10) {
  const [history, setHistory, clearHistory] = useLocalStorage<string[]>('search-history', []);

  const addToHistory = useCallback(
    (term: string) => {
      if (!term.trim()) return;
      
      setHistory((prev) => {
        // Remover duplicatas e adicionar no início
        const filtered = prev.filter((item) => item !== term);
        const updated = [term, ...filtered].slice(0, maxItems);
        return updated;
      });
    },
    [setHistory, maxItems]
  );

  const removeFromHistory = useCallback(
    (term: string) => {
      setHistory((prev) => prev.filter((item) => item !== term));
    },
    [setHistory]
  );

  return { history, addToHistory, removeFromHistory, clearHistory };
}

