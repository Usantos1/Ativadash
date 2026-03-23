import { useAuthStore } from "@/stores/auth-store";
import { API_BASE } from "./api";
import type { MetricsDateRange } from "./integrations-api";

export type MarketingDashboardDerived = {
  ctrPct: number | null;
  cpc: number | null;
  cpm: number | null;
  linkCtrPct: number | null;
  linkCpc: number | null;
  cplLeads: number | null;
  costPerPurchase: number | null;
  roas: number | null;
  frequency: number | null;
  frequencySource: "api" | "computed_impressions_over_reach" | null;
  clickToLeadRate: number | null;
  leadToPurchaseRate: number | null;
};

export type MarketingDashboardSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number | null;
  linkClicksReturned: boolean;
  reach: number | null;
  reachNote: "period_account_level" | "sum_daily_per_account" | "unavailable" | null;
  frequency: number | null;
  frequencySource: "api" | "computed_impressions_over_reach" | null;
  leads: number;
  purchases: number;
  purchaseValue: number;
  messagingConversations: number;
  landingPageViews: number;
  initiateCheckout: number;
  addToCart: number;
  completeRegistration: number;
  derived: MarketingDashboardDerived;
  reconciliation: {
    spendFromTimeseries: number;
    spendMatchesSummary: boolean;
    impressionsMatches: boolean;
    clicksMatches: boolean;
  };
};

export type MarketingDashboardTimeseriesRow = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number | null;
  leads: number;
  purchases: number;
  purchaseValue: number;
  ctrPct: number | null;
  cpc: number | null;
};

export type MarketingDashboardPerfRow = {
  id: string;
  name: string;
  /** Campanha (conjuntos) ou conjunto (anúncios) */
  parentName: string | null;
  objective: string | null;
  spend: number;
  impressions: number;
  reach: number | null;
  reachReturned: boolean;
  clicks: number;
  linkClicks: number | null;
  ctrPct: number | null;
  cpc: number | null;
  leads: number;
  cpl: number | null;
  purchases: number;
  purchaseValue: number;
  roas: number | null;
  messagingConversations: number;
  landingPageViews: number;
  initiateCheckout: number;
  addToCart: number;
  completeRegistration: number;
};

export type MarketingDashboardPayload =
  | {
      ok: true;
      range: { start: string; end: string };
      summary: MarketingDashboardSummary;
      timeseries: MarketingDashboardTimeseriesRow[];
      distribution: {
        byPlatform: { platform: string; spendSharePct: number; spend: string }[];
        byTemperature: { segment: "hot" | "cold"; spend: number; spendSharePct: number; volume: number }[];
        byScore: { A: number; B: number; C: number; D: number };
      };
      performanceByLevel: {
        campaigns: MarketingDashboardPerfRow[];
        adsets: MarketingDashboardPerfRow[];
        ads: MarketingDashboardPerfRow[];
      };
      integrationStatus: {
        metaAds: { connected: boolean; healthy: boolean };
        googleAds: {
          connected: boolean;
          status: "pending_approval" | "connected" | "not_connected";
        };
      };
    }
  | { ok: false; message: string };

function metricsQuery(range: MetricsDateRange): string {
  return new URLSearchParams({
    startDate: range.startDate,
    endDate: range.endDate,
  }).toString();
}

function errorMessageFromBody(parsed: unknown, fallback: string): string {
  if (parsed && typeof parsed === "object" && "message" in parsed) {
    const m = (parsed as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

/**
 * Carrega o painel agregado sem tratar 4xx/5xx como “falha de rede”:
 * o backend costuma responder JSON com `{ message }` e o dashboard precisa exibir isso.
 */
export async function fetchMarketingDashboard(range: MetricsDateRange): Promise<MarketingDashboardPayload> {
  const token = useAuthStore.getState().accessToken;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

  const url = `${API_BASE}/marketing/dashboard?${metricsQuery(range)}`;

  try {
    const res = await fetch(url, { headers });

    if (res.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = "/login";
      return { ok: false, message: "Sessão expirada. Faça login novamente." };
    }

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      return {
        ok: false,
        message: res.ok
          ? "Resposta inválida do servidor para o painel agregado."
          : `Erro ${res.status}: ${res.statusText}`,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        message: errorMessageFromBody(parsed, res.statusText || "Erro ao carregar o painel agregado."),
      };
    }

    if (parsed && typeof parsed === "object" && "ok" in parsed) {
      return parsed as MarketingDashboardPayload;
    }

    return { ok: false, message: "Resposta inesperada do servidor para o painel agregado." };
  } catch (e) {
    const hint = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: `Não foi possível contatar o servidor para o painel agregado. ${hint}`,
    };
  }
}
