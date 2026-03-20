import { api } from "./api";

export interface IntegrationFromApi {
  id: string;
  platform: string;
  slug: string;
  status: string;
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

export async function disconnectIntegration(id: string): Promise<void> {
  await api.delete(`/integrations/${id}`);
}

// Métricas do Google Ads (Marketing)
export interface GoogleAdsMetricsSummary {
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
}

export interface GoogleAdsCampaignRow {
  campaignName: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
}

export interface GoogleAdsMetricsResponse {
  ok: true;
  summary: GoogleAdsMetricsSummary;
  campaigns: GoogleAdsCampaignRow[];
}

export async function fetchGoogleAdsMetrics(period: "7d" | "30d" | "90d" = "30d"): Promise<GoogleAdsMetricsResponse | null> {
  try {
    const res = await api.get<GoogleAdsMetricsResponse | { ok: false; message: string }>(
      `/marketing/google-ads/metrics?period=${period}`
    );
    if ("ok" in res && res.ok === false) return null;
    return res as GoogleAdsMetricsResponse;
  } catch {
    return null;
  }
}
