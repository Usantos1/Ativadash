import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/integrations/api/client';

export type ServerReportTabKey =
  | 'payments'
  | 'products'
  | 'purchases'
  | 'stock'
  | 'assistencia'
  | 'refunds'
  | 'clients'
  | 'cash'
  | 'cancellations'
  | 'followup'
  | 'audit';

export type PaymentMethodRow = {
  forma_pagamento: string;
  payment_count: number;
  total_amount: string | number;
};

export type TopProductRow = {
  produto_id: string | null;
  produto_nome: string;
  qty: string | number;
  revenue: string | number;
};

export type PedidoRow = {
  id: string;
  nome: string;
  recebido: boolean;
  created_at: string;
  valor_compra_total: string | number;
};

export type FornecedorOsRow = {
  fornecedor: string;
  itens_count: number;
  valor_total: string | number;
};

export type StockMovRow = {
  id: string;
  tipo: string;
  motivo: string | null;
  quantidade_delta: number | null;
  quantidade_antes: number | null;
  quantidade_depois: number | null;
  created_at: string;
  user_nome: string | null;
  produto_nome: string;
};

export type OsStatusRow = { status: string; cnt: number };

export type CashTotals = {
  total_sessions: number;
  open_sessions: number;
  closed_sessions: number;
  total_inicial: string | number;
  total_final: string | number;
  total_esperado: string | number;
  total_divergencia: string | number;
};

export type CashOperatorRow = {
  operador: string;
  sessions_count: number;
  open_count: number;
  closed_count: number;
  valor_inicial: string | number;
  valor_final: string | number;
  valor_esperado: string | number;
  divergencia: string | number;
};

export type CashMovementTypeRow = {
  tipo: string;
  cnt: number;
  total: string | number;
};

export type CashSessionRow = {
  id: string;
  numero: number;
  operador_nome: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  valor_inicial: string | number;
  valor_final: string | number | null;
  valor_esperado: string | number | null;
  divergencia: string | number | null;
};

export type CancelReasonRow = {
  reason: string;
  cnt: number;
  valor?: string | number;
};

export type RecentCanceledSaleRow = {
  id: string;
  numero: number;
  cliente_nome: string | null;
  vendedor_nome: string | null;
  cancel_reason: string | null;
  canceled_at: string;
  total: string | number;
};

export type FollowupTotals = {
  total_jobs: number;
  sent_jobs: number;
  pending_jobs: number;
  error_jobs: number;
  cancelled_jobs: number;
};

export type FollowupStatusRow = { status: string; cnt: number };

export type FollowupRuleRow = { tipo_regra_envio: string; cnt: number };

export type FollowupJobRow = {
  id: string;
  ordem_servico_id: string;
  telefone: string | null;
  status: string;
  tipo_regra_envio: string;
  scheduled_at: string;
  sent_at: string | null;
  faturado_at: string;
  error_message: string | null;
  skip_reason: string | null;
  random_delay_seconds: number;
  created_at: string;
};

function qstart(start?: string, end?: string) {
  return !!start && !!end;
}

async function getJson(path: string) {
  const { data, error } = await apiClient.get(path);
  if (error) throw new Error(typeof error === 'string' ? error : 'Erro na API');
  if (!data?.success) throw new Error(data?.error || 'Resposta inválida');
  return data;
}

