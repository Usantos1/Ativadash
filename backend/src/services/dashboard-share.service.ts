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
};

const DEFAULT_SECTIONS: DashboardShareSections = {
  kpis: true,
  channels: true,
  chart: true,
  table: false,
  insights: true,
};

function normalizeSections(raw: unknown): DashboardShareSections {
  const out = { ...DEFAULT_SECTIONS };
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  for (const key of ["kpis", "channels", "chart", "table", "insights"] as const) {
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

function aggregateFromGoogle(g: GoogleAdsMetricsResult | null) {
  if (!g?.ok || !g.campaigns?.length) {
    return {
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      revenue: 0,
      campaigns: [] as { name: string; channel: string; spend: number; leads: number; revenue: number }[],
    };
  }
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let leads = 0;
  let revenue = 0;
  const campaigns: { name: string; channel: string; spend: number; leads: number; revenue: number }[] = [];
  for (const r of g.campaigns) {
    const s = r.costMicros / 1_000_000;
    spend += s;
    impressions += r.impressions;
    clicks += r.clicks;
    leads += r.conversions;
    revenue += r.conversionsValue ?? 0;
    campaigns.push({
      name: r.campaignName,
      channel: "Google",
      spend: s,
      leads: r.conversions,
      revenue: r.conversionsValue ?? 0,
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
      campaigns: [] as { name: string; channel: string; spend: number; leads: number; revenue: number }[],
    };
  }
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let leads = 0;
  let revenue = 0;
  let purchases = 0;
  const campaigns: { name: string; channel: string; spend: number; leads: number; revenue: number }[] = [];
  for (const r of m.campaigns) {
    spend += r.spend;
    impressions += r.impressions;
    clicks += r.clicks;
    leads += r.leads;
    revenue += r.purchaseValue ?? 0;
    purchases += r.purchases ?? 0;
    campaigns.push({
      name: r.campaignName,
      channel: "Meta",
      spend: r.spend,
      leads: r.leads,
      revenue: r.purchaseValue ?? 0,
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
    topCampaigns,
  };
}

export { normalizeSections, DEFAULT_SECTIONS };
