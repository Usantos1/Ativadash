/**
 * Payload agregado para o dashboard executivo (Meta Ads).
 * Summary alinhado à soma da série diária para métricas aditivas (spend, impressions, clicks, etc.).
 */

import { prisma } from "../utils/prisma.js";
import type { MarketingDashboardGoalContext } from "./business-goal-mode.js";
import { computeGoogleAdsIntegrationUiStatus } from "../utils/google-ads-readiness.js";
import { fetchGoogleAdsMetrics } from "./google-ads-metrics.service.js";
import { metaGraphGet, metaGraphGetAllPages, getMetaAppSecret } from "./meta/meta-graph.js";
import { resolveMetaAdAccountsForQuery } from "./meta-ads-accounts.service.js";
import {
  type ActionEntry,
  type CostPerActionEntry,
  type MetaInsightEngagement,
  computeDerivedRates,
  emptyEngagement,
  mergeEngagement,
  parseInsightEngagement,
} from "./meta/meta-insights-parse.js";

const META_SLUG = "meta";
const GOOGLE_SLUG = "google-ads";

/** Gasto Google no período (BRL), mesma fonte que GET /marketing/google-ads/metrics. */
async function googleSpendBrlForOrg(
  organizationId: string,
  range: { start: string; end: string },
  googleConnected: boolean
): Promise<number> {
  if (!googleConnected) return 0;
  const res = await fetchGoogleAdsMetrics(organizationId, range);
  return res.ok ? res.summary.costMicros / 1_000_000 : 0;
}

/** Participação Meta vs Google alinhada ao endpoint de métricas Google (não só Meta 100%). */
function distributionByPlatform(metaSpendBrl: number, googleSpendBrl: number) {
  const m = Number.isFinite(metaSpendBrl) ? metaSpendBrl : 0;
  const g = Number.isFinite(googleSpendBrl) ? googleSpendBrl : 0;
  const total = m + g;
  if (total <= 0) {
    return [
      { platform: "Meta Ads" as const, spendSharePct: 100, spend: "0.00" },
      { platform: "Google Ads" as const, spendSharePct: 0, spend: "0.00" },
    ];
  }
  const rows = [
    { platform: "Meta Ads" as const, spendSharePct: (m / total) * 100, spend: m.toFixed(2) },
    { platform: "Google Ads" as const, spendSharePct: (g / total) * 100, spend: g.toFixed(2) },
  ];
  rows.sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend));
  return rows;
}

const HOT_NAME_RE =
  /remarketing|retarget|retargeting|\brmkt\b|quente|warm|carrinho|checkout|compra|venda|purchase|boiler|\bsig\b|vivo|convers/i;

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isHotCampaignName(name: string): boolean {
  return HOT_NAME_RE.test(normalizeName(name));
}

type GradePct = { A: number; B: number; C: number; D: number };
type GradeLetter = "A" | "B" | "C" | "D";

function gradeDistributionFromMetaCampaigns(
  rows: { campaignName: string; leads: number; purchases: number; clicks: number; impressions: number }[]
): GradePct {
  type W = { ctr: number; weight: number };
  const items: W[] = [];
  for (const r of rows) {
    const w = r.leads + r.purchases + r.clicks * 0.1;
    if (w <= 0 && r.impressions <= 0) continue;
    const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
    items.push({ ctr, weight: Math.max(1, w) });
  }
  if (items.length === 0) return { A: 0, B: 0, C: 0, D: 0 };
  items.sort((a, b) => b.ctr - a.ctr);
  const tw = items.reduce((s, x) => s + x.weight, 0);
  const grades = { A: 0, B: 0, C: 0, D: 0 };
  const n = items.length;
  items.forEach((c, i) => {
    const q = i / n;
    const g: GradeLetter = q < 0.25 ? "A" : q < 0.5 ? "B" : q < 0.75 ? "C" : "D";
    grades[g] += c.weight;
  });
  return {
    A: tw > 0 ? (grades.A / tw) * 100 : 0,
    B: tw > 0 ? (grades.B / tw) * 100 : 0,
    C: tw > 0 ? (grades.C / tw) * 100 : 0,
    D: tw > 0 ? (grades.D / tw) * 100 : 0,
  };
}

async function getMetaToken(organizationId: string): Promise<string | null> {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_slug: { organizationId, slug: META_SLUG } },
  });
  if (!integration?.config || integration.status !== "connected") return null;
  try {
    const c = JSON.parse(integration.config) as { access_token?: string };
    return c.access_token ?? null;
  } catch {
    return null;
  }
}

type RawDailyRow = {
  date_start?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  inline_link_clicks?: string;
  reach?: string;
  frequency?: string;
  actions?: ActionEntry[];
  action_values?: ActionEntry[];
  cost_per_action_type?: CostPerActionEntry[];
};