export function useServerReportsQueries(
  startDate: string | undefined,
  endDate: string | undefined,
  activeTab: string,
  isAdmin: boolean
) {
  const base = qstart(startDate, endDate);
  const qs = `startDate=${encodeURIComponent(startDate!)}&endDate=${encodeURIComponent(endDate!)}`;

  const paymentMethods = useQuery({
    queryKey: ['server-report', 'payment-methods', startDate, endDate],
    queryFn: async () => (await getJson(`/reports/payment-methods?${qs}`)).rows as PaymentMethodRow[],
    enabled: base && activeTab === 'payments',
  });

  const topProducts = useQuery({
    queryKey: ['server-report', 'top-products', startDate, endDate],
    queryFn: async () => (await getJson(`/reports/top-products?${qs}&limit=50`)).rows as TopProductRow[],
    enabled: base && activeTab === 'products',
  });

  const purchases = useQuery({
    queryKey: ['server-report', 'purchases', startDate, endDate],
    queryFn: async () => {
      const d = await getJson(`/reports/purchases-suppliers?${qs}`);
      return {
        pedidos: d.pedidos as PedidoRow[],
        fornecedores_os: d.fornecedores_os as FornecedorOsRow[],
      };
    },
    enabled: base && activeTab === 'purchases',
  });

  const stock = useQuery({
    queryKey: ['server-report', 'stock', startDate, endDate],
    queryFn: async () => (await getJson(`/reports/stock-movements?${qs}&limit=400`)).rows as StockMovRow[],
    enabled: base && activeTab === 'stock',
  });

  const osOverview = useQuery({
    queryKey: ['server-report', 'os', startDate, endDate],
    queryFn: async () => {
      const d = await getJson(`/reports/os-overview?${qs}`);
      return {
        by_status: d.by_status as OsStatusRow[],
        totals: d.totals as { total_os: number; valor_total_orcado: string | number },
      };
    },
    enabled: base && activeTab === 'assistencia',
  });

  const refunds = useQuery({
    queryKey: ['server-report', 'refunds', startDate, endDate],
    queryFn: async () => {
      const d = await getJson(`/reports/refunds-summary?${qs}`);
      return {
        by_status: d.by_status as { status: string; cnt: number; valor: string | number }[],
        by_reason: d.by_reason as { reason: string; cnt: number; valor: string | number }[],
      };
    },
    enabled: base && activeTab === 'refunds',
  });

  const clients = useQuery({
    queryKey: ['server-report', 'clients', startDate, endDate],
    queryFn: async () => {
      const d = await getJson(`/reports/clients-summary?${qs}`);
      return {
        novos_clientes: d.novos_clientes as number,
        clientes_compra_distintos: d.clientes_compra_distintos as number,
        vendas_finalizadas: d.vendas_finalizadas as number,
      };
    },
    enabled: base && activeTab === 'clients',
  });

  const cash = useQuery({
    queryKey: ['server-report', 'cash', startDate, endDate],
    queryFn: async () => {
      const d = await getJson(`/reports/cash-overview?${qs}`);
      return {
        totals: d.totals as CashTotals,
        by_operator: d.by_operator as CashOperatorRow[],
        by_movement_type: d.by_movement_type as CashMovementTypeRow[],
        recent_sessions: d.recent_sessions as CashSessionRow[],
      };
    },
    enabled: base && activeTab === 'cash',
  });

  const cancellations = useQuery({
    queryKey: ['server-report', 'cancellations', startDate, endDate],
    queryFn: async () => {
      const d = await getJson(`/reports/sales-cancellations?${qs}`);
      return {
        totals: d.totals as {
          canceled_sales: number;
          canceled_total: string | number;
          total_requests: number;
          pending_requests: number;
          approved_requests: number;
          rejected_requests: number;
        },
        by_reason: d.by_reason as CancelReasonRow[],
        recent_canceled_sales: d.recent_canceled_sales as RecentCanceledSaleRow[],
        request_status: d.request_status as { status: string; cnt: number }[],
        request_reasons: d.request_reasons as CancelReasonRow[],
      };
    },
    enabled: base && activeTab === 'cancellations',
  });

  const followup = useQuery({
    queryKey: ['server-report', 'followup', startDate, endDate],
    queryFn: async () => {
      const d = await getJson(`/reports/post-sales-followup?${qs}`);
      return {
        totals: d.totals as FollowupTotals,
        by_status: d.by_status as FollowupStatusRow[],
        by_rule: d.by_rule as FollowupRuleRow[],
        recent_jobs: d.recent_jobs as FollowupJobRow[],
      };
    },
    enabled: base && activeTab === 'followup',
  });

  const audit = useQuery({
    queryKey: ['server-report', 'audit', startDate, endDate],
    queryFn: async () => {
      const d = await getJson(`/reports/audit-activity?${qs}`);
      return {
        user_activity: d.user_activity as { tipo: string; cnt: number }[],
        audit_logs: d.audit_logs as { tipo: string; cnt: number }[],
      };
    },
    enabled: base && activeTab === 'audit' && isAdmin,
  });

  return {
    paymentMethods,
    topProducts,
    purchases,
    stock,
    osOverview,
    refunds,
    clients,
    cash,
    cancellations,
    followup,
    audit,
  };
}
