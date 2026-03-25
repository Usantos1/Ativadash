import { api } from "./api";

export interface IntegrationFromApi {
  id: string;
  platform: string;
  slug: string;
  status: string;
  clientAccountId: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  /** Google Ads (quando slug === google-ads) */
  googleUserEmail?: string | null;
  googleAdsAccessibleCount?: number;
  googleAdsAssignmentCount?: number;
  googleAdsDefaultCustomerId?: string | null;
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

export interface GoogleAdsSetupCustomerRow {
  customerId: string;
  descriptiveName: string | null;
  currencyCode: string | null;
  isManager: boolean;
  managerCustomerId: string | null;
  status: string | null;
}

export interface GoogleAdsSetupAssignmentRow {
  clientAccountId: string;
  clientName: string;
  googleCustomerId: string;
  loginCustomerId: string | null;
}

export interface GoogleAdsSetupDto {
  integrationId: string;
  googleUserEmail: string | null;
  googleUserSub: string | null;
  defaultCustomerId: string | null;
  defaultLoginCustomerId: string | null;
  accessibleCount: number;
  assignmentCount: number;
  customers: GoogleAdsSetupCustomerRow[];
  assignments: GoogleAdsSetupAssignmentRow[];
}

export async function fetchGoogleAdsSetup(): Promise<GoogleAdsSetupDto> {
  return api.get<GoogleAdsSetupDto>("/integrations/google-ads/setup");
}

export async function postGoogleAdsSyncAccessible(): Promise<{ ok: true; count: number }> {
  return api.post<{ ok: true; count: number }>("/integrations/google-ads/sync-accessible", {});
}

export async function patchGoogleAdsDefaultCustomer(
  integrationId: string,
  customerId: string | null
): Promise<{ ok: true }> {
  return api.patch<{ ok: true }>(`/integrations/google-ads/${integrationId}/default-customer`, {
    customerId,
  });
}

export async function putGoogleAdsClientAssignment(
  integrationId: string,
  clientAccountId: string,
  googleCustomerId: string
): Promise<{ ok: true }> {
  return api.put<{ ok: true }>(
    `/integrations/google-ads/${integrationId}/assignments/${encodeURIComponent(clientAccountId)}`,
    { googleCustomerId }
  );
}

export async function deleteGoogleAdsClientAssignment(
  integrationId: string,
  clientAccountId: string
): Promise<{ ok: true }> {
  return api.delete<{ ok: true }>(
    `/integrations/google-ads/${integrationId}/assignments/${encodeURIComponent(clientAccountId)}`
  );
}

// Métricas do Google Ads (Marketing)
export interface GoogleAdsMetricsSummary {
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionsValue: number;
}

export type GoogleAdsEntityStatusUi = "ACTIVE" | "PAUSED" | "ARCHIVED" | "UNKNOWN";

export interface GoogleAdsCampaignRow {
  campaignName: string;
  campaignId?: string;
  entityStatus?: GoogleAdsEntityStatusUi;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionsValue: number;
}

export interface GoogleAdsAdGroupRow {
  campaignName: string;
  adGroupName: string;
  campaignId?: string;
  adGroupId?: string;
  entityStatus?: GoogleAdsEntityStatusUi;
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
  entityStatus?: GoogleAdsEntityStatusUi;
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
  | "SELECT_GOOGLE_ADS_CUSTOMER"
  | "UNKNOWN";

export type GoogleAdsMetricsResult =
  | GoogleAdsMetricsResponse
  | { ok: false; code: GoogleAdsMetricsErrorCode; message: string };

/** Intervalo em YYYY-MM-DD (fuso da conta / backend). */
export type MetricsDateRange = { startDate: string; endDate: string };

function metricsQuery(range: MetricsDateRange, clientAccountId?: string | null): string {
  const q = new URLSearchParams({
    startDate: range.startDate,
    endDate: range.endDate,
  });
  if (clientAccountId === null) {
    q.set("clientAccountId", "null");
  } else if (clientAccountId) {
    q.set("clientAccountId", clientAccountId);
  }
  return q.toString();
}

export async function fetchGoogleAdsMetrics(
  range: MetricsDateRange,
  clientAccountId?: string | null
): Promise<GoogleAdsMetricsResult | null> {
  try {
    const res = await api.get<GoogleAdsMetricsResult>(
      `/marketing/google-ads/metrics?${metricsQuery(range, clientAccountId)}`
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
  range: MetricsDateRange,
  clientAccountId?: string | null
): Promise<GoogleAdsDeepRowsResult<GoogleAdsAdGroupRow> | null> {
  try {
    return await api.get<GoogleAdsDeepRowsResult<GoogleAdsAdGroupRow>>(
      `/marketing/google-ads/ad-groups?${metricsQuery(range, clientAccountId)}`
    );
  } catch {
    return null;
  }
}

export async function fetchGoogleAdsAds(
  range: MetricsDateRange,
  clientAccountId?: string | null
): Promise<GoogleAdsDeepRowsResult<GoogleAdsAdRow> | null> {
  try {
    return await api.get<GoogleAdsDeepRowsResult<GoogleAdsAdRow>>(
      `/marketing/google-ads/ads?${metricsQuery(range, clientAccountId)}`
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
  /** Status de entrega (Graph `effective_status`), quando o backend envia */
  entityStatus?: GoogleAdsEntityStatusUi;
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
