import { env } from "../config/env.js";
import { prisma } from "../utils/prisma.js";

const GOOGLE_ADS_SLUG = "google-ads";
const API_VERSION = "v20";

interface GoogleAdsConfig {
  access_token: string;
  refresh_token: string | null;
  expiry_date: number;
}

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

export type GoogleAdsMetricsResult =
  | { ok: true; summary: GoogleAdsMetricsSummary; campaigns: GoogleAdsCampaignRow[] }
  | { ok: false; message: string };

async function getGoogleAdsConfig(organizationId: string): Promise<GoogleAdsConfig | null> {
  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_slug: { organizationId, slug: GOOGLE_ADS_SLUG },
    },
  });
  if (!integration?.config || integration.status !== "connected") return null;
  try {
    return JSON.parse(integration.config) as GoogleAdsConfig;
  } catch {
    return null;
  }
}

async function refreshAndSaveGoogleAdsToken(
  organizationId: string,
  current: GoogleAdsConfig
): Promise<string> {
  if (!current.refresh_token) throw new Error("Sem refresh token");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: current.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Falha ao renovar token: ${t}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  const config: GoogleAdsConfig = {
    access_token: data.access_token,
    refresh_token: current.refresh_token,
    expiry_date: Date.now() + data.expires_in * 1000,
  };
  await prisma.integration.update({
    where: { organizationId_slug: { organizationId, slug: GOOGLE_ADS_SLUG } },
    data: {
      config: JSON.stringify(config),
      lastSyncAt: new Date(),
    },
  });
  return config.access_token;
}

async function listAccessibleCustomers(accessToken: string): Promise<string[]> {
  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ListAccessibleCustomers: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { resourceNames?: string[] };
  return (data.resourceNames ?? []).map((r) => r.replace("customers/", ""));
}

async function searchStream(
  accessToken: string,
  developerToken: string,
  customerId: string,
  days: number
): Promise<{ summary: GoogleAdsMetricsSummary; campaigns: GoogleAdsCampaignRow[] }> {
  const query = `
    SELECT
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date DURING LAST_${days}_DAYS
      AND campaign.status = 'ENABLED'
  `.trim();

  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SearchStream: ${res.status} ${text}`);
  }

  const raw = await res.json();
  const batches = Array.isArray(raw) ? raw : [raw];
  type MetricRow = {
    campaign?: { name?: string };
    metrics?: Record<string, string | number | undefined>;
  };
  const results: MetricRow[] = [];
  for (const batch of batches) {
    const r = (batch as { results?: unknown[] }).results ?? [];
    results.push(...(r as MetricRow[]));
  }

  const campaigns: GoogleAdsCampaignRow[] = [];
  const summary: GoogleAdsMetricsSummary = {
    impressions: 0,
    clicks: 0,
    costMicros: 0,
    conversions: 0,
  };

  for (const row of results) {
    const m = row.metrics ?? {};
    const impressions = Number(m.impressions ?? 0);
    const clicks = Number(m.clicks ?? 0);
    const costMicros = Number(m.costMicros ?? (m as Record<string, unknown>).cost_micros ?? 0);
    const conversions = Number(m.conversions ?? 0);
    campaigns.push({
      campaignName: row.campaign?.name ?? "",
      impressions,
      clicks,
      costMicros,
      conversions,
    });
    summary.impressions += impressions;
    summary.clicks += clicks;
    summary.costMicros += costMicros;
    summary.conversions += conversions;
  }

  return { summary, campaigns };
}

export async function fetchGoogleAdsMetrics(
  organizationId: string,
  periodDays: number = 30
): Promise<GoogleAdsMetricsResult> {
  const config = await getGoogleAdsConfig(organizationId);
  if (!config) {
    return { ok: false, message: "Google Ads não conectado para esta organização." };
  }

  if (!env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    return {
      ok: false,
      message:
        "Developer Token do Google Ads não configurado. Configure GOOGLE_ADS_DEVELOPER_TOKEN no servidor.",
    };
  }

  let accessToken = config.access_token;
  const now = Date.now();
  const margin = 5 * 60 * 1000; // 5 min
  if (config.expiry_date && now >= config.expiry_date - margin) {
    try {
      accessToken = await refreshAndSaveGoogleAdsToken(organizationId, config);
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Falha ao renovar token do Google Ads.",
      };
    }
  }

  try {
    const customerIds = await listAccessibleCustomers(accessToken);
    if (customerIds.length === 0) {
      return {
        ok: true,
        summary: { impressions: 0, clicks: 0, costMicros: 0, conversions: 0 },
        campaigns: [],
      };
    }
    const customerId = customerIds[0];
    const { summary, campaigns } = await searchStream(
      accessToken,
      env.GOOGLE_ADS_DEVELOPER_TOKEN,
      customerId,
      periodDays
    );
    return { ok: true, summary, campaigns };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Erro ao buscar dados do Google Ads: ${msg}` };
  }
}
