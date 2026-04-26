import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, X, Filter, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

interface FilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date' | 'dateRange';
  options?: FilterOption[];
  placeholder?: string;
}

interface FilterValues {
  [key: string]: string | undefined;
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: FilterValues;
  onFilterChange: (key: string, value: string | undefined) => void;
  onClearAll: () => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
  className?: string;
}

export function FilterBar({
  filters,
  values,
  onFilterChange,
  onClearAll,
  searchPlaceholder = 'Buscar...',
  searchValue = '',
  onSearchChange,
  showSearch = true,
  className,
}: FilterBarProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);
  const debouncedSearch = useDebounce(localSearch, 300);

  // Atualizar busca quando debounced mudar
  useState(() => {
    if (onSearchChange && debouncedSearch !== searchValue) {
      onSearchChange(debouncedSearch);
    }
  });

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
  };

  const activeFiltersCount = Object.values(values).filter(
    (v) => v !== undefined && v !== '' && v !== 'all'
  ).length;

  const handleClearFilter = (key: string) => {
    onFilterChange(key, undefined);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col sm:flex-row gap-3">
        {showSearch && onSearchChange && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 pr-9"
            />
            {localSearch && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => {
                  setLocalSearch('');
                  onSearchChange('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <div key={filter.key} className="min-w-[140px]">
              {filter.type === 'select' && filter.options && (
                <Select
                  value={values[filter.key] || 'all'}
                  onValueChange={(value) => 
                    onFilterChange(filter.key, value === 'all' ? undefined : value)
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={filter.placeholder || filter.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {filter.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          {option.icon}
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {filter.type === 'text' && (
                <Input
                  placeholder={filter.placeholder || filter.label}
                  value={values[filter.key] || ''}
                  onChange={(e) => 
                    onFilterChange(filter.key, e.target.value || undefined)
                  }
                  className="h-9"
                />
              )}
            </div>
          ))}

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-9 text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar filtros
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount}
              </Badge>
            </Button>
          )}
        </div>
      </div>

      {/* Filtros ativos */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(values)
            .filter(([_, value]) => value !== undefined && value !== '' && value !== 'all')
            .map(([key, value]) => {
              const filter = filters.find((f) => f.key === key);
              const option = filter?.options?.find((o) => o.value === value);
              const label = option?.label || value;

              return (
                <Badge
                  key={key}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  <span className="text-muted-foreground">{filter?.label}:</span>
                  <span>{label}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1 hover:bg-transparent"
                    onClick={() => handleClearFilter(key)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              );
            })}
        </div>
      )}
    </div>
  );
}

/**
 * Hook para gerenciar estado de filtros
 */
export function useFilters<T extends FilterValues>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);

  const setFilter = useCallback((key: keyof T, value: T[keyof T]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilter = useCallback((key: keyof T) => {
    setValues((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const clearAll = useCallback(() => {
    const cleared = Object.keys(values).reduce((acc, key) => {
      acc[key as keyof T] = undefined as T[keyof T];
      return acc;
    }, {} as T);
    setValues(cleared);
  }, [values]);

  const hasActiveFilters = Object.values(values).some(
    (v) => v !== undefined && v !== '' && v !== 'all'
  );

  return {
    values,
    setFilter,
    clearFilter,
    clearAll,
    hasActiveFilters,
    setValues,
  };
}

