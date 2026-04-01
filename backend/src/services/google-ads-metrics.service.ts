import { env } from "../config/env.js";
import { prisma } from "../utils/prisma.js";
import {
  isGoogleAdsDeveloperTokenConfigured,
  isGoogleAdsUxPending,
} from "../utils/google-ads-readiness.js";
import {
  resolveGoogleAdsOperationalContext,
  buildGoogleAdsHeaders,
  normalizeGoogleAdsCustomerId,
} from "./google-ads-accounts.service.js";

const API_VERSION = "v20";

/** Contexto opcional: alinha queries à conta comercial (workspace) quando enviado pelo cliente. */
export type GoogleAdsMetricsQueryContext = { clientAccountId?: string | null };

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
  | "SELECT_GOOGLE_ADS_CUSTOMER"
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

function mapOperationalCodeToMetrics(code: string): GoogleAdsMetricsErrorCode {
  switch (code) {
    case "NOT_CONNECTED":
      return "NOT_CONNECTED";
    case "api_not_ready":
      return "api_not_ready";
    case "pending_configuration":
      return "pending_configuration";
    case "TOKEN_REFRESH_FAILED":
      return "TOKEN_REFRESH_FAILED";
    case "SELECT_GOOGLE_ADS_CUSTOMER":
      return "SELECT_GOOGLE_ADS_CUSTOMER";
    default:
      return "UNKNOWN";
  }
}

