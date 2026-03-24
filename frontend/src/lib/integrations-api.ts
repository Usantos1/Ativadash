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
  campaignId?: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionsValue: number;
}

export interface GoogleAdsAdGroupRow {
  campaignName: string;
  adGroupName: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionsValue: number;
}

export interface GoogleAdsAdRow {
  campaignName: string;
  adGroupName: string;
  adId: string;
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

export type GoogleAdsMetricsErrorCode =
  | "NOT_CONNECTED"
  | "pending_configuration"
  | "api_not_ready"
  | "MISSING_DEVELOPER_TOKEN"
  | "TOKEN_REFRESH_FAILED"
  | "API_PENDING_OR_RESTRICTED"
  | "UNKNOWN";

export type GoogleAdsMetricsResult =
  | GoogleAdsMetricsResponse
  | { ok: false; code: GoogleAdsMetricsErrorCode; message: string };

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

export type GoogleAdsDeepRowsResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; code: GoogleAdsMetricsErrorCode; message: string };

export async function fetchGoogleAdsAdGroups(
  range: MetricsDateRange
): Promise<GoogleAdsDeepRowsResult<GoogleAdsAdGroupRow> | null> {
  try {
    return await api.get<GoogleAdsDeepRowsResult<GoogleAdsAdGroupRow>>(
      `/marketing/google-ads/ad-groups?${metricsQuery(range)}`
    );
  } catch {
    return null;
  }
}

export async function fetchGoogleAdsAds(
  range: MetricsDateRange
): Promise<GoogleAdsDeepRowsResult<GoogleAdsAdRow> | null> {
  try {
    return await api.get<GoogleAdsDeepRowsResult<GoogleAdsAdRow>>(
      `/marketing/google-ads/ads?${metricsQuery(range)}`
    );
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
  reach?: number;
  frequency?: number;
  linkClicks?: number;
  landingPageViews?: number;
  messagingConversationsStarted?: number;
  ctrPct?: number;
  linkCtrPct?: number;
  cpc?: number;
  cpm?: number;
  linkCpc?: number;
  cplLeads?: number;
  costPerPurchase?: number;
  roas?: number;
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
  reach?: number;
  frequency?: number;
  linkClicks?: number;
  landingPageViews?: number;
  messagingConversationsStarted?: number;
}

export interface MetaAdsDailyRow {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  purchases: number;
  linkClicks?: number;
  landingPageViews?: number;
  messagingConversationsStarted?: number;
}

export type MetaAdsetRow = {
  adsetName: string;
  adsetId?: string;
  campaignName?: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  purchases: number;
  purchaseValue?: number;
};

export type MetaAdRow = {
  adName: string;
  adId?: string;
  adsetName?: string;
  campaignName?: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  purchases: number;
  purchaseValue?: number;
};

export type MetaDeepResult<T> = { ok: true; rows: T[] } | { ok: false; message: string };

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

export async function fetchMetaAdsetsMetrics(
  range: MetricsDateRange
): Promise<MetaDeepResult<MetaAdsetRow> | null> {
  try {
    return await api.get<MetaDeepResult<MetaAdsetRow>>(`/marketing/meta-ads/adsets?${metricsQuery(range)}`);
  } catch {
    return null;
  }
}

export async function fetchMetaAdsByAdLevel(
  range: MetricsDateRange
): Promise<MetaDeepResult<MetaAdRow> | null> {
  try {
    return await api.get<MetaDeepResult<MetaAdRow>>(`/marketing/meta-ads/ads?${metricsQuery(range)}`);
  } catch {
    return null;
  }
}
