/**
 * Hook para Painel de Alertas — configuração do painel, catálogo, configs por alerta e logs.
 * Todas as chamadas usam company_id do usuário autenticado (multi-tenant).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/utils/apiUrl';

function getHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export interface PanelConfig {
  id?: string;
  company_id?: string;
  nome_painel?: string;
  ativo?: boolean;
  numero_principal?: string;
  numeros_adicionais?: string[];
  horario_inicio_envio?: string;
  horario_fim_envio?: string;
  timezone?: string;
  relatorio_diario_ativo?: boolean;
  horario_relatorio_diario?: string;
  resumo_semanal_ativo?: boolean;
  dia_resumo_semanal?: number;
  horario_resumo_semanal?: string;
  canal_padrao?: string;
}

export interface AlertCatalogItem {
  codigo_alerta: string;
  categoria: string;
  nome: string;
  descricao?: string;
  variaveis_disponiveis?: string[];
  tipo_disparo?: string;
  ativo_por_padrao?: boolean;
  template_padrao?: string;
  prioridade_padrao?: number;
}

export interface AlertConfigItem {
  id?: string;
  company_id?: string;
  codigo_alerta: string;
  ativo?: boolean;
  usar_destinatarios_globais?: boolean;
  numeros_destino?: string[];
  prioridade?: number;
  template_mensagem?: string;
  permitir_edicao_template?: boolean;
}

export interface AlertLogItem {
  id: string;
  codigo_alerta: string;
  categoria?: string;
  destino: string;
  mensagem_final?: string;
  status: string;
  erro?: string;
  enviado_em?: string;
  created_at: string;
}

export function useAlertsPanel() {
  const { session, user } = useAuth();
  const token = session?.token;
  const companyId = user?.company_id;
  const queryClient = useQueryClient();
  const base = `${getApiUrl()}/alerts`;

  const panelQuery = useQuery({
    queryKey: ['alerts', 'panel', companyId],
    queryFn: async () => {
      const res = await fetch(`${base}/panel`, { headers: getHeaders(token) });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<PanelConfig>;
    },
    enabled: !!companyId && !!token,
  });

  const savePanelMutation = useMutation({
    mutationFn: async (data: Partial<PanelConfig>) => {
      const res = await fetch(`${base}/panel`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || res.statusText);
      }
      return res.json() as Promise<PanelConfig>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts', 'panel', companyId] }),
  });

  return {
    panel: panelQuery.data,
    panelLoading: panelQuery.isLoading,
    panelError: panelQuery.error,
    refetchPanel: panelQuery.refetch,
    savePanel: savePanelMutation.mutateAsync,
    savePanelLoading: savePanelMutation.isPending,
  };
}

export function useAlertsCatalog() {
  const { session, user } = useAuth();
  const token = session?.token;
  const companyId = user?.company_id;
  const base = `${getApiUrl()}/alerts`;

  const catalogQuery = useQuery({
    queryKey: ['alerts', 'catalog'],
    queryFn: async () => {
      const res = await fetch(`${base}/catalog`, { headers: getHeaders(token) });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<AlertCatalogItem[]>;
    },
    enabled: !!companyId && !!token,
  });

  return {
    catalog: catalogQuery.data ?? [],
    catalogLoading: catalogQuery.isLoading,
    catalogError: catalogQuery.error,
    refetchCatalog: catalogQuery.refetch,
  };
}

export function useAlertsConfigs() {
  const { session, user } = useAuth();
  const token = session?.token;
  const companyId = user?.company_id;
  const queryClient = useQueryClient();
  const base = `${getApiUrl()}/alerts`;

  const configsQuery = useQuery({
    queryKey: ['alerts', 'configs', companyId],
    queryFn: async () => {
      const res = await fetch(`${base}/configs`, { headers: getHeaders(token) });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<AlertConfigItem[]>;
    },
    enabled: !!companyId && !!token,
  });

  const saveConfigsMutation = useMutation({
    mutationFn: async (configs: Array<{ codigo_alerta: string } & Partial<AlertConfigItem>>) => {
      const res = await fetch(`${base}/configs`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(configs),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || res.statusText);
      }
      return res.json() as Promise<AlertConfigItem[]>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts', 'configs', companyId] }),
  });

  const saveOneConfigMutation = useMutation({
    mutationFn: async ({ codigo, data }: { codigo: string; data: Partial<AlertConfigItem> }) => {
      const res = await fetch(`${base}/configs/${encodeURIComponent(codigo)}`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || res.statusText);
      }
      return res.json() as Promise<AlertConfigItem>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts', 'configs', companyId] }),
  });

  return {
    configs: configsQuery.data ?? [],
    configsLoading: configsQuery.isLoading,
    configsError: configsQuery.error,
    refetchConfigs: configsQuery.refetch,
    saveConfigs: saveConfigsMutation.mutateAsync,
    saveOneConfig: saveOneConfigMutation.mutateAsync,
    saveConfigsLoading: saveConfigsMutation.isPending || saveOneConfigMutation.isPending,
  };
}

export function useAlertsLogs(filters: { periodo_inicio?: string; periodo_fim?: string; categoria?: string; status?: string; codigo_alerta?: string; limit?: number; offset?: number } = {}) {
  const { session, user } = useAuth();
  const token = session?.token;
  const companyId = user?.company_id;
  const base = `${getApiUrl()}/alerts`;
  const params = new URLSearchParams();
  if (filters.periodo_inicio) params.set('periodo_inicio', filters.periodo_inicio);
  if (filters.periodo_fim) params.set('periodo_fim', filters.periodo_fim);
  if (filters.categoria) params.set('categoria', filters.categoria);
  if (filters.status) params.set('status', filters.status);
  if (filters.codigo_alerta) params.set('codigo_alerta', filters.codigo_alerta);
  if (filters.limit != null) params.set('limit', String(filters.limit));
  if (filters.offset != null) params.set('offset', String(filters.offset));
  const qs = params.toString();

  const logsQuery = useQuery({
    queryKey: ['alerts', 'logs', companyId, filters],
    queryFn: async () => {
      const url = qs ? `${base}/logs?${qs}` : `${base}/logs`;
      const res = await fetch(url, { headers: getHeaders(token) });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return { rows: (data.rows ?? []) as AlertLogItem[], total: data.total ?? 0 };
    },
    enabled: !!companyId && !!token,
  });

  return {
    logs: logsQuery.data?.rows ?? [],
    logsTotal: logsQuery.data?.total ?? 0,
    logsLoading: logsQuery.isLoading,
    logsError: logsQuery.error,
    refetchLogs: logsQuery.refetch,
  };
}

export function useAlertsTest() {
  const { session, user } = useAuth();
  const token = session?.token;
  const companyId = user?.company_id;
  const base = `${getApiUrl()}/alerts`;

  const testMutation = useMutation({
    mutationFn: async (body?: { numero?: string; mensagem?: string }) => {
      const res = await fetch(`${base}/test`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || res.statusText);
      return data;
    },
  });

  return {
    sendTest: testMutation.mutateAsync,
    testLoading: testMutation.isPending,
  };
}

export function useAlertsPreview() {
  const { session } = useAuth();
  const token = session?.token;
  const base = `${getApiUrl()}/alerts`;

  const previewMutation = useMutation({
    mutationFn: async ({ template, payload }: { template: string; payload?: Record<string, unknown> }) => {
      const res = await fetch(`${base}/preview`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ template: template ?? '', payload: payload ?? {} }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.mensagem as string;
    },
  });

  return {
    preview: previewMutation.mutateAsync,
    previewLoading: previewMutation.isPending,
  };
}

/** Disparar alerta do Painel de Alertas (ex.: os.criada após abrir uma OS). Não bloqueia em erro. */
export function useAlertsFire() {
  const { session } = useAuth();
  const token = session?.token;
  const base = `${getApiUrl()}/alerts`;

  const fireMutation = useMutation({
    mutationFn: async ({ codigo_alerta, payload }: { codigo_alerta: string; payload?: Record<string, unknown> }) => {
      const res = await fetch(`${base}/fire`, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({ codigo_alerta, payload: payload ?? {} }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || res.statusText);
      return data;
    },
  });

  return {
    fire: fireMutation.mutateAsync,
    fireLoading: fireMutation.isPending,
  };
}