type MergedDay = {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  linkClicks: number;
  linkClicksKnown: boolean;
  reach: number;
  reachKnown: boolean;
  engagement: MetaInsightEngagement;
};

function parseInsightRow(
  row: RawDailyRow,
  debugCtx: string
): {
  impressions: number;
  clicks: number;
  spend: number;
  linkClicks: number;
  linkClicksKnown: boolean;
  reach: number;
  reachKnown: boolean;
  engagement: MetaInsightEngagement;
} {
  const impressions = parseInt(row.impressions ?? "0", 10) || 0;
  const clicks = parseInt(row.clicks ?? "0", 10) || 0;
  const spend = parseFloat(row.spend ?? "0") || 0;
  const rawLk = row.inline_link_clicks;
  const linkClicksKnown = rawLk !== undefined && rawLk !== "";
  const linkClicks = linkClicksKnown ? parseInt(rawLk ?? "0", 10) || 0 : 0;
  const rawR = row.reach;
  const reachKnown = rawR !== undefined && rawR !== "";
  const reach = reachKnown ? parseInt(rawR ?? "0", 10) || 0 : 0;
  const engagement = parseInsightEngagement(
    row.actions,
    row.action_values,
    row.cost_per_action_type,
    debugCtx
  );
  return { impressions, clicks, spend, linkClicks, linkClicksKnown, reach, reachKnown, engagement };
}

async function fetchDailyForAccount(
  accountNumericId: string,
  accessToken: string,
  appSecret: string,
  timeRange: string
): Promise<Map<string, MergedDay>> {
  const fieldsFull =
    "date_start,impressions,clicks,spend,inline_link_clicks,reach,frequency,actions,action_values,cost_per_action_type";
  const fieldsBasic = "date_start,impressions,clicks,spend,inline_link_clicks,actions,action_values,cost_per_action_type";

  let rows: RawDailyRow[] = [];
  try {
    const path = `/act_${accountNumericId}/insights?fields=${fieldsFull}&time_range=${encodeURIComponent(timeRange)}&time_increment=1&level=account&limit=500`;
    rows = await metaGraphGetAllPages<RawDailyRow>(path, accessToken, appSecret);
  } catch (e) {
    console.warn(
      `[Meta dashboard] daily com reach falhou act_${accountNumericId}:`,
      e instanceof Error ? e.message : e
    );
    const path = `/act_${accountNumericId}/insights?fields=${fieldsBasic}&time_range=${encodeURIComponent(timeRange)}&time_increment=1&level=account&limit=500`;
    rows = await metaGraphGetAllPages<RawDailyRow>(path, accessToken, appSecret);
  }

  const map = new Map<string, MergedDay>();
  for (const row of rows) {
    const d = row.date_start ?? "";
    if (!d) continue;
    const p = parseInsightRow(row, `daily:${accountNumericId}:${d}`);
    const cur = map.get(d);
    if (cur) {
      cur.impressions += p.impressions;
      cur.clicks += p.clicks;
      cur.spend += p.spend;
      if (p.linkClicksKnown) {
        cur.linkClicks += p.linkClicks;
        cur.linkClicksKnown = true;
      }
      if (p.reachKnown) {
        cur.reach += p.reach;
        cur.reachKnown = true;
      }
      cur.engagement = mergeEngagement(cur.engagement, p.engagement);
    } else {
      map.set(d, {
        date: d,
        impressions: p.impressions,
        clicks: p.clicks,
        spend: p.spend,
        linkClicks: p.linkClicks,
        linkClicksKnown: p.linkClicksKnown,
        reach: p.reach,
        reachKnown: p.reachKnown,
        engagement: p.engagement,
      });
    }
  }
  return map;
}

type CampaignInsightRow = RawDailyRow & {
  campaign_name?: string;
  campaign_id?: string;
};

/** Configuração na Meta (effective_status) — exposto ao dashboard para filtros. */
export type MarketingDashboardEntityStatus = "ACTIVE" | "PAUSED" | "ARCHIVED" | "UNKNOWN";

function normalizeMetaEffectiveStatus(raw: string | undefined): MarketingDashboardEntityStatus {
  if (!raw) return "UNKNOWN";
  const u = raw.toUpperCase();
  if (u.includes("ACTIVE")) return "ACTIVE";
  if (u.includes("PAUSED")) return "PAUSED";
  if (u.includes("ARCHIVED") || u.includes("DELETED") || u.includes("CAMPAIGN_GROUP_PAUSED"))
    return "ARCHIVED";
  return "UNKNOWN";
}

type CampaignMetaRow = {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
};

