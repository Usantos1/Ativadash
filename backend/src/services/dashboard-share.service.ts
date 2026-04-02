import crypto from "node:crypto";
import { prisma } from "../utils/prisma.js";
import { fetchGoogleAdsMetrics } from "./google-ads-metrics.service.js";
import { fetchMetaAdsMetrics } from "./meta-ads-metrics.service.js";
import type { GoogleAdsMetricsResult } from "./google-ads-metrics.service.js";
import type { MetaAdsMetricsResult } from "./meta-ads-metrics.service.js";

export type DashboardSharePage = "painel" | "captacao" | "conversao" | "receita";

export type DashboardShareSections = {
  kpis: boolean;
  channels: boolean;
  chart: boolean;
  table: boolean;
  insights: boolean;
  funnel: boolean;
};

const DEFAULT_SECTIONS: DashboardShareSections = {
  kpis: true,
  channels: true,
  chart: true,
  table: false,
  insights: true,
  funnel: true,
};

function normalizeSections(raw: unknown): DashboardShareSections {
  const out = { ...DEFAULT_SECTIONS };
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  for (const key of ["kpis", "channels", "chart", "table", "insights", "funnel"] as const) {
    if (o[key] === true) out[key] = true;
    if (o[key] === false) out[key] = false;
  }
  return out;
}

export function isShareExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= Date.now();
}

export async function createDashboardShareLink(params: {
  organizationId: string;
  createdByUserId: string | null;
  page: DashboardSharePage;
  sections: DashboardShareSections;
  startDate: string;
  endDate: string;
  periodLabel: string;
  expiresAt: Date | null;
}): Promise<{ token: string; id: string }> {
  const token = crypto.randomBytes(24).toString("base64url");
  const row = await prisma.dashboardShareLink.create({
    data: {
      token,
      organizationId: params.organizationId,
      createdByUserId: params.createdByUserId,
      page: params.page,
      sectionsJson: params.sections as object,
      startDate: params.startDate,
      endDate: params.endDate,
      periodLabel: params.periodLabel.slice(0, 120),
      expiresAt: params.expiresAt,
    },
    select: { id: true, token: true },
  });
  return { id: row.id, token: row.token };
}

export async function getShareLinkByToken(token: string) {
  if (!token || token.length > 200) return null;
  return prisma.dashboardShareLink.findUnique({
    where: { token },
    include: { organization: { select: { id: true, name: true } } },
  });
}

type MetricsRange = { startDate: string; endDate: string };

const MONTHS_PT_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

function isoDaysInclusive(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const [ys, ms, ds] = startDate.split("-").map((x) => parseInt(x, 10));
  const [ye, me, de] = endDate.split("-").map((x) => parseInt(x, 10));
  let t = Date.UTC(ys, ms - 1, ds);
  const end = Date.UTC(ye, me - 1, de);
  while (t <= end) {
    const d = new Date(t);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
    t += 86400000;
  }
  return out;
}

function chartDayLabelPt(iso: string): string {
  const parts = iso.split("-");
  const mo = parts[1] ?? "01";
  const da = parts[2] ?? "01";
  const mi = parseInt(mo, 10) - 1;
  const month = MONTHS_PT_SHORT[mi] ?? mo;
  return `${parseInt(da, 10)}/${month}`;
}

export type ShareSnapshotChartPoint = {
  date: string;
  isoDate: string;
  gasto: number;
  leads: number;
  cpa: number;
};

