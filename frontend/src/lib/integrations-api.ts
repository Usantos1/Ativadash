import { api } from "./api";

export interface IntegrationFromApi {
  id: string;
  platform: string;
  slug: string;
  status: string;
  clientAccountId: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

export async function fetchIntegrations(): Promise<IntegrationFromApi[]> {
  const res = await api.get<{ integrations: IntegrationFromApi[] }>("/integrations");
  return res.integrations;
}

export async function getGoogleAdsAuthUrl(): Promise<string> {
  const res = await api.get<{ url: string }>("/integrations/google-ads/auth-url");
  return res.url;
}

export async function getMetaAdsAuthUrl(): Promise<string> {
  const res = await api.get<{ url: string }>("/integrations/meta-ads/auth-url");
  return res.url;
}

export async function disconnectIntegration(id: string): Promise<void> {
  await api.delete(`/integrations/${id}`);
}

export async function patchIntegrationClientAccount(
  integrationId: string,
  clientAccountId: string | null
): Promise<{ id: string; clientAccountId: string | null }> {
  return api.patch(`/integrations/${integrationId}/client`, { clientAccountId });
}

// Métricas do Google Ads (Marketing)
export interface GoogleAdsMetricsSummary {
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionsValue: number;
}

export interface GoogleAdsCampaignRow {
  campaignName: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionsValue: number;
}

export interface GoogleAdsDailyRow {
  date: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
}

export interface GoogleAdsMetricsResponse {
  ok: true;
  summary: GoogleAdsMetricsSummary;
  campaigns: GoogleAdsCampaignRow[];
  /** Série diária (ausente em respostas antigas). */
  daily?: GoogleAdsDailyRow[];
}

export type GoogleAdsMetricsResult = GoogleAdsMetricsResponse | { ok: false; message: string };

/** Intervalo em YYYY-MM-DD (fuso da conta / backend). */
export type MetricsDateRange = { startDate: string; endDate: string };

function metricsQuery(range: MetricsDateRange): string {
  const q = new URLSearchParams({
    startDate: range.startDate,
    endDate: range.endDate,
  });
  return q.toString();
}

export async function fetchGoogleAdsMetrics(
  range: MetricsDateRange
): Promise<GoogleAdsMetricsResult | null> {
  try {
    const res = await api.get<GoogleAdsMetricsResult>(
      `/marketing/google-ads/metrics?${metricsQuery(range)}`
    );
    return res;
  } catch {
    return null;
  }
}

// Métricas do Meta Ads (Marketing)
export interface MetaAdsMetricsSummary {
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  purchases: number;
  purchaseValue?: number;
  conversions?: number;
}

export interface MetaAdsCampaignRow {
  campaignName: string;
  campaignId?: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  purchases: number;
  purchaseValue?: number;
  conversions?: number;
}

export interface MetaAdsDailyRow {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  purchases: number;
}

export interface MetaAdsMetricsResponse {
  ok: true;
  summary: MetaAdsMetricsSummary;
  campaigns: MetaAdsCampaignRow[];
  daily?: MetaAdsDailyRow[];
}

export type MetaAdsMetricsResult = MetaAdsMetricsResponse | { ok: false; message: string };

export async function fetchMetaAdsMetrics(
  range: MetricsDateRange
): Promise<MetaAdsMetricsResult | null> {
  try {
    const res = await api.get<MetaAdsMetricsResult>(
      `/marketing/meta-ads/metrics?${metricsQuery(range)}`
    );
    return res;
  } catch {
    return null;
  }
}
