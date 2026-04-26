import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost')) 
  ? import.meta.env.VITE_API_URL 
  : 'https://api.ativafix.com/api';

// Interfaces
export interface DashboardExecutivo {
  kpis: {
    totalPDV: number;
    totalOS: number;
    totalGeral: number;
    quantidadePDV: number;
    quantidadeOS: number;
    ticketMedioPDV: number;
    ticketMedioOS: number;
  };
  topProdutos: Array<{
    id: string;
    nome: string;
    quantidadeVendida: number;
    receitaTotal: number;
    lucroTotal: number;
    margem: number;
  }>;
  topVendedores: Array<{
    id: string;
    nome: string;
    totalVendas: number;
    totalVendido: number;
    ticketMedio: number;
  }>;
  tendencia: Array<{
    data: string;
    totalPDV: number;
    totalOS: number;
    totalGeral: number;
  }>;
  recomendacoes: any[];
}

export interface VendedorAnalise {
  id: string;
  nome: string;
  vendasPDV: number;
  vendasOS: number;
  totalVendas: number;
  totalVendido: number;
  ticketMedio: number;
  primeiraVenda: string;
  ultimaVenda: string;
}

export interface ProdutoAnalise {
  id: string;
  nome: string;
  codigo: string;
  estoqueAtual: number;
  quantidadeVendida: number;
  receitaTotal: number;
  custoTotal: number;
  lucroTotal: number;
  margemPercentual: number;
  precoMedioVenda: number;
}

export interface RecomendacaoEstoque {
  produtoId: string;
  produtoNome: string;
  produtoCodigo: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  vendaMediaDiaria: number;
  quantidadeSugerida: number;
  diasRestantes: number;
  prioridade: number;
}

export interface PrevisaoVendas {
  historico: Array<{
    data: string;
    valorReal: number;
  }>;
  previsoes: Array<{
    data: string;
    valorPrevisto: number;
    intervaloConfiancaMin: number;
    intervaloConfiancaMax: number;
    confiancaPercentual: number;
  }>;
}

// Helper para fazer requisições autenticadas
async function fetchFinanceiro(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    throw new Error('Token de autenticação não encontrado');
  }
  
  const response = await fetch(`${API_URL}/financeiro${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro na requisição' }));
    throw new Error(error.error || 'Erro ao buscar dados');
  }
  
  return response.json();
}

// Hook: Dashboard Executivo
export function useDashboardExecutivo(startDate?: string, endDate?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['financeiro', 'dashboard', startDate, endDate],
    queryFn: async (): Promise<DashboardExecutivo> => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const data = await fetchFinanceiro(`/dashboard?${params.toString()}`);
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 min – evita refetch excessivo; refresh manual ainda funciona
    placeholderData: (previousData) => previousData, // mantém dados anteriores ao recarregar (sem piscar)
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// Hook: Análise de Vendedores
export function useAnaliseVendedores(startDate?: string, endDate?: string, vendedorId?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['financeiro', 'vendedores', 'analise', startDate, endDate, vendedorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (vendedorId) params.append('vendedorId', vendedorId);
      
      const data = await fetchFinanceiro(`/vendedores/analise?${params.toString()}`);
      return data.vendedores as VendedorAnalise[];
    },
    enabled: !!user,
  });
}

// Hook: Análise de Produtos
export function useAnaliseProdutos(startDate?: string, endDate?: string, produtoId?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['financeiro', 'produtos', 'analise', startDate, endDate, produtoId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (produtoId) params.append('produtoId', produtoId);
      
      const data = await fetchFinanceiro(`/produtos/analise?${params.toString()}`);
      return data.produtos as ProdutoAnalise[];
    },
    enabled: !!user,
  });
}

// Hook: Análise Temporal
export function useAnaliseTemporal(startDate?: string, endDate?: string, groupBy?: 'hora' | 'dia_semana') {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['financeiro', 'temporal', startDate, endDate, groupBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (groupBy) params.append('groupBy', groupBy);
      
      return await fetchFinanceiro(`/temporal/analise?${params.toString()}`);
    },
    enabled: !!user,
  });
}

// Hook: Previsões de Vendas
export function usePrevisoesVendas(dias: number = 30) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['financeiro', 'previsoes', 'vendas', dias],
    queryFn: async (): Promise<PrevisaoVendas> => {
      return await fetchFinanceiro(`/previsoes/vendas?dias=${dias}`);
    },
    enabled: !!user,
  });
}

// Hook: Recomendações
export function useRecomendacoes(tipo?: string, status: string = 'pendente') {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['financeiro', 'recomendacoes', tipo, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tipo) params.append('tipo', tipo);
      if (status) params.append('status', status);
      
      const data = await fetchFinanceiro(`/recomendacoes?${params.toString()}`);
      return data.recomendacoes || [];
    },
    enabled: !!user,
  });
}

// Hook: Aplicar Recomendação
export function useAplicarRecomendacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }
      
      const response = await fetch(`${API_URL}/financeiro/recomendacoes/${id}/aplicar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erro ao aplicar recomendação' }));
        throw new Error(error.error || 'Erro ao aplicar recomendação');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro', 'recomendacoes'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro', 'dashboard'] });
    },
  });
}

