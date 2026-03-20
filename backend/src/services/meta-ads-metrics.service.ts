import crypto from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../utils/prisma.js";

const META_SLUG = "meta";
const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

interface MetaAdsConfig {
  access_token: string;
  expiry_date?: number;
}

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

export type MetaAdsMetricsResult =
  | { ok: true; summary: MetaAdsMetricsSummary; campaigns: MetaAdsCampaignRow[] }
  | { ok: false; message: string };

async function getMetaAdsConfig(organizationId: string): Promise<MetaAdsConfig | null> {
  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_slug: { organizationId, slug: META_SLUG },
    },
  });
  if (!integration?.config || integration.status !== "connected") return null;
  try {
    return JSON.parse(integration.config) as MetaAdsConfig;
  } catch {
    return null;
  }
}

function appSecretProof(accessToken: string, appSecret: string): string {
  return crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

async function graphGet<T>(path: string, accessToken: string, appSecret: string): Promise<T> {
  const proof = appSecretProof(accessToken, appSecret);
  const url = path.startsWith("http")
    ? path
    : `${GRAPH_BASE}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}&appsecret_proof=${encodeURIComponent(proof)}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    try {
      const json = JSON.parse(text) as { error?: { message?: string } };
      const msg = json?.error?.message ?? text;
      throw new Error(msg);
    } catch (e) {
      if (e instanceof Error && e.message !== text) throw e;
      throw new Error(`Graph API ${res.status}: ${text.slice(0, 200)}`);
    }
  }
  return JSON.parse(text) as T;
}

function dateRange(days: number): { since: string; until: string } {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);
  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  };
}

export async function fetchMetaAdsMetrics(
  organizationId: string,
  periodDays: number
): Promise<MetaAdsMetricsResult> {
  const config = await getMetaAdsConfig(organizationId);
  if (!config?.access_token) {
    return { ok: false, message: "Meta Ads não conectado. Conecte em Integrações." };
  }

  const range = dateRange(periodDays);
  const timeRange = JSON.stringify({ since: range.since, until: range.until });
  const appSecret = env.META_APP_SECRET;
  if (!appSecret) {
    return { ok: false, message: "META_APP_SECRET não configurado no servidor." };
  }

  try {
    const adAccountsRes = await graphGet<{ data: { id: string; name: string; account_id: string }[] }>(
      `/me/adaccounts?fields=id,name,account_id`,
      config.access_token,
      appSecret
    );
    const accounts = adAccountsRes.data ?? [];
    if (accounts.length === 0) {
      return { ok: true, summary: { impressions: 0, clicks: 0, spend: 0 }, campaigns: [] };
    }

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalSpend = 0;
    const campaignMap = new Map<string, MetaAdsCampaignRow>();

    for (const account of accounts) {
      const accountId = account.id.replace("act_", "");
      const insightsPath = `/act_${accountId}/insights?fields=impressions,clicks,spend&time_range=${encodeURIComponent(timeRange)}&level=account`;
      const accountInsights = await graphGet<{ data: { impressions?: string; clicks?: string; spend?: string }[] }>(
        insightsPath,
        config.access_token,
        appSecret
      );
      const row = accountInsights.data?.[0];
      if (row) {
        const imp = parseInt(row.impressions ?? "0", 10) || 0;
        const clk = parseInt(row.clicks ?? "0", 10) || 0;
        const sp = parseFloat(row.spend ?? "0") || 0;
        totalImpressions += imp;
        totalClicks += clk;
        totalSpend += sp;
      }

      const campaignPath = `/act_${accountId}/insights?fields=campaign_name,impressions,clicks,spend&time_range=${encodeURIComponent(timeRange)}&level=campaign`;
      const campaignInsights = await graphGet<{
        data: { campaign_name?: string; impressions?: string; clicks?: string; spend?: string }[];
      }>(campaignPath, config.access_token, appSecret);
      const campaigns = campaignInsights.data ?? [];
      for (const c of campaigns) {
        const name = c.campaign_name ?? "—";
        const existing = campaignMap.get(name);
        const imp = parseInt(c.impressions ?? "0", 10) || 0;
        const clk = parseInt(c.clicks ?? "0", 10) || 0;
        const sp = parseFloat(c.spend ?? "0") || 0;
        if (existing) {
          existing.impressions += imp;
          existing.clicks += clk;
          existing.spend += sp;
        } else {
          campaignMap.set(name, { campaignName: name, impressions: imp, clicks: clk, spend: sp });
        }
      }
    }

    return {
      ok: true,
      summary: { impressions: totalImpressions, clicks: totalClicks, spend: totalSpend },
      campaigns: Array.from(campaignMap.values()),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao buscar métricas do Meta Ads.";
    console.error("Meta Ads metrics:", msg);
    return { ok: false, message: msg };
  }
}