async function fetchAllCampaignsForAccount(
  accountId: string,
  accessToken: string,
  appSecret: string
): Promise<CampaignMetaRow[]> {
  try {
    const path = `/act_${accountId}/campaigns?fields=id,name,status,effective_status&limit=500`;
    const rows = await metaGraphGetAllPages<{
      id?: string;
      name?: string;
      status?: string;
      effective_status?: string;
    }>(path, accessToken, appSecret);
    return rows
      .filter((r) => r.id)
      .map((r) => ({
        id: String(r.id),
        name: r.name ?? "—",
        status: r.status,
        effective_status: r.effective_status,
      }));
  } catch (e) {
    console.warn(
      `[Meta dashboard] campaigns list act_${accountId}:`,
      e instanceof Error ? e.message : e
    );
    return [];
  }
}

function chunkIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

async function fetchAdsetEffectiveStatusMap(
  accountId: string,
  adsetIds: string[],
  accessToken: string,
  appSecret: string
): Promise<Map<string, MarketingDashboardEntityStatus>> {
  const map = new Map<string, MarketingDashboardEntityStatus>();
  const unique = [...new Set(adsetIds.filter(Boolean))];
  for (const part of chunkIds(unique, 40)) {
    if (!part.length) continue;
    try {
      const filtering = encodeURIComponent(JSON.stringify([{ field: "id", operator: "IN", value: part }]));
      const path = `/act_${accountId}/adsets?fields=id,effective_status&limit=500&filtering=${filtering}`;
      const rows = await metaGraphGetAllPages<{ id?: string; effective_status?: string }>(
        path,
        accessToken,
        appSecret
      );
      for (const r of rows) {
        if (r.id) map.set(String(r.id), normalizeMetaEffectiveStatus(r.effective_status));
      }
    } catch (e) {
      console.warn(
        `[Meta dashboard] adset status act_${accountId}:`,
        e instanceof Error ? e.message : e
      );
    }
  }
  return map;
}

async function fetchAdEffectiveStatusMap(
  accountId: string,
  adIds: string[],
  accessToken: string,
  appSecret: string
): Promise<Map<string, MarketingDashboardEntityStatus>> {
  const map = new Map<string, MarketingDashboardEntityStatus>();
  const unique = [...new Set(adIds.filter(Boolean))];
  for (const part of chunkIds(unique, 40)) {
    if (!part.length) continue;
    try {
      const filtering = encodeURIComponent(JSON.stringify([{ field: "id", operator: "IN", value: part }]));
      const path = `/act_${accountId}/ads?fields=id,effective_status&limit=500&filtering=${filtering}`;
      const rows = await metaGraphGetAllPages<{ id?: string; effective_status?: string }>(
        path,
        accessToken,
        appSecret
      );
      for (const r of rows) {
        if (r.id) map.set(String(r.id), normalizeMetaEffectiveStatus(r.effective_status));
      }
    } catch (e) {
      console.warn(`[Meta dashboard] ad status act_${accountId}:`, e instanceof Error ? e.message : e);
    }
  }
  return map;
}

function buildPerfRow(
  name: string,
  id: string | undefined,
  objective: string | null,
  impressions: number,
  clicks: number,
  spend: number,
  linkClicks: number,
  linkClicksKnown: boolean,
  reach: number,
  reachKnown: boolean,
  engagement: MetaInsightEngagement,
  parentName?: string | null,
  entityStatus?: MarketingDashboardEntityStatus | null
) {
  const leads = engagement.leads;
  const purchases = engagement.purchases;
  const purchaseValue = engagement.purchaseValue;
  const ctrPct = impressions > 0 ? (clicks / impressions) * 100 : null;
  const cpc = clicks > 0 && spend > 0 ? spend / clicks : null;
  const cpl = leads > 0 && spend > 0 ? spend / leads : null;
  const roas = spend > 0 && purchaseValue > 0 ? purchaseValue / spend : null;
  return {
    id: id ?? name,
    name,
    parentName: parentName ?? null,
    objective,
    spend,
    impressions,
    reach: reachKnown ? reach : null,
    reachReturned: reachKnown,
    clicks,
    linkClicks: linkClicksKnown ? linkClicks : null,
    ctrPct,
    cpc,
    leads,
    cpl,
    purchases,
    purchaseValue,
    roas,
    messagingConversations: engagement.messagingConversationsStarted,
    landingPageViews: engagement.landingPageViews,
    initiateCheckout: engagement.initiateCheckout,
    addToCart: engagement.addToCart,
    completeRegistration: engagement.completeRegistration,
    entityStatus: entityStatus ?? null,
  };
}

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
  derived: ReturnType<typeof computeDerivedRates>;
  reconciliation: {
    spendFromTimeseries: number;
    spendMatchesSummary: boolean;
    impressionsMatches: boolean;
    clicksMatches: boolean;
  };
};

