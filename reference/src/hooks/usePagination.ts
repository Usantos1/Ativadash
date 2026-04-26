import { useState, useMemo, useCallback } from 'react';

interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  totalItems?: number;
}

interface UsePaginationReturn<T> {
  // Estado
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  
  // Dados paginados
  paginatedData: T[];
  startIndex: number;
  endIndex: number;
  
  // Navegação
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  
  // Configuração
  setPageSize: (size: number) => void;
  setTotalItems: (total: number) => void;
  
  // Helpers
  canGoNext: boolean;
  canGoPrev: boolean;
  pageNumbers: number[];
  isFirstPage: boolean;
  isLastPage: boolean;
}

/**
 * Hook para paginação de dados no cliente
 */
export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const {
    initialPage = 1,
    initialPageSize = 10,
    totalItems: externalTotalItems,
  } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [internalTotalItems, setInternalTotalItems] = useState(0);

  const totalItems = externalTotalItems ?? data.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Calcular índices
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  // Dados paginados
  const paginatedData = useMemo(() => {
    return data.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex]);

  // Navegação
  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage, totalPages]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage]);

  const firstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const lastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  // Helpers
  const canGoNext = currentPage < totalPages;
  const canGoPrev = currentPage > 1;
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  // Gerar números de página para exibição
  const pageNumbers = useMemo(() => {
    const delta = 2; // Páginas antes e depois da atual
    const range: number[] = [];
    const rangeWithDots: number[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        range.push(i);
      }
    }

    for (const i of range) {
      if (l !== undefined) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push(-1); // -1 representa "..."
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  }, [currentPage, totalPages]);

  // Resetar para primeira página quando o tamanho muda
  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedData,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    setPageSize: handleSetPageSize,
    setTotalItems: setInternalTotalItems,
    canGoNext,
    canGoPrev,
    pageNumbers,
    isFirstPage,
    isLastPage,
  };
}

/**
 * Hook para paginação no servidor (offset-based)
 */
export function useServerPagination(options: {
  initialPage?: number;
  initialPageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
}) {
  const { initialPage = 1, initialPageSize = 10, onPageChange } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalItems, setTotalItems] = useState(0);

  const totalPages = Math.ceil(totalItems / pageSize);
  const offset = (currentPage - 1) * pageSize;

  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages || 1));
    setCurrentPage(validPage);
    onPageChange?.(validPage, pageSize);
  }, [totalPages, pageSize, onPageChange]);

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    onPageChange?.(1, size);
  }, [onPageChange]);

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    offset,
    limit: pageSize,
    setTotalItems,
    goToPage,
    setPageSize: handleSetPageSize,
    nextPage: () => goToPage(currentPage + 1),
    prevPage: () => goToPage(currentPage - 1),
    canGoNext: currentPage < totalPages,
    canGoPrev: currentPage > 1,
  };
}

