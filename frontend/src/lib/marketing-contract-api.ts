/**
 * Rotas canônicas do contrato (§9) — mesmo cache/escopo que /marketing/dashboard/*.
 * Use para novas telas ou integrações; o app legado pode continuar em marketing-dashboard-api.
 */
import { api } from "./api";
import type { MetricsDateRange } from "./integrations-api";
import type { MarketingDashboardGoalContext } from "./business-goal-mode";
import type {
  MarketingDashboardDerived,
  MarketingDashboardPayload,
  MarketingDashboardPerfRow,
  MarketingDashboardSummary,
  MarketingDashboardTimeseriesRow,
} from "./marketing-dashboard-api";

function rangeQuery(range: MetricsDateRange, refresh?: boolean, extra?: Record<string, string>): string {
  const p = new URLSearchParams({
    startDate: range.startDate,
    endDate: range.endDate,
  });
  if (refresh) p.set("refresh", "1");
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== "") p.set(k, v);
    }
  }
  return p.toString();
}

export type MarketingSummaryContractResponse =
  | {
      ok: true;
      range: { start: string; end: string };
      summary: MarketingDashboardSummary;
      derived: MarketingDashboardDerived;
      compare: null;
      distribution: Extract<MarketingDashboardPayload, { ok: true }>["distribution"];
      goalContext?: MarketingDashboardGoalContext;
    }
  | { ok: false; message: string };

export async function fetchMarketingSummaryContract(
  range: MetricsDateRange,
  refresh?: boolean
): Promise<MarketingSummaryContractResponse> {
  return api.get(`/marketing/summary?${rangeQuery(range, refresh)}`);
}

export type MarketingTimeseriesContractResponse =
  | { ok: true; range: { start: string; end: string }; points: MarketingDashboardTimeseriesRow[] }
  | { ok: false; message: string };

export async function fetchMarketingTimeseriesContract(
  range: MetricsDateRange,
  refresh?: boolean
): Promise<MarketingTimeseriesContractResponse> {
  return api.get(`/marketing/timeseries?${rangeQuery(range, refresh)}`);
}

export type MarketingFunnelStep = { key: string; label: string; value: number };
export type MarketingFunnelTransition = { from: string; to: string; rate: number | null };

export type MarketingFunnelContractResponse =
  | {
      ok: true;
      range: { start: string; end: string };
      steps: MarketingFunnelStep[];
      transitions: MarketingFunnelTransition[];
      distribution: {
        byPlatform: { platform: string; spendSharePct: number; spend: string }[];
        byTemperature: { segment: "hot" | "cold"; spend: number; spendSharePct: number; volume: number }[];
        byScore: { A: number; B: number; C: number; D: number };
      };
    }
  | { ok: false; message: string };

export async function fetchMarketingFunnelContract(
  range: MetricsDateRange,
  refresh?: boolean
): Promise<MarketingFunnelContractResponse> {
  return api.get(`/marketing/funnel?${rangeQuery(range, refresh)}`);
}

export type MarketingDetailCampaignsResponse =
  | {
      ok: true;
      range: { start: string; end: string };
      channel: string;
      source: string;
      rows: MarketingDashboardPerfRow[];
      page: { index: number; size: number; total: number };
    }
  | { ok: false; message: string };

export async function fetchMarketingDetailCampaigns(
  range: MetricsDateRange,
  opts?: { page?: number; pageSize?: number; channel?: string; refresh?: boolean }
): Promise<MarketingDetailCampaignsResponse> {
  const extra: Record<string, string> = {};
  if (opts?.page != null) extra.page = String(opts.page);
  if (opts?.pageSize != null) extra.pageSize = String(opts.pageSize);
  if (opts?.channel) extra.channel = opts.channel;
  return api.get(`/marketing/detail/campaigns?${rangeQuery(range, opts?.refresh, extra)}`);
}

export type MarketingAlertsInsightResponse =
  | {
      ok: true;
      range: { start: string; end: string };
      kpis: { cpa: number | null; roas: number | null };
      alerts: Array<{
        severity: string;
        code: string;
        title: string;
        message: string;
      }>;
      periodLabel: string;
    }
  | { ok: false; message: string; alerts?: []; kpis?: { cpa: null; roas: null }; periodLabel?: string };

export async function fetchMarketingAlertsInsight(
  range: MetricsDateRange,
  refresh?: boolean
): Promise<MarketingAlertsInsightResponse> {
  return api.get(`/marketing/alerts/insight?${rangeQuery(range, refresh)}`);
}

/** Contrato §10: status da campanha Meta (PAUSED | ACTIVE). */
export async function patchMarketingMetaCampaignStatus(
  externalId: string,
  status: "PAUSED" | "ACTIVE"
): Promise<void> {
  const enc = encodeURIComponent(externalId);
  await api.patch(`/marketing/meta/campaigns/${enc}/status`, { status });
}

/** Contrato §10: orçamento diário na moeda principal da conta (ex.: BRL). */
export async function patchMarketingMetaCampaignBudget(externalId: string, dailyBudget: number): Promise<void> {
  const enc = encodeURIComponent(externalId);
  await api.patch(`/marketing/meta/campaigns/${enc}/budget`, { dailyBudget });
}

/** Contrato §10: status da campanha Google (ENABLED | PAUSED). */
export async function patchMarketingGoogleCampaignStatus(
  externalId: string,
  status: "ENABLED" | "PAUSED"
): Promise<void> {
  const enc = encodeURIComponent(externalId);
  await api.patch(`/marketing/google/campaigns/${enc}/status`, { status });
}

export type MarketingRollbackItem =
  | { channel: "meta"; externalId: string; metaStatus: "PAUSED" | "ACTIVE" }
  | { channel: "meta"; externalId: string; dailyBudget: number }
  | { channel: "google"; externalId: string; googleStatus: "ENABLED" | "PAUSED" };

export async function postMarketingCampaignRollback(items: MarketingRollbackItem[]): Promise<{
  ok: boolean;
  applied?: number;
  errors?: string[];
}> {
  return api.post("/marketing/campaign-mutations/rollback", { items });
}
