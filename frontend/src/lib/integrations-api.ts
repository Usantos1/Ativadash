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

export async function getMetaAdsAuthUrl(): Promise<string> {
  const res = await api.get<{ url: string }>("/integrations/meta-ads/auth-url");
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

export type GoogleAdsMetricsResult = GoogleAdsMetricsResponse | { ok: false; message: string };

export async function fetchGoogleAdsMetrics(period: "7d" | "30d" | "90d" = "30d"): Promise<GoogleAdsMetricsResult | null> {
  try {
    const res = await api.get<GoogleAdsMetricsResult>(
      `/marketing/google-ads/metrics?period=${period}`
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
  conversions?: number;
}

export interface MetaAdsCampaignRow {
  campaignName: string;
  campaignId?: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions?: number;
}

export interface MetaAdsMetricsResponse {
  ok: true;
  summary: MetaAdsMetricsSummary;
  campaigns: MetaAdsCampaignRow[];
}

export type MetaAdsMetricsResult = MetaAdsMetricsResponse | { ok: false; message: string };

export async function fetchMetaAdsMetrics(period: "7d" | "30d" | "90d" = "30d"): Promise<MetaAdsMetricsResult | null> {
  try {
    const res = await api.get<MetaAdsMetricsResult>(
      `/marketing/meta-ads/metrics?period=${period}`
    );
    return res;
  } catch {
    return null;
  }
}