export type MarketingDashboardPerfRow = ReturnType<typeof buildPerfRow>;

export type MarketingDashboardPayload =
  | {
      ok: true;
      range: { start: string; end: string };
      summary: MarketingDashboardSummary;
      timeseries: MarketingDashboardTimeseriesRow[];
      distribution: {
        byPlatform: { platform: string; spendSharePct: number; spend: string }[];
        byTemperature: { segment: "hot" | "cold"; spend: number; spendSharePct: number; volume: number }[];
        byScore: GradePct;
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
          status: import("../utils/google-ads-readiness.js").GoogleAdsIntegrationUiStatus;
        };
      };
      /** Objetivo da conta (MarketingSettings) — anexado no controller após o payload base. */
      goalContext?: MarketingDashboardGoalContext;
    }
  | { ok: false; message: string };

async function fetchCampaignRows(
  accountId: string,
  accessToken: string,
  appSecret: string,
  timeRange: string
): Promise<CampaignInsightRow[]> {
  const fields =
    "campaign_id,campaign_name,impressions,clicks,spend,inline_link_clicks,reach,frequency,actions,action_values,cost_per_action_type";
  try {
    const path = `/act_${accountId}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRange)}&level=campaign&limit=500`;
    return await metaGraphGetAllPages<CampaignInsightRow>(path, accessToken, appSecret);
  } catch (e) {
    console.warn(`[Meta dashboard] campaign insights fallback act_${accountId}:`, e instanceof Error ? e.message : e);
    const fieldsBasic =
      "campaign_id,campaign_name,impressions,clicks,spend,inline_link_clicks,actions,action_values,cost_per_action_type";
    const path = `/act_${accountId}/insights?fields=${fieldsBasic}&time_range=${encodeURIComponent(timeRange)}&level=campaign&limit=500`;
    return await metaGraphGetAllPages<CampaignInsightRow>(path, accessToken, appSecret);
  }
}

async function fetchAdsetRowsForDashboard(
  accountId: string,
  accessToken: string,
  appSecret: string,
  timeRange: string
): Promise<
  {
    adset_id?: string;
    adset_name?: string;
    campaign_name?: string;
    impressions?: string;
    clicks?: string;
    spend?: string;
    inline_link_clicks?: string;
    reach?: string;
    actions?: ActionEntry[];
    action_values?: ActionEntry[];
    cost_per_action_type?: CostPerActionEntry[];
  }[]
> {
  const fields =
    "adset_id,adset_name,campaign_name,impressions,clicks,spend,inline_link_clicks,reach,actions,action_values,cost_per_action_type";
  try {
    const path = `/act_${accountId}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRange)}&level=adset&limit=500`;
    return await metaGraphGetAllPages(path, accessToken, appSecret);
  } catch {
    const path = `/act_${accountId}/insights?fields=adset_id,adset_name,campaign_name,impressions,clicks,spend,inline_link_clicks,actions,action_values&time_range=${encodeURIComponent(timeRange)}&level=adset&limit=500`;
    return await metaGraphGetAllPages(path, accessToken, appSecret);
  }
}

async function fetchAdRowsForDashboard(
  accountId: string,
  accessToken: string,
  appSecret: string,
  timeRange: string
): Promise<
  {
    ad_id?: string;
    ad_name?: string;
    adset_name?: string;
    campaign_name?: string;
    impressions?: string;
    clicks?: string;
    spend?: string;
    inline_link_clicks?: string;
    reach?: string;
    actions?: ActionEntry[];
    action_values?: ActionEntry[];
    cost_per_action_type?: CostPerActionEntry[];
  }[]
> {
  const fields =
    "ad_id,ad_name,adset_name,campaign_name,impressions,clicks,spend,inline_link_clicks,reach,actions,action_values,cost_per_action_type";
  try {
    const path = `/act_${accountId}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRange)}&level=ad&limit=500`;
    return await metaGraphGetAllPages(path, accessToken, appSecret);
  } catch {
    const path = `/act_${accountId}/insights?fields=ad_id,ad_name,adset_name,campaign_name,impressions,clicks,spend,inline_link_clicks,actions,action_values&time_range=${encodeURIComponent(timeRange)}&level=ad&limit=500`;
    return await metaGraphGetAllPages(path, accessToken, appSecret);
  }
}