const RECOMENDACOES_PAGE_SIZE = 20;

// Hook: Recomendações de Estoque (paginado, 20 por página)
export function useRecomendacoesEstoque(page = 1) {
  const { user } = useAuth();
  const offset = (page - 1) * RECOMENDACOES_PAGE_SIZE;

  return useQuery({
    queryKey: ['financeiro', 'estoque', 'recomendacoes', page],
    queryFn: async (): Promise<{ recomendacoes: RecomendacaoEstoque[]; total: number }> => {
      const data = await fetchFinanceiro(`/estoque/recomendacoes?limit=${RECOMENDACOES_PAGE_SIZE}&offset=${offset}`);
      return {
        recomendacoes: data.recomendacoes || [],
        total: data.total ?? 0,
      };
    },
    enabled: !!user,
  });
}

// Hook: DRE
export function useDRE(periodo: string, tipo: 'mensal' | 'anual' = 'mensal') {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['financeiro', 'dre', periodo, tipo],
    queryFn: async () => {
      return await fetchFinanceiro(`/dre/${periodo}?tipo=${tipo}`);
    },
    enabled: !!user && !!periodo,
  });
}

// Hook: Planejamento Anual (retorna null quando não há registro – backend retorna 200 + null)
export function usePlanejamentoAnual(ano: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['financeiro', 'planejamento', ano],
    queryFn: async () => {
      const data = await fetchFinanceiro(`/planejamento/${ano}`);
      return data.planejamento ?? null;
    },
    enabled: !!user && !!ano,
    staleTime: 2 * 60 * 1000, // 2 min – evita refetch a cada foco na janela
  });
}

// Hook: Salvar Planejamento Anual
export function useSalvarPlanejamentoAnual() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ ano, dados }: { ano: number; dados: any }) => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }
      
      const response = await fetch(`${API_URL}/financeiro/planejamento/${ano}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(dados),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erro ao salvar planejamento' }));
        throw new Error(error.error || 'Erro ao salvar planejamento');
      }
      
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['financeiro', 'planejamento', variables.ano] });
    },
  });
}

// Hook: Sugerir Preço
export function useSugerirPreco() {
  return useMutation({
    mutationFn: async ({ produtoId, margemDesejada }: { produtoId: string; margemDesejada?: number }) => {
      const response = await fetch(`${API_URL}/financeiro/precificacao/sugerir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          produto_id: produtoId,
          margem_desejada: margemDesejada,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erro ao sugerir preço' }));
        throw new Error(error.error || 'Erro ao sugerir preço');
      }
      
      return response.json();
    },
  });
}
