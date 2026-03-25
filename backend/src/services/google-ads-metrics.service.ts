import { env } from "../config/env.js";
import { prisma } from "../utils/prisma.js";
import {
  isGoogleAdsDeveloperTokenConfigured,
  isGoogleAdsUxPending,
} from "../utils/google-ads-readiness.js";

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

export type GoogleAdsEntityStatus = "ACTIVE" | "PAUSED" | "ARCHIVED" | "UNKNOWN";

function mapGoogleResourceStatus(raw: string | undefined): GoogleAdsEntityStatus {
  if (!raw) return "UNKNOWN";
  const u = raw.toUpperCase();
  if (u === "ENABLED") return "ACTIVE";
  if (u === "PAUSED") return "PAUSED";
  if (u === "REMOVED" || u === "UNKNOWN") return "ARCHIVED";
  return "UNKNOWN";
}

export interface GoogleAdsCampaignRow {
  campaignName: string;
  /** ID numérico da campanha no customer atual (mutações REST). */
  campaignId?: string;
  /** Status da campanha na Google (ENABLED→ativo). */
  entityStatus?: GoogleAdsEntityStatus;
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

export type GoogleAdsMetricsErrorCode =
  | "NOT_CONNECTED"
  | "pending_configuration"
  | "api_not_ready"
  /** @deprecated use pending_configuration */
  | "MISSING_DEVELOPER_TOKEN"
  | "TOKEN_REFRESH_FAILED"
  | "API_PENDING_OR_RESTRICTED"
  | "UNKNOWN";

export type GoogleAdsMetricsResult =
  | { ok: true; summary: GoogleAdsMetricsSummary; campaigns: GoogleAdsCampaignRow[]; daily?: GoogleAdsDailyRow[] }
  | { ok: false; code: GoogleAdsMetricsErrorCode; message: string };

const MSG_GOOGLE_PENDING =
  "Google Ads ainda não está disponível neste ambiente. O pedido de ativação da API está em análise. Assim que aprovado, os dados serão exibidos aqui.";

const MSG_GOOGLE_SOFT_UNAVAILABLE =
  "Não foi possível carregar o Google Ads agora. O painel segue com os dados da Meta Ads; tentaremos novamente quando a integração estiver liberada.";

const MSG_PENDING_CONFIGURATION =
  "Google Ads: o servidor ainda não tem o Developer Token configurado. Defina GOOGLE_ADS_DEVELOPER_TOKEN no ambiente da API para habilitar as consultas.";

const MSG_API_NOT_READY =
  "Google Ads: integração em preparação neste ambiente. Os dados aparecerão quando a API estiver liberada.";

/** Evita spam de log em erros repetidos (ex.: painel em polling). */
const googleAdsLogThrottle = new Map<string, number>();
const GOOGLE_ADS_LOG_THROTTLE_MS = 120_000;

function shouldLogGoogleAdsTechnical(key: string): boolean {
  const now = Date.now();
  const prev = googleAdsLogThrottle.get(key) ?? 0;
  if (now - prev < GOOGLE_ADS_LOG_THROTTLE_MS) return false;
  googleAdsLogThrottle.set(key, now);
  return true;
}

const SILENT_FAILURE_CODES = new Set<GoogleAdsMetricsErrorCode>([
  "NOT_CONNECTED",
  "pending_configuration",
  "api_not_ready",
  "MISSING_DEVELOPER_TOKEN",
]);

function googleAdsFailure(
  code: GoogleAdsMetricsErrorCode,
  message: string,
  technical?: string
): GoogleAdsMetricsResult {
  if (technical && !SILENT_FAILURE_CODES.has(code) && shouldLogGoogleAdsTechnical(`fail:${code}`)) {
    console.warn("[Google Ads]", code, technical.length > 400 ? `${technical.slice(0, 400)}…` : technical);
  }
  return { ok: false, code, message };
}

/** Mensagem amigável para a UI; detalhe técnico só em log. */
function classifyGoogleAdsError(raw: string): GoogleAdsMetricsResult {
  const t = raw.toLowerCase();
  if (
    t.includes("permission_denied") ||
    t.includes("permission denied") ||
    t.includes("developer_token") ||
    t.includes("developer token") ||
    t.includes("not approved") ||
    t.includes("not_approved") ||
    t.includes("test account") ||
    t.includes("basic access") ||
    t.includes("standard access")
  ) {
    if (shouldLogGoogleAdsTechnical("classify:api_restricted")) {
      console.warn("[Google Ads] API_PENDING_OR_RESTRICTED", raw.length > 400 ? `${raw.slice(0, 400)}…` : raw);
    }
    return googleAdsFailure("API_PENDING_OR_RESTRICTED", MSG_GOOGLE_PENDING);
  }
  if (t.includes("invalid_grant") || t.includes("unauthorized") || t.includes("401")) {
    return googleAdsFailure("TOKEN_REFRESH_FAILED", MSG_GOOGLE_SOFT_UNAVAILABLE, raw);
  }
  return googleAdsFailure("UNKNOWN", MSG_GOOGLE_SOFT_UNAVAILABLE, raw);
}

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

async function listAccessibleCustomers(accessToken: string, developerToken: string): Promise<string[]> {
  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
      },
    }
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
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${range.start}' AND '${range.end}'
      AND campaign.status IN ('ENABLED', 'PAUSED')
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
    campaign?: { id?: string; name?: string; status?: string };
    metrics?: Record<string, string | number | undefined>;
  };
  const results: MetricRow[] = [];
  for (const batch of batches) {
    const r = (batch as { results?: unknown[] }).results ?? [];
    results.push(...(r as MetricRow[]));
  }

  /**
   * GAQL com `segments.date` no WHERE retorna uma linha por (campanha × dia).
   * Somar métricas por `campaign.id` garante: uma linha por campanha no período e
   * `summary === Σ campaigns` (fonte única de verdade para a UI).
   */
  const byCampaign = new Map<string, GoogleAdsCampaignRow>();

  for (const row of results) {
    const m = row.metrics ?? {};
    const impressions = Number(m.impressions ?? 0);
    const clicks = Number(m.clicks ?? 0);
    const costMicros = Number(m.costMicros ?? (m as Record<string, unknown>).cost_micros ?? 0);
    const conversions = Number(m.conversions ?? 0);
    const conversionsValue = Number(
      (m as Record<string, unknown>).conversionsValue ?? (m as Record<string, unknown>).conversions_value ?? 0
    );
    const cid = row.campaign?.id != null ? String(row.campaign.id) : undefined;
    const name = row.campaign?.name ?? "";
    const key = cid ?? `__name:${name}`;
    const st = mapGoogleResourceStatus(row.campaign?.status);

    const existing = byCampaign.get(key);
    if (existing) {
      existing.impressions += impressions;
      existing.clicks += clicks;
      existing.costMicros += costMicros;
      existing.conversions += conversions;
      existing.conversionsValue += conversionsValue;
      if (!existing.entityStatus || existing.entityStatus === "UNKNOWN") {
        existing.entityStatus = st;
      }
    } else {
      byCampaign.set(key, {
        campaignName: name,
        ...(cid ? { campaignId: cid } : {}),
        entityStatus: st,
        impressions,
        clicks,
        costMicros,
        conversions,
        conversionsValue,
      });
    }
  }

  const campaigns = Array.from(byCampaign.values()).sort((a, b) => b.costMicros - a.costMicros);
  const summary: GoogleAdsMetricsSummary = campaigns.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      costMicros: acc.costMicros + r.costMicros,
      conversions: acc.conversions + r.conversions,
      conversionsValue: acc.conversionsValue + r.conversionsValue,
    }),
    { impressions: 0, clicks: 0, costMicros: 0, conversions: 0, conversionsValue: 0 }
  );

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
      AND campaign.status IN ('ENABLED', 'PAUSED')
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
    return googleAdsFailure(
      "NOT_CONNECTED",
      "Google Ads não está conectado. Quando a API estiver liberada, conecte em Integrações para ver os dados aqui."
    );
  }

  if (isGoogleAdsUxPending()) {
    return googleAdsFailure("api_not_ready", MSG_API_NOT_READY);
  }

  if (!isGoogleAdsDeveloperTokenConfigured()) {
    return googleAdsFailure("pending_configuration", MSG_PENDING_CONFIGURATION);
  }

  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN.trim();

  let accessToken = config.access_token;
  const now = Date.now();
  const margin = 5 * 60 * 1000; // 5 min
  if (config.expiry_date && now >= config.expiry_date - margin) {
    try {
      accessToken = await refreshAndSaveGoogleAdsToken(organizationId, config);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      return classifyGoogleAdsError(raw);
    }
  }

  try {
    const customerIds = await listAccessibleCustomers(accessToken, developerToken);
    if (customerIds.length === 0) {
      return {
        ok: true,
        summary: { impressions: 0, clicks: 0, costMicros: 0, conversions: 0, conversionsValue: 0 },
        campaigns: [],
        daily: [],
      };
    }
    const customerId = customerIds[0];
    const { summary, campaigns } = await searchStream(accessToken, developerToken, customerId, range);
    let daily: GoogleAdsDailyRow[] = [];
    try {
      daily = await searchStreamDaily(accessToken, developerToken, customerId, range);
    } catch (e) {
      if (shouldLogGoogleAdsTechnical("daily:series")) {
        console.warn("[Google Ads] daily series:", e instanceof Error ? e.message : e);
      }
    }
    return { ok: true, summary, campaigns, daily };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return classifyGoogleAdsError(msg);
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

export type ResolveGoogleAdsCustomerResult =
  | { ok: true; accessToken: string; customerId: string }
  | { ok: false; code: GoogleAdsMetricsErrorCode; message: string };

async function resolveGoogleAdsCustomer(organizationId: string): Promise<ResolveGoogleAdsCustomerResult> {
  const config = await getGoogleAdsConfig(organizationId);
  if (!config) {
    return { ok: false, code: "NOT_CONNECTED", message: "Google Ads não conectado para esta organização." };
  }
  if (isGoogleAdsUxPending()) {
    return { ok: false, code: "api_not_ready", message: MSG_API_NOT_READY };
  }
  if (!isGoogleAdsDeveloperTokenConfigured()) {
    return { ok: false, code: "pending_configuration", message: MSG_PENDING_CONFIGURATION };
  }
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN.trim();

  let accessToken = config.access_token;
  const now = Date.now();
  const margin = 5 * 60 * 1000;
  if (config.expiry_date && now >= config.expiry_date - margin) {
    try {
      accessToken = await refreshAndSaveGoogleAdsToken(organizationId, config);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const classified = classifyGoogleAdsError(raw);
      if (!classified.ok) {
        return { ok: false, code: classified.code, message: classified.message };
      }
      return { ok: false, code: "UNKNOWN", message: raw };
    }
  }
  try {
    const customerIds = await listAccessibleCustomers(accessToken, developerToken);
    if (customerIds.length === 0) {
      return { ok: true, accessToken, customerId: "" };
    }
    return { ok: true, accessToken, customerId: customerIds[0] };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const classified = classifyGoogleAdsError(raw);
    if (!classified.ok) {
      return { ok: false, code: classified.code, message: classified.message };
    }
    return { ok: false, code: "UNKNOWN", message: raw };
  }
}

export type GoogleAdsAdGroupRow = {
  campaignName: string;
  adGroupName: string;
  campaignId?: string;
  adGroupId?: string;
  entityStatus?: GoogleAdsEntityStatus;
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

export type GoogleAdsDeepResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; code: GoogleAdsMetricsErrorCode; message: string };

export async function fetchGoogleAdsAdGroupMetrics(
  organizationId: string,
  range: { start: string; end: string }
): Promise<GoogleAdsDeepResult<GoogleAdsAdGroupRow>> {
  const ctx = await resolveGoogleAdsCustomer(organizationId);
  if (!ctx.ok) return { ok: false, code: ctx.code, message: ctx.message };
  if (!ctx.customerId) return { ok: true, rows: [] };
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN.trim();
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM ad_group
    WHERE segments.date BETWEEN '${range.start}' AND '${range.end}'
      AND ad_group.status IN ('ENABLED', 'PAUSED')
  `.trim();
  try {
    const results = await googleSearchStreamResults(
      ctx.accessToken,
      developerToken,
      ctx.customerId,
      query
    );
    type Row = {
      campaign?: { id?: string | number; name?: string };
      adGroup?: { id?: string | number; name?: string; status?: string };
      metrics?: Record<string, string | number | undefined>;
    };
    const byKey = new Map<string, GoogleAdsAdGroupRow>();
    for (const raw of results) {
      const row = raw as Row;
      const m = row.metrics ?? {};
      const impressions = Number(m.impressions ?? 0);
      const clicks = Number(m.clicks ?? 0);
      const costMicros = Number(m.costMicros ?? (m as Record<string, unknown>).cost_micros ?? 0);
      const conversions = Number(m.conversions ?? 0);
      const conversionsValue = Number(
        (m as Record<string, unknown>).conversionsValue ??
          (m as Record<string, unknown>).conversions_value ??
          0
      );
      const cname = row.campaign?.name ?? "";
      const gname = row.adGroup?.name ?? "";
      const cid = row.campaign?.id != null ? String(row.campaign.id) : "";
      const gid = row.adGroup?.id != null ? String(row.adGroup.id) : "";
      const key = cid && gid ? `${cid}|${gid}` : `${cname}\0${gname}`;
      const st = mapGoogleResourceStatus(row.adGroup?.status);
      const existing = byKey.get(key);
      if (existing) {
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.costMicros += costMicros;
        existing.conversions += conversions;
        existing.conversionsValue += conversionsValue;
        if (!existing.entityStatus || existing.entityStatus === "UNKNOWN") {
          existing.entityStatus = st;
        }
      } else {
        byKey.set(key, {
          campaignName: cname,
          adGroupName: gname,
          ...(cid ? { campaignId: cid } : {}),
          ...(gid ? { adGroupId: gid } : {}),
          entityStatus: st,
          impressions,
          clicks,
          costMicros,
          conversions,
          conversionsValue,
        });
      }
    }
    const rows = Array.from(byKey.values()).sort((a, b) => b.costMicros - a.costMicros);
    return { ok: true, rows };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const classified = classifyGoogleAdsError(raw);
    if (!classified.ok) {
      return { ok: false, code: classified.code, message: classified.message };
    }
    return { ok: false, code: "UNKNOWN", message: raw };
  }
}

export type GoogleAdsAdRow = {
  campaignName: string;
  adGroupName: string;
  adId: string;
  entityStatus?: GoogleAdsEntityStatus;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionsValue: number;
};

export async function fetchGoogleAdsAdMetrics(
  organizationId: string,
  range: { start: string; end: string }
): Promise<GoogleAdsDeepResult<GoogleAdsAdRow>> {
  const ctx = await resolveGoogleAdsCustomer(organizationId);
  if (!ctx.ok) return { ok: false, code: ctx.code, message: ctx.message };
  if (!ctx.customerId) return { ok: true, rows: [] };
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN.trim();
  const query = `
    SELECT
      campaign.name,
      ad_group.name,
      ad_group_ad.ad.id,
      ad_group_ad.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${range.start}' AND '${range.end}'
      AND ad_group_ad.status IN ('ENABLED', 'PAUSED')
  `.trim();
  try {
    const results = await googleSearchStreamResults(
      ctx.accessToken,
      developerToken,
      ctx.customerId,
      query
    );
    type Row = {
      campaign?: { name?: string };
      adGroup?: { name?: string };
      adGroupAd?: { ad?: { id?: string | number }; status?: string };
      metrics?: Record<string, string | number | undefined>;
    };
    const byAd = new Map<string, GoogleAdsAdRow>();
    for (const raw of results) {
      const row = raw as Row;
      const m = row.metrics ?? {};
      const idRaw = row.adGroupAd?.ad?.id;
      const adId = idRaw != null ? String(idRaw) : "";
      const key = adId || `__:${row.campaign?.name ?? ""}:${row.adGroup?.name ?? ""}:${byAd.size}`;
      const impressions = Number(m.impressions ?? 0);
      const clicks = Number(m.clicks ?? 0);
      const costMicros = Number(m.costMicros ?? (m as Record<string, unknown>).cost_micros ?? 0);
      const conversions = Number(m.conversions ?? 0);
      const conversionsValue = Number(
        (m as Record<string, unknown>).conversionsValue ??
          (m as Record<string, unknown>).conversions_value ??
          0
      );
      const st = mapGoogleResourceStatus(row.adGroupAd?.status);
      const existing = byAd.get(key);
      if (existing) {
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.costMicros += costMicros;
        existing.conversions += conversions;
        existing.conversionsValue += conversionsValue;
        if (!existing.entityStatus || existing.entityStatus === "UNKNOWN") {
          existing.entityStatus = st;
        }
      } else {
        byAd.set(key, {
          campaignName: row.campaign?.name ?? "",
          adGroupName: row.adGroup?.name ?? "",
          adId,
          entityStatus: st,
          impressions,
          clicks,
          costMicros,
          conversions,
          conversionsValue,
        });
      }
    }
    const rows = Array.from(byAd.values()).sort((a, b) => b.costMicros - a.costMicros);
    return { ok: true, rows };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const classified = classifyGoogleAdsError(raw);
    if (!classified.ok) {
      return { ok: false, code: classified.code, message: classified.message };
    }
    return { ok: false, code: "UNKNOWN", message: raw };
  }
}

export async function fetchGoogleAdsSearchTerms(
  organizationId: string,
  range: { start: string; end: string }
): Promise<GoogleAdsDeepResult<GoogleAdsSearchTermRow>> {
  const ctx = await resolveGoogleAdsCustomer(organizationId);
  if (!ctx.ok) return { ok: false, code: ctx.code, message: ctx.message };
  if (!ctx.customerId) return { ok: true, rows: [] };
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN.trim();
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
      developerToken,
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
    const raw = e instanceof Error ? e.message : String(e);
    const classified = classifyGoogleAdsError(raw);
    if (!classified.ok) {
      return { ok: false, code: classified.code, message: classified.message };
    }
    return { ok: false, code: "UNKNOWN", message: raw };
  }
}

function resolveGoogleCampaignResource(
  externalId: string,
  fallbackCustomerId: string
): { customerId: string; resourceName: string } | null {
  const t = externalId.trim();
  if (!t) return null;
  const full = /^customers\/(\d+)\/campaigns\/(\d+)$/.exec(t);
  if (full) {
    return { customerId: full[1], resourceName: t };
  }
  if (/^\d+$/.test(t) && fallbackCustomerId) {
    return {
      customerId: fallbackCustomerId,
      resourceName: `customers/${fallbackCustomerId}/campaigns/${t}`,
    };
  }
  return null;
}

/** Ativa ou pausa campanha via Google Ads API REST (campaigns:mutate). */
export async function mutateGoogleCampaignStatus(
  organizationId: string,
  campaignExternalId: string,
  enabled: boolean
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await resolveGoogleAdsCustomer(organizationId);
  if (!ctx.ok) {
    return { ok: false, message: ctx.message };
  }
  if (!ctx.customerId) {
    return { ok: false, message: "Nenhuma conta Google Ads acessível para esta organização." };
  }
  const resolved = resolveGoogleCampaignResource(campaignExternalId, ctx.customerId);
  if (!resolved) {
    return {
      ok: false,
      message:
        "ID de campanha inválido. Use o ID numérico da campanha ou o resourceName completo (customers/…/campaigns/…).",
    };
  }
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN.trim();
  const status = enabled ? "ENABLED" : "PAUSED";
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${resolved.customerId}/campaigns:mutate`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operations: [
          {
            update: {
              resourceName: resolved.resourceName,
              status,
            },
            updateMask: "status",
          },
        ],
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      const classified = classifyGoogleAdsError(text);
      if (!classified.ok) {
        return { ok: false, message: classified.message };
      }
      return { ok: false, message: text.length > 500 ? `${text.slice(0, 500)}…` : text };
    }
    return { ok: true };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const classified = classifyGoogleAdsError(raw);
    if (!classified.ok) {
      return { ok: false, message: classified.message };
    }
    return { ok: false, message: raw };
  }
}