function buildShareChartSeries(
  startDate: string,
  endDate: string,
  googleDaily: { date: string; costMicros: number; conversions: number }[] | undefined,
  metaDaily: { date: string; spend: number; leads: number }[] | undefined
): ShareSnapshotChartPoint[] {
  const gMap = new Map((googleDaily ?? []).map((d) => [d.date, d]));
  const mMap = new Map((metaDaily ?? []).map((d) => [d.date, d]));
  return isoDaysInclusive(startDate, endDate).map((isoDate) => {
    const g = gMap.get(isoDate);
    const m = mMap.get(isoDate);
    const gasto = (g?.costMicros ?? 0) / 1_000_000 + (m?.spend ?? 0);
    const leads = (g?.conversions ?? 0) + (m?.leads ?? 0);
    const cpa = leads > 0 ? gasto / leads : 0;
    return {
      date: chartDayLabelPt(isoDate),
      isoDate,
      gasto: Math.round(gasto * 100) / 100,
      leads: Math.round(leads * 100) / 100,
      cpa: Math.round(cpa * 100) / 100,
    };
  });
}

type ShareSnapshotCampaignRow = {
  name: string;
  channel: string;
  campaignId?: string;
  spend: number;
  leads: number;
  revenue: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpl: number | null;
};

function aggregateFromGoogle(g: GoogleAdsMetricsResult | null) {
  if (!g?.ok || !g.campaigns?.length) {
    return {
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      revenue: 0,
      campaigns: [] as ShareSnapshotCampaignRow[],
    };
  }
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let leads = 0;
  let revenue = 0;
  const campaigns: ShareSnapshotCampaignRow[] = [];
  for (const r of g.campaigns) {
    const s = r.costMicros / 1_000_000;
    const im = r.impressions;
    const cl = r.clicks;
    const ld = r.conversions;
    spend += s;
    impressions += im;
    clicks += cl;
    leads += ld;
    revenue += r.conversionsValue ?? 0;
    campaigns.push({
      name: r.campaignName,
      channel: "Google",
      campaignId: r.campaignId,
      spend: s,
      leads: ld,
      revenue: r.conversionsValue ?? 0,
      impressions: im,
      clicks: cl,
      ctr: im > 0 ? (cl / im) * 100 : null,
      cpc: cl > 0 ? s / cl : null,
      cpl: ld > 0 ? s / ld : null,
    });
  }
  return { spend, impressions, clicks, leads, revenue, campaigns };
}

function aggregateFromMeta(m: MetaAdsMetricsResult | null) {
  if (!m?.ok || !m.campaigns?.length) {
    return {
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      revenue: 0,
      purchases: 0,
      campaigns: [] as ShareSnapshotCampaignRow[],
    };
  }
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let leads = 0;
  let revenue = 0;
  let purchases = 0;
  const campaigns: ShareSnapshotCampaignRow[] = [];
  for (const r of m.campaigns) {
    const im = r.impressions;
    const cl = r.clicks;
    const ld = r.leads;
    spend += r.spend;
    impressions += im;
    clicks += cl;
    leads += ld;
    revenue += r.purchaseValue ?? 0;
    purchases += r.purchases ?? 0;
    campaigns.push({
      name: r.campaignName,
      channel: "Meta",
      campaignId: r.campaignId,
      spend: r.spend,
      leads: ld,
      revenue: r.purchaseValue ?? 0,
      impressions: im,
      clicks: cl,
      ctr: im > 0 ? (cl / im) * 100 : null,
      cpc: cl > 0 ? r.spend / cl : null,
      cpl: ld > 0 ? r.spend / ld : null,
    });
  }
  return { spend, impressions, clicks, leads, revenue, purchases, campaigns };
}