async function searchStream(
  accessToken: string,
  developerToken: string,
  customerId: string,
  range: { start: string; end: string },
  loginCustomerId: string | null
): Promise<{ summary: GoogleAdsMetricsSummary; campaigns: GoogleAdsCampaignRow[] }> {
  const cid = normalizeGoogleAdsCustomerId(customerId);
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
    `https://googleads.googleapis.com/${API_VERSION}/customers/${cid}/googleAds:searchStream`,
    {
      method: "POST",
      headers: buildGoogleAdsHeaders(accessToken, developerToken, loginCustomerId),
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
  range: { start: string; end: string },
  loginCustomerId: string | null
): Promise<GoogleAdsDailyRow[]> {
  const cid = normalizeGoogleAdsCustomerId(customerId);
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
    `https://googleads.googleapis.com/${API_VERSION}/customers/${cid}/googleAds:searchStream`,
    {
      method: "POST",
      headers: buildGoogleAdsHeaders(accessToken, developerToken, loginCustomerId),
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
  range: { start: string; end: string },
  queryContext?: GoogleAdsMetricsQueryContext
): Promise<GoogleAdsMetricsResult> {
  if (isGoogleAdsUxPending()) {
    return googleAdsFailure("api_not_ready", MSG_API_NOT_READY);
  }

  if (!isGoogleAdsDeveloperTokenConfigured()) {
    return googleAdsFailure("pending_configuration", MSG_PENDING_CONFIGURATION);
  }

  const operational = await resolveGoogleAdsOperationalContext(organizationId, {
    clientAccountId: queryContext?.clientAccountId,
  });
  if (!operational.ok) {
    const code = mapOperationalCodeToMetrics(operational.code);
    if (code === "NOT_CONNECTED") {
      return googleAdsFailure(
        "NOT_CONNECTED",
        "Google Ads não está conectado. Quando a API estiver liberada, conecte em Integrações para ver os dados aqui."
      );
    }
    return googleAdsFailure(code, operational.message);
  }

  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN.trim();
  const { accessToken, customerId, loginCustomerId } = operational;

  try {
    const { summary, campaigns } = await searchStream(
      accessToken,
      developerToken,
      customerId,
      range,
      loginCustomerId
    );
    let daily: GoogleAdsDailyRow[] = [];
    try {
      daily = await searchStreamDaily(
        accessToken,
        developerToken,
        customerId,
        range,
        loginCustomerId
      );
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
  query: string,
  loginCustomerId: string | null
): Promise<unknown[]> {
  const cid = normalizeGoogleAdsCustomerId(customerId);
  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${cid}/googleAds:searchStream`,
    {
      method: "POST",
      headers: buildGoogleAdsHeaders(accessToken, developerToken, loginCustomerId),
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
  | {
      ok: true;
      accessToken: string;
      customerId: string;
      loginCustomerId: string | null;
      integrationId: string;
    }
  | { ok: false; code: GoogleAdsMetricsErrorCode; message: string };

async function resolveGoogleAdsCustomer(
  organizationId: string,
  queryContext?: GoogleAdsMetricsQueryContext
): Promise<ResolveGoogleAdsCustomerResult> {
  if (isGoogleAdsUxPending()) {
    return { ok: false, code: "api_not_ready", message: MSG_API_NOT_READY };
  }
  if (!isGoogleAdsDeveloperTokenConfigured()) {
    return { ok: false, code: "pending_configuration", message: MSG_PENDING_CONFIGURATION };
  }
  const ctx = await resolveGoogleAdsOperationalContext(organizationId, {
    clientAccountId: queryContext?.clientAccountId,
  });
  if (!ctx.ok) {
    return {
      ok: false,
      code: mapOperationalCodeToMetrics(ctx.code),
      message: ctx.message,
    };
  }
  return {
    ok: true,
    accessToken: ctx.accessToken,
    customerId: ctx.customerId,
    loginCustomerId: ctx.loginCustomerId,
    integrationId: ctx.integrationId,
  };
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
  range: { start: string; end: string },
  queryContext?: GoogleAdsMetricsQueryContext
): Promise<GoogleAdsDeepResult<GoogleAdsAdGroupRow>> {
  const ctx = await resolveGoogleAdsCustomer(organizationId, queryContext);
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
      query,
      ctx.loginCustomerId
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
  range: { start: string; end: string },
  queryContext?: GoogleAdsMetricsQueryContext
): Promise<GoogleAdsDeepResult<GoogleAdsAdRow>> {
  const ctx = await resolveGoogleAdsCustomer(organizationId, queryContext);
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
      query,
      ctx.loginCustomerId
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
  range: { start: string; end: string },
  queryContext?: GoogleAdsMetricsQueryContext
): Promise<GoogleAdsDeepResult<GoogleAdsSearchTermRow>> {
  const ctx = await resolveGoogleAdsCustomer(organizationId, queryContext);
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
      query,
      ctx.loginCustomerId
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

function resolveGoogleAdGroupResource(
  externalId: string,
  fallbackCustomerId: string
): { customerId: string; resourceName: string } | null {
  const t = externalId.trim();
  if (!t) return null;
  const full = /^customers\/(\d+)\/adGroups\/(\d+)$/i.exec(t);
  if (full) {
    return { customerId: full[1], resourceName: `customers/${full[1]}/adGroups/${full[2]}` };
  }
  if (/^\d+$/.test(t) && fallbackCustomerId) {
    return {
      customerId: fallbackCustomerId,
      resourceName: `customers/${fallbackCustomerId}/adGroups/${t}`,
    };
  }
  return null;
}

/** Ativa ou pausa campanha via Google Ads API REST (campaigns:mutate). */
export async function mutateGoogleCampaignStatus(
  organizationId: string,
  campaignExternalId: string,
  enabled: boolean,
  queryContext?: GoogleAdsMetricsQueryContext
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await resolveGoogleAdsCustomer(organizationId, queryContext);
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
  const mutateCid = normalizeGoogleAdsCustomerId(resolved.customerId);
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${mutateCid}/campaigns:mutate`;

  let loginForMutate = ctx.loginCustomerId;
  if (normalizeGoogleAdsCustomerId(resolved.customerId) !== normalizeGoogleAdsCustomerId(ctx.customerId)) {
    const acc = await prisma.googleAdsAccessibleCustomer.findUnique({
      where: {
        integrationId_customerId: {
          integrationId: ctx.integrationId,
          customerId: mutateCid,
        },
      },
    });
    loginForMutate = acc?.managerCustomerId ? normalizeGoogleAdsCustomerId(acc.managerCustomerId) : null;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: buildGoogleAdsHeaders(ctx.accessToken, developerToken, loginForMutate),
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

/** Orçamento diário da campanha (micros) + resource do budget para mutação. */
export async function fetchGoogleCampaignBudgetMicros(
  organizationId: string,
  campaignExternalId: string,
  queryContext?: GoogleAdsMetricsQueryContext
): Promise<
  | { ok: true; campaignResourceName: string; budgetResourceName: string; amountMicros: number }
  | { ok: false; message: string }
> {
  if (isGoogleAdsUxPending()) {
    return { ok: false, message: MSG_API_NOT_READY };
  }
  if (!isGoogleAdsDeveloperTokenConfigured()) {
    return { ok: false, message: MSG_PENDING_CONFIGURATION };
  }
  const operational = await resolveGoogleAdsOperationalContext(organizationId, {
    clientAccountId: queryContext?.clientAccountId,
  });
  if (!operational.ok) {
    return { ok: false, message: operational.message };
  }
  if (!operational.customerId) {
    return { ok: false, message: "Nenhuma conta Google Ads acessível para esta organização." };
  }
  const resolved = resolveGoogleCampaignResource(campaignExternalId, operational.customerId);
  if (!resolved) {
    return {
      ok: false,
      message:
        "ID de campanha inválido. Use o ID numérico da campanha ou o resourceName completo (customers/…/campaigns/…).",
    };
  }
  const numericId = /^customers\/\d+\/campaigns\/(\d+)$/.exec(resolved.resourceName)?.[1];
  if (!numericId) {
    return { ok: false, message: "Não foi possível resolver o ID numérico da campanha." };
  }

  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN.trim();
  const mutateCid = normalizeGoogleAdsCustomerId(resolved.customerId);
  const query = `
    SELECT
      campaign.resource_name,
      campaign.campaign_budget,
      campaign_budget.resource_name,
      campaign_budget.amount_micros
    FROM campaign
    WHERE campaign.id = ${numericId}
  `.trim();

  let loginForQuery = operational.loginCustomerId;
  if (normalizeGoogleAdsCustomerId(resolved.customerId) !== normalizeGoogleAdsCustomerId(operational.customerId)) {
    const acc = await prisma.googleAdsAccessibleCustomer.findUnique({
      where: {
        integrationId_customerId: {
          integrationId: operational.integrationId,
          customerId: mutateCid,
        },
      },
    });
    loginForQuery = acc?.managerCustomerId ? normalizeGoogleAdsCustomerId(acc.managerCustomerId) : null;
  }

  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${mutateCid}/googleAds:searchStream`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: buildGoogleAdsHeaders(operational.accessToken, developerToken, loginForQuery),
      body: JSON.stringify({ query }),
    });
    const text = await res.text();
    if (!res.ok) {
      const classified = classifyGoogleAdsError(text);
      if (!classified.ok) {
        return { ok: false, message: classified.message };
      }
      return { ok: false, message: text.length > 300 ? `${text.slice(0, 300)}…` : text };
    }
    const raw = JSON.parse(text) as unknown;
    const batches = Array.isArray(raw) ? raw : [raw];
    for (const batch of batches) {
      const results = (batch as { results?: Record<string, unknown>[] }).results ?? [];
      for (const row of results) {
        const camp = row.campaign as Record<string, unknown> | undefined;
        const bud = (row.campaignBudget ?? row.campaign_budget) as Record<string, unknown> | undefined;
        const cr = (camp?.resourceName ?? camp?.resource_name) as string | undefined;
        const br = (bud?.resourceName ?? bud?.resource_name) as string | undefined;
        const amRaw = bud?.amountMicros ?? bud?.amount_micros;
        const n = typeof amRaw === "string" ? parseInt(amRaw, 10) : Number(amRaw ?? 0);
        if (cr && br && Number.isFinite(n) && n > 0) {
          return {
            ok: true,
            campaignResourceName: cr,
            budgetResourceName: br,
            amountMicros: n,
          };
        }
      }
    }
    return { ok: false, message: "Orçamento da campanha não encontrado na API Google Ads." };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, message: raw };
  }
}

/** Define orçamento diário (amount_micros) no CampaignBudget vinculado. */
export async function mutateGoogleCampaignDailyBudget(
  organizationId: string,
  campaignExternalId: string,
  dailyBudgetMajorUnits: number,
  queryContext?: GoogleAdsMetricsQueryContext
): Promise<{ ok: true } | { ok: false; message: string }> {
  const major = Number(dailyBudgetMajorUnits);
  if (!Number.isFinite(major) || major <= 0) {
    return { ok: false, message: "Orçamento diário inválido." };
  }
  const nextMicros = Math.max(1_000_000, Math.round(major * 1_000_000));

  const cur = await fetchGoogleCampaignBudgetMicros(organizationId, campaignExternalId, queryContext);
  if (!cur.ok) {
    return { ok: false, message: cur.message };
  }

  if (isGoogleAdsUxPending()) {
    return { ok: false, message: MSG_API_NOT_READY };
  }
  const operational = await resolveGoogleAdsOperationalContext(organizationId, {
    clientAccountId: queryContext?.clientAccountId,
  });
  if (!operational.ok) {
    return { ok: false, message: operational.message };
  }
  const resolved = resolveGoogleCampaignResource(campaignExternalId, operational.customerId!);
  if (!resolved) {
    return { ok: false, message: "ID de campanha inválido." };
  }
  const mutateCid = normalizeGoogleAdsCustomerId(resolved.customerId);
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN.trim();

  let loginForMutate = operational.loginCustomerId;
  if (normalizeGoogleAdsCustomerId(resolved.customerId) !== normalizeGoogleAdsCustomerId(operational.customerId!)) {
    const acc = await prisma.googleAdsAccessibleCustomer.findUnique({
      where: {
        integrationId_customerId: {
          integrationId: operational.integrationId,
          customerId: mutateCid,
        },
      },
    });
    loginForMutate = acc?.managerCustomerId ? normalizeGoogleAdsCustomerId(acc.managerCustomerId) : null;
  }

  const budgetUrl = `https://googleads.googleapis.com/${API_VERSION}/customers/${mutateCid}/campaignBudgets:mutate`;
  try {
    const res = await fetch(budgetUrl, {
      method: "POST",
      headers: buildGoogleAdsHeaders(operational.accessToken, developerToken, loginForMutate),
      body: JSON.stringify({
        operations: [
          {
            update: {
              resourceName: cur.budgetResourceName,
              amountMicros: String(nextMicros),
            },
            updateMask: "amount_micros",
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
    return { ok: false, message: raw };
  }
}

/** Pausa / ativa conjunto de anúncios (Google Ads API). */
export async function mutateGoogleAdGroupStatus(
  organizationId: string,
  adGroupExternalId: string,
  enabled: boolean,
  queryContext?: GoogleAdsMetricsQueryContext
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await resolveGoogleAdsCustomer(organizationId, queryContext);
  if (!ctx.ok) {
    return { ok: false, message: ctx.message };
  }
  if (!ctx.customerId) {
    return { ok: false, message: "Nenhuma conta Google Ads acessível para esta organização." };
  }
  const resolved = resolveGoogleAdGroupResource(adGroupExternalId, ctx.customerId);
  if (!resolved) {
    return {
      ok: false,
      message:
        "ID de conjunto inválido. Use o ID numérico ou o resourceName (customers/…/adGroups/…).",
    };
  }
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN.trim();
  const status = enabled ? "ENABLED" : "PAUSED";
  const mutateCid = normalizeGoogleAdsCustomerId(resolved.customerId);
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${mutateCid}/adGroups:mutate`;

  let loginForMutate = ctx.loginCustomerId;
  if (normalizeGoogleAdsCustomerId(resolved.customerId) !== normalizeGoogleAdsCustomerId(ctx.customerId)) {
    const acc = await prisma.googleAdsAccessibleCustomer.findUnique({
      where: {
        integrationId_customerId: {
          integrationId: ctx.integrationId,
          customerId: mutateCid,
        },
      },
    });
    loginForMutate = acc?.managerCustomerId ? normalizeGoogleAdsCustomerId(acc.managerCustomerId) : null;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: buildGoogleAdsHeaders(ctx.accessToken, developerToken, loginForMutate),
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
