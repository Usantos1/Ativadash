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
  /** Valor atribuído às conversões (moeda da conta) */
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

/** Série diária agregada (todas as campanhas) para gráficos. */
export interface GoogleAdsDailyRow {
  date: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
}

export type GoogleAdsMetricsResult =
  | { ok: true; summary: GoogleAdsMetricsSummary; campaigns: GoogleAdsCampaignRow[]; daily?: GoogleAdsDailyRow[] }
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
  range: { start: string; end: string }
): Promise<{ summary: GoogleAdsMetricsSummary; campaigns: GoogleAdsCampaignRow[] }> {
  const query = `
    SELECT
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${range.start}' AND '${range.end}'
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
    conversionsValue: 0,
  };

  for (const row of results) {
    const m = row.metrics ?? {};
    const impressions = Number(m.impressions ?? 0);
    const clicks = Number(m.clicks ?? 0);
    const costMicros = Number(m.costMicros ?? (m as Record<string, unknown>).cost_micros ?? 0);
    const conversions = Number(m.conversions ?? 0);
    const conversionsValue = Number(
      (m as Record<string, unknown>).conversionsValue ?? (m as Record<string, unknown>).conversions_value ?? 0
    );
    campaigns.push({
      campaignName: row.campaign?.name ?? "",
      impressions,
      clicks,
      costMicros,
      conversions,
      conversionsValue,
    });
    summary.impressions += impressions;
    summary.clicks += clicks;
    summary.costMicros += costMicros;
    summary.conversions += conversions;
    summary.conversionsValue += conversionsValue;
  }

  return { summary, campaigns };
}

async function searchStreamDaily(
  accessToken: string,
  developerToken: string,
  customerId: string,
  range: { start: string; end: string }
): Promise<GoogleAdsDailyRow[]> {
  const query = `
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${range.start}' AND '${range.end}'
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
    throw new Error(`SearchStream (daily): ${res.status} ${text}`);
  }

  const raw = await res.json();
  const batches = Array.isArray(raw) ? raw : [raw];
  type Row = {
    segments?: { date?: string };
    metrics?: Record<string, string | number | undefined>;
  };
  const results: Row[] = [];
  for (const batch of batches) {
    const r = (batch as { results?: unknown[] }).results ?? [];
    results.push(...(r as Row[]));
  }

  const byDate = new Map<string, GoogleAdsDailyRow>();

  for (const row of results) {
    const date = row.segments?.date ?? "";
    if (!date) continue;
    const m = row.metrics ?? {};
    const impressions = Number(m.impressions ?? 0);
    const clicks = Number(m.clicks ?? 0);
    const costMicros = Number(m.costMicros ?? (m as Record<string, unknown>).cost_micros ?? 0);
    const conversions = Number(m.conversions ?? 0);
    const cur = byDate.get(date);
    if (cur) {
      cur.impressions += impressions;
      cur.clicks += clicks;
      cur.costMicros += costMicros;
      cur.conversions += conversions;
    } else {
      byDate.set(date, { date, impressions, clicks, costMicros, conversions });
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchGoogleAdsMetrics(
  organizationId: string,
  range: { start: string; end: string }
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
        summary: { impressions: 0, clicks: 0, costMicros: 0, conversions: 0, conversionsValue: 0 },
        campaigns: [],
        daily: [],
      };
    }
    const customerId = customerIds[0];
    const { summary, campaigns } = await searchStream(
      accessToken,
      env.GOOGLE_ADS_DEVELOPER_TOKEN,
      customerId,
      range
    );
    let daily: GoogleAdsDailyRow[] = [];
    try {
      daily = await searchStreamDaily(accessToken, env.GOOGLE_ADS_DEVELOPER_TOKEN, customerId, range);
    } catch (e) {
      console.error("[Google Ads] daily series:", e instanceof Error ? e.message : e);
    }
    return { ok: true, summary, campaigns, daily };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Erro ao buscar dados do Google Ads: ${msg}` };
  }
}

async function googleSearchStreamResults(
  accessToken: string,
  developerToken: string,
  customerId: string,
  query: string
): Promise<unknown[]> {
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
  const results: unknown[] = [];
  for (const batch of batches) {
    const r = (batch as { results?: unknown[] }).results ?? [];
    results.push(...r);
  }
  return results;
}

async function resolveGoogleAdsCustomer(
  organizationId: string
): Promise<
  | { ok: true; accessToken: string; customerId: string }
  | { ok: false; message: string }
> {
  const config = await getGoogleAdsConfig(organizationId);
  if (!config) {
    return { ok: false, message: "Google Ads não conectado para esta organização." };
  }
  if (!env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    return {
      ok: false,
      message: "Developer Token do Google Ads não configurado (GOOGLE_ADS_DEVELOPER_TOKEN).",
    };
  }
  let accessToken = config.access_token;
  const now = Date.now();
  const margin = 5 * 60 * 1000;
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
      return { ok: true, accessToken, customerId: "" };
    }
    return { ok: true, accessToken, customerId: customerIds[0] };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export type GoogleAdsAdGroupRow = {
  campaignName: string;
  adGroupName: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionsValue: number;
};

export type GoogleAdsSearchTermRow = {
  searchTerm: string;
  impressions: number;
  clicks: number;
  costMicros: number;
};

export type GoogleAdsDeepResult<T> = { ok: true; rows: T[] } | { ok: false; message: string };

export async function fetchGoogleAdsAdGroupMetrics(
  organizationId: string,
  range: { start: string; end: string }
): Promise<GoogleAdsDeepResult<GoogleAdsAdGroupRow>> {
  const ctx = await resolveGoogleAdsCustomer(organizationId);
  if (!ctx.ok) return ctx;
  if (!ctx.customerId) return { ok: true, rows: [] };
  const query = `
    SELECT
      campaign.name,
      ad_group.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM ad_group
    WHERE segments.date BETWEEN '${range.start}' AND '${range.end}'
      AND ad_group.status = 'ENABLED'
  `.trim();
  try {
    const results = await googleSearchStreamResults(
      ctx.accessToken,
      env.GOOGLE_ADS_DEVELOPER_TOKEN,
      ctx.customerId,
      query
    );
    type Row = {
      campaign?: { name?: string };
      adGroup?: { name?: string };
      metrics?: Record<string, string | number | undefined>;
    };
    const rows: GoogleAdsAdGroupRow[] = [];
    for (const raw of results) {
      const row = raw as Row;
      const m = row.metrics ?? {};
      rows.push({
        campaignName: row.campaign?.name ?? "",
        adGroupName: row.adGroup?.name ?? "",
        impressions: Number(m.impressions ?? 0),
        clicks: Number(m.clicks ?? 0),
        costMicros: Number(m.costMicros ?? (m as Record<string, unknown>).cost_micros ?? 0),
        conversions: Number(m.conversions ?? 0),
        conversionsValue: Number(
          (m as Record<string, unknown>).conversionsValue ??
            (m as Record<string, unknown>).conversions_value ??
            0
        ),
      });
    }
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchGoogleAdsSearchTerms(
  organizationId: string,
  range: { start: string; end: string }
): Promise<GoogleAdsDeepResult<GoogleAdsSearchTermRow>> {
  const ctx = await resolveGoogleAdsCustomer(organizationId);
  if (!ctx.ok) return ctx;
  if (!ctx.customerId) return { ok: true, rows: [] };
  const query = `
    SELECT
      search_term_view.search_term,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM search_term_view
    WHERE segments.date BETWEEN '${range.start}' AND '${range.end}'
  `.trim();
  try {
    const results = await googleSearchStreamResults(
      ctx.accessToken,
      env.GOOGLE_ADS_DEVELOPER_TOKEN,
      ctx.customerId,
      query
    );
    type Row = {
      searchTermView?: { searchTerm?: string };
      metrics?: Record<string, string | number | undefined>;
    };
    const rows: GoogleAdsSearchTermRow[] = [];
    for (const raw of results) {
      const row = raw as Row;
      const m = row.metrics ?? {};
      rows.push({
        searchTerm: row.searchTermView?.searchTerm ?? "",
        impressions: Number(m.impressions ?? 0),
        clicks: Number(m.clicks ?? 0),
        costMicros: Number(m.costMicros ?? (m as Record<string, unknown>).cost_micros ?? 0),
      });
    }
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Mutação no Google Ads exige biblioteca oficial ou REST v15+ com credenciais complexas — retorno explícito para roadmap. */
export async function mutateGoogleCampaignStatus(
  _organizationId: string,
  _campaignResourceName: string,
  _enabled: boolean
): Promise<{ ok: false; message: string }> {
  return {
    ok: false,
    message:
      "Pausar campanhas no Google Ads via API ainda não está habilitado nesta versão (use o Google Ads Editor ou a interface).",
  };
}