export async function buildShareSnapshot(organizationId: string, range: MetricsRange) {
  const apiRange = { start: range.startDate, end: range.endDate };
  const [g, m] = await Promise.all([
    fetchGoogleAdsMetrics(organizationId, apiRange, {}).catch(() => null),
    fetchMetaAdsMetrics(organizationId, apiRange, {}).catch(() => null),
  ]);

  const gg = aggregateFromGoogle(g as GoogleAdsMetricsResult | null);
  const mm = aggregateFromMeta(m as MetaAdsMetricsResult | null);

  const gOk = g && (g as GoogleAdsMetricsResult).ok === true;
  const mOk = m && (m as MetaAdsMetricsResult).ok === true;

  const spend =
    (gOk ? (g as Extract<GoogleAdsMetricsResult, { ok: true }>).summary.costMicros / 1_000_000 : 0) +
    (mOk ? (m as Extract<MetaAdsMetricsResult, { ok: true }>).summary.spend : 0);
  const impressions =
    (gOk ? (g as Extract<GoogleAdsMetricsResult, { ok: true }>).summary.impressions : 0) +
    (mOk ? (m as Extract<MetaAdsMetricsResult, { ok: true }>).summary.impressions : 0);
  const clicks =
    (gOk ? (g as Extract<GoogleAdsMetricsResult, { ok: true }>).summary.clicks : 0) +
    (mOk ? (m as Extract<MetaAdsMetricsResult, { ok: true }>).summary.clicks : 0);

  const leadsReais =
    (gOk ? (g as Extract<GoogleAdsMetricsResult, { ok: true }>).summary.conversions : 0) +
    (mOk
      ? (m as Extract<MetaAdsMetricsResult, { ok: true }>).summary.leads +
        ((m as Extract<MetaAdsMetricsResult, { ok: true }>).summary.messagingConversationsStarted ?? 0)
      : 0);

  const revenue =
    (gOk ? (g as Extract<GoogleAdsMetricsResult, { ok: true }>).summary.conversionsValue : 0) +
    (mOk ? ((m as Extract<MetaAdsMetricsResult, { ok: true }>).summary.purchaseValue ?? 0) : 0);

  const merged = [...gg.campaigns, ...mm.campaigns].sort((a, b) => b.spend - a.spend);
  const topCampaigns = merged.slice(0, 15);

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
  const cpc = clicks > 0 ? spend / clicks : null;
  const cpl = leadsReais > 0 ? spend / leadsReais : null;
  const roas = spend > 0 && revenue > 0 ? revenue / spend : null;

  const gOkData = gOk ? (g as Extract<GoogleAdsMetricsResult, { ok: true }>) : null;
  const mOkData = mOk ? (m as Extract<MetaAdsMetricsResult, { ok: true }>) : null;

  const chartSeries = buildShareChartSeries(range.startDate, range.endDate, gOkData?.daily, mOkData?.daily);

  const metaLandingPageViews = mOkData?.summary.landingPageViews ?? 0;

  const metaChannelTotals = mOkData
    ? (() => {
        const s = mOkData.summary;
        const ld = s.leads + (s.messagingConversationsStarted ?? 0);
        return {
          spend: s.spend,
          impressions: s.impressions,
          clicks: s.clicks,
          leads: ld,
          revenue: s.purchaseValue ?? 0,
          cpl: ld > 0 ? s.spend / ld : null,
          roas: s.spend > 0 && (s.purchaseValue ?? 0) > 0 ? (s.purchaseValue ?? 0) / s.spend : null,
        };
      })()
    : null;

  const googleChannelTotals = gOkData
    ? (() => {
        const s = gOkData.summary;
        const sp = s.costMicros / 1_000_000;
        return {
          spend: sp,
          impressions: s.impressions,
          clicks: s.clicks,
          leads: s.conversions,
          revenue: s.conversionsValue,
          cpl: s.conversions > 0 ? sp / s.conversions : null,
          roas: sp > 0 && s.conversionsValue > 0 ? s.conversionsValue / sp : null,
        };
      })()
    : null;

  return {
    hasGoogle: gOk,
    hasMeta: mOk,
    googleError: g && !gOk ? (g as { message: string }).message : null,
    metaError: m && !mOk ? (m as { message: string }).message : null,
    totals: {
      spend,
      impressions,
      clicks,
      leads: leadsReais,
      revenue,
      ctr,
      cpc,
      cpl,
      roas,
    },
    metaChannelTotals,
    googleChannelTotals,
    topCampaigns,
    chartSeries,
    metaLandingPageViews,
  };
}

export { normalizeSections, DEFAULT_SECTIONS };