export async function fetchMarketingDashboardPayload(
  organizationId: string,
  range: { start: string; end: string },
  options?: { clientAccountId?: string | null }
): Promise<MarketingDashboardPayload> {
  const accessToken = await getMetaToken(organizationId);
  const appSecret = getMetaAppSecret();
  if (!accessToken) {
    return { ok: false, message: "Meta Ads não conectado. Conecte em Integrações." };
  }
  if (!appSecret) {
    return { ok: false, message: "META_APP_SECRET não configurado no servidor." };
  }

  const timeRange = JSON.stringify({ since: range.start, until: range.end });

  const integrations = await prisma.integration.findMany({
    where: { organizationId },
    select: { slug: true, status: true },
  });
  const metaInt = integrations.find((i) => i.slug === META_SLUG);
  const googleInt = integrations.find((i) => i.slug === GOOGLE_SLUG);
  const googleConnected = googleInt?.status === "connected";
  const googleStatus = computeGoogleAdsIntegrationUiStatus(googleConnected);

  try {
    const resolved = await resolveMetaAdAccountsForQuery(organizationId, options?.clientAccountId);
    const accounts =
      "error" in resolved
        ? []
        : (resolved.accounts as { id: string; name: string; account_id: string }[]);
    if ("error" in resolved && accounts.length === 0 && resolved.error !== "not_connected") {
      console.warn("[Marketing dashboard] Meta resolve:", resolved.error);
    }

    if (accounts.length === 0) {
      return {
        ok: true,
        range,
        summary: {
          spend: 0,
          impressions: 0,
          clicks: 0,
          linkClicks: 0,
          linkClicksReturned: true,
          reach: null,
          reachNote: "unavailable",
          frequency: null,
          frequencySource: null,
          leads: 0,
          purchases: 0,
          purchaseValue: 0,
          messagingConversations: 0,
          landingPageViews: 0,
          initiateCheckout: 0,
          addToCart: 0,
          completeRegistration: 0,
          derived: computeDerivedRates({
            spend: 0,
            impressions: 0,
            clicks: 0,
            linkClicks: 0,
            leads: 0,
            purchases: 0,
            purchaseValue: 0,
            reach: null,
            frequencyFromApi: null,
          }),
          reconciliation: {
            spendFromTimeseries: 0,
            spendMatchesSummary: true,
            impressionsMatches: true,
            clicksMatches: true,
          },
        },
        timeseries: [],
        distribution: {
          byPlatform: distributionByPlatform(0, 0),
          byTemperature: [],
          byScore: { A: 0, B: 0, C: 0, D: 0 },
        },
        performanceByLevel: { campaigns: [], adsets: [], ads: [] },
        integrationStatus: {
          metaAds: { connected: true, healthy: true },
          googleAds: { connected: googleConnected, status: googleStatus },
        },
      };
    }

    const mergedDaily = new Map<string, MergedDay>();
    let periodReachAccount = 0;
    let periodFreqWeight = 0;
    let periodImpForFreq = 0;

    const campaignMap = new Map<string, CampaignInsightRow & { _engagement: MetaInsightEngagement }>();
    const adsetOut: MarketingDashboardPerfRow[] = [];
    const adOut: MarketingDashboardPerfRow[] = [];
    const allCampaignMetaById = new Map<string, CampaignMetaRow>();

    type AccInsight = {
      impressions?: string;
      reach?: string;
      frequency?: string;
    };

    for (const account of accounts) {
      const accountId = account.id.replace("act_", "");

      const [part, accInsightRes, campRows, adsetRows, ads, campaignListMeta] = await Promise.all([
        fetchDailyForAccount(accountId, accessToken, appSecret, timeRange),
        metaGraphGet<{ data: AccInsight[] }>(
          `/act_${accountId}/insights?fields=impressions,reach,frequency&time_range=${encodeURIComponent(timeRange)}&level=account`,
          accessToken,
          appSecret
        ).catch((e) => {
          console.warn(`[Meta dashboard] account reach act_${accountId}:`, e instanceof Error ? e.message : e);
          return { data: [] as AccInsight[] };
        }),
        fetchCampaignRows(accountId, accessToken, appSecret, timeRange),
        fetchAdsetRowsForDashboard(accountId, accessToken, appSecret, timeRange),
        fetchAdRowsForDashboard(accountId, accessToken, appSecret, timeRange),
        fetchAllCampaignsForAccount(accountId, accessToken, appSecret).catch((e) => {
          console.warn(`[Meta dashboard] campaign list act_${accountId}:`, e instanceof Error ? e.message : e);
          return [] as CampaignMetaRow[];
        }),
      ]);

      for (const [d, v] of part) {
        const cur = mergedDaily.get(d);
        if (cur) {
          cur.impressions += v.impressions;
          cur.clicks += v.clicks;
          cur.spend += v.spend;
          if (v.linkClicksKnown) {
            cur.linkClicks += v.linkClicks;
            cur.linkClicksKnown = true;
          }
          if (v.reachKnown) {
            cur.reach += v.reach;
            cur.reachKnown = true;
          }
          cur.engagement = mergeEngagement(cur.engagement, v.engagement);
        } else {
          mergedDaily.set(d, { ...v });
        }
      }

      const ar = accInsightRes.data?.[0];
      if (ar) {
        const imp = parseInt(ar.impressions ?? "0", 10) || 0;
        const rch = parseInt(ar.reach ?? "0", 10) || 0;
        const freq = parseFloat(ar.frequency ?? "0") || 0;
        periodReachAccount += rch;
        if (imp > 0 && freq > 0) {
          periodFreqWeight += freq * imp;
          periodImpForFreq += imp;
        }
      }

      for (const c of campRows) {
        const key = c.campaign_id ?? c.campaign_name ?? Math.random().toString();
        const imp = parseInt(c.impressions ?? "0", 10) || 0;
        const clk = parseInt(c.clicks ?? "0", 10) || 0;
        const sp = parseFloat(c.spend ?? "0") || 0;
        const rawLk = c.inline_link_clicks;
        const lkKnown = rawLk !== undefined && rawLk !== "";
        const lk = lkKnown ? parseInt(rawLk ?? "0", 10) || 0 : 0;
        const rawR = c.reach;
        const rKnown = rawR !== undefined && rawR !== "";
        const rch = rKnown ? parseInt(rawR ?? "0", 10) || 0 : 0;
        const eng = parseInsightEngagement(
          c.actions,
          c.action_values,
          c.cost_per_action_type,
          `campaign:${key}`
        );
        const ex = campaignMap.get(key);
        if (ex) {
          ex.impressions = String((parseInt(ex.impressions ?? "0", 10) || 0) + imp);
          ex.clicks = String((parseInt(ex.clicks ?? "0", 10) || 0) + clk);
          ex.spend = String((parseFloat(ex.spend ?? "0") || 0) + sp);
          ex._engagement = mergeEngagement(ex._engagement, eng);
          if (lkKnown) {
            const prev = ex.inline_link_clicks ? parseInt(ex.inline_link_clicks, 10) || 0 : 0;
            ex.inline_link_clicks = String(prev + lk);
          }
          if (rKnown) {
            const prev = ex.reach ? parseInt(ex.reach, 10) || 0 : 0;
            ex.reach = String(prev + rch);
          }
        } else {
          campaignMap.set(key, {
            ...c,
            impressions: String(imp),
            clicks: String(clk),
            spend: String(sp),
            inline_link_clicks: lkKnown ? String(lk) : c.inline_link_clicks,
            reach: rKnown ? String(rch) : c.reach,
            _engagement: eng,
          });
        }
      }

      for (const cm of campaignListMeta) {
        if (!allCampaignMetaById.has(cm.id)) allCampaignMetaById.set(cm.id, cm);
      }

      const adsetIdsForStatus = adsetRows
        .map((x) => (x.adset_id != null ? String(x.adset_id) : ""))
        .filter(Boolean);
      const adIdsForStatus = ads
        .map((x) => (x.ad_id != null ? String(x.ad_id) : ""))
        .filter(Boolean);
      const [adsetStatusMap, adStatusMap] = await Promise.all([
        fetchAdsetEffectiveStatusMap(accountId, adsetIdsForStatus, accessToken, appSecret),
        fetchAdEffectiveStatusMap(accountId, adIdsForStatus, accessToken, appSecret),
      ]);

      for (const r of adsetRows) {
        const imp = parseInt(r.impressions ?? "0", 10) || 0;
        const clk = parseInt(r.clicks ?? "0", 10) || 0;
        const sp = parseFloat(r.spend ?? "0") || 0;
        const rawLk = r.inline_link_clicks;
        const lkK = rawLk !== undefined && rawLk !== "";
        const lk = lkK ? parseInt(rawLk ?? "0", 10) || 0 : 0;
        const rawR = r.reach;
        const rK = rawR !== undefined && rawR !== "";
        const rch = rK ? parseInt(rawR ?? "0", 10) || 0 : 0;
        const eng = parseInsightEngagement(r.actions, r.action_values, r.cost_per_action_type, `adset:${r.adset_id}`);
        const aid = r.adset_id != null ? String(r.adset_id) : "";
        const adsetSt = aid ? adsetStatusMap.get(aid) ?? null : null;
        adsetOut.push(
          buildPerfRow(
            r.adset_name ?? "—",
            r.adset_id,
            null,
            imp,
            clk,
            sp,
            lk,
            lkK,
            rch,
            rK,
            eng,
            r.campaign_name ?? null,
            adsetSt
          )
        );
      }

      for (const r of ads) {
        const imp = parseInt(r.impressions ?? "0", 10) || 0;
        const clk = parseInt(r.clicks ?? "0", 10) || 0;
        const sp = parseFloat(r.spend ?? "0") || 0;
        const rawLk = r.inline_link_clicks;
        const lkK = rawLk !== undefined && rawLk !== "";
        const lk = lkK ? parseInt(rawLk ?? "0", 10) || 0 : 0;
        const rawR = r.reach;
        const rK = rawR !== undefined && rawR !== "";
        const rch = rK ? parseInt(rawR ?? "0", 10) || 0 : 0;
        const eng = parseInsightEngagement(r.actions, r.action_values, r.cost_per_action_type, `ad:${r.ad_id}`);
        const adid = r.ad_id != null ? String(r.ad_id) : "";
        const adSt = adid ? adStatusMap.get(adid) ?? null : null;
        adOut.push(
          buildPerfRow(
            r.ad_name ?? "—",
            r.ad_id,
            null,
            imp,
            clk,
            sp,
            lk,
            lkK,
            rch,
            rK,
            eng,
            r.adset_name ?? null,
            adSt
          )
        );
      }
    }

    const sortedDates = Array.from(mergedDaily.keys()).sort((a, b) => a.localeCompare(b));
    let sumImp = 0;
    let sumClk = 0;
    let sumSpend = 0;
    let sumLink = 0;
    let anyLink = false;
    let sumReachDaily = 0;
    let anyReachDaily = false;
    let totalEng = emptyEngagement();

    const timeseries: MarketingDashboardTimeseriesRow[] = [];
    for (const d of sortedDates) {
      const v = mergedDaily.get(d)!;
      sumImp += v.impressions;
      sumClk += v.clicks;
      sumSpend += v.spend;
      if (v.linkClicksKnown) {
        sumLink += v.linkClicks;
        anyLink = true;
      }
      if (v.reachKnown) {
        sumReachDaily += v.reach;
        anyReachDaily = true;
      }
      totalEng = mergeEngagement(totalEng, v.engagement);

      const ctrPct = v.impressions > 0 ? (v.clicks / v.impressions) * 100 : null;
      const cpc = v.clicks > 0 && v.spend > 0 ? v.spend / v.clicks : null;
      timeseries.push({
        date: d,
        spend: v.spend,
        impressions: v.impressions,
        clicks: v.clicks,
        linkClicks: v.linkClicksKnown ? v.linkClicks : null,
        leads: v.engagement.leads,
        purchases: v.engagement.purchases,
        purchaseValue: v.engagement.purchaseValue,
        ctrPct,
        cpc,
      });
    }

    const freqFromApi = periodImpForFreq > 0 ? periodFreqWeight / periodImpForFreq : null;
    const reachForDerived = periodReachAccount > 0 ? periodReachAccount : anyReachDaily ? sumReachDaily : null;
    const reachNote: MarketingDashboardSummary["reachNote"] =
      periodReachAccount > 0
        ? "period_account_level"
        : anyReachDaily
          ? "sum_daily_per_account"
          : "unavailable";

    const derived = computeDerivedRates({
      spend: sumSpend,
      impressions: sumImp,
      clicks: sumClk,
      linkClicks: anyLink ? sumLink : 0,
      leads: totalEng.leads,
      purchases: totalEng.purchases,
      purchaseValue: totalEng.purchaseValue,
      reach: reachForDerived,
      frequencyFromApi: freqFromApi,
    });

    const summary: MarketingDashboardSummary = {
      spend: sumSpend,
      impressions: sumImp,
      clicks: sumClk,
      linkClicks: anyLink ? sumLink : null,
      linkClicksReturned: anyLink,
      reach: reachForDerived,
      reachNote,
      frequency: derived.frequency,
      frequencySource: derived.frequencySource,
      leads: totalEng.leads,
      purchases: totalEng.purchases,
      purchaseValue: totalEng.purchaseValue,
      messagingConversations: totalEng.messagingConversationsStarted,
      landingPageViews: totalEng.landingPageViews,
      initiateCheckout: totalEng.initiateCheckout,
      addToCart: totalEng.addToCart,
      completeRegistration: totalEng.completeRegistration,
      derived: {
        ...derived,
      },
      reconciliation: {
        spendFromTimeseries: timeseries.reduce((s, r) => s + r.spend, 0),
        spendMatchesSummary: Math.abs(timeseries.reduce((s, r) => s + r.spend, 0) - sumSpend) < 0.02,
        impressionsMatches:
          Math.abs(timeseries.reduce((s, r) => s + r.impressions, 0) - sumImp) < 1,
        clicksMatches: Math.abs(timeseries.reduce((s, r) => s + r.clicks, 0) - sumClk) < 1,
      },
    };

    const campaignsPerf: MarketingDashboardPerfRow[] = [];
    const campaignKeysOrdered = [
      ...new Set([...allCampaignMetaById.keys(), ...campaignMap.keys()]),
    ];

    if (allCampaignMetaById.size > 0) {
      for (const key of campaignKeysOrdered) {
        const meta = allCampaignMetaById.get(key);
        const c = campaignMap.get(key);
        const st = meta
          ? normalizeMetaEffectiveStatus(meta.effective_status || meta.status)
          : null;
        if (c) {
          const imp = parseInt(c.impressions ?? "0", 10) || 0;
          const clk = parseInt(c.clicks ?? "0", 10) || 0;
          const sp = parseFloat(c.spend ?? "0") || 0;
          const rawLk = c.inline_link_clicks;
          const lkK = rawLk !== undefined && rawLk !== "";
          const lk = lkK ? parseInt(rawLk ?? "0", 10) || 0 : 0;
          const rawR = c.reach;
          const rK = rawR !== undefined && rawR !== "";
          const rch = rK ? parseInt(rawR ?? "0", 10) || 0 : 0;
          campaignsPerf.push(
            buildPerfRow(
              c.campaign_name ?? meta?.name ?? "—",
              c.campaign_id ?? key,
              null,
              imp,
              clk,
              sp,
              lk,
              lkK,
              rch,
              rK,
              c._engagement,
              null,
              st
            )
          );
        } else if (meta) {
          campaignsPerf.push(
            buildPerfRow(
              meta.name,
              meta.id,
              null,
              0,
              0,
              0,
              0,
              false,
              0,
              false,
              emptyEngagement(),
              null,
              st
            )
          );
        }
      }
    } else {
      for (const [, c] of campaignMap) {
        const imp = parseInt(c.impressions ?? "0", 10) || 0;
        const clk = parseInt(c.clicks ?? "0", 10) || 0;
        const sp = parseFloat(c.spend ?? "0") || 0;
        const rawLk = c.inline_link_clicks;
        const lkK = rawLk !== undefined && rawLk !== "";
        const lk = lkK ? parseInt(rawLk ?? "0", 10) || 0 : 0;
        const rawR = c.reach;
        const rK = rawR !== undefined && rawR !== "";
        const rch = rK ? parseInt(rawR ?? "0", 10) || 0 : 0;
        campaignsPerf.push(
          buildPerfRow(
            c.campaign_name ?? "—",
            c.campaign_id,
            null,
            imp,
            clk,
            sp,
            lk,
            lkK,
            rch,
            rK,
            c._engagement,
            null,
            null
          )
        );
      }
    }
    campaignsPerf.sort((a, b) => b.spend - a.spend);
    adsetOut.sort((a, b) => b.spend - a.spend);
    adOut.sort((a, b) => b.spend - a.spend);

    let hotSpend = 0;
    let coldSpend = 0;
    let hotVol = 0;
    let coldVol = 0;
    for (const r of campaignsPerf) {
      const h = isHotCampaignName(r.name);
      const vol = r.leads + r.messagingConversations + r.purchases;
      if (h) {
        hotSpend += r.spend;
        hotVol += vol;
      } else {
        coldSpend += r.spend;
        coldVol += vol;
      }
    }
    const tempTotal = hotSpend + coldSpend;
    const byTemperature =
      tempTotal > 0
        ? [
            {
              segment: "hot" as const,
              spend: hotSpend,
              spendSharePct: (hotSpend / tempTotal) * 100,
              volume: hotVol,
            },
            {
              segment: "cold" as const,
              spend: coldSpend,
              spendSharePct: (coldSpend / tempTotal) * 100,
              volume: coldVol,
            },
          ]
        : [];

    const byScore = gradeDistributionFromMetaCampaigns(
      campaignsPerf.map((r) => ({
        campaignName: r.name,
        leads: r.leads,
        purchases: r.purchases,
        clicks: r.clicks,
        impressions: r.impressions,
      }))
    );

    const googleSpendBrl = await googleSpendBrlForOrg(organizationId, range, googleConnected);

    return {
      ok: true,
      range,
      summary,
      timeseries,
      distribution: {
        byPlatform: distributionByPlatform(sumSpend, googleSpendBrl),
        byTemperature: byTemperature,
        byScore,
      },
      performanceByLevel: {
        campaigns: campaignsPerf,
        adsets: adsetOut,
        ads: adOut,
      },
      integrationStatus: {
        metaAds: { connected: metaInt?.status === "connected", healthy: true },
        googleAds: { connected: googleConnected, status: googleStatus },
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao montar dashboard de marketing.";
    console.error("[Marketing dashboard]", msg);
    return { ok: false, message: msg };
  }
}
