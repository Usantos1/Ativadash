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
  /** Leads (Meta: formulário, lead ads, etc.) */
  leads: number;
  /** Compras / conversões de compra rastreadas pelo pixel */
  purchases: number;
  /** Valor atribuído a compras (moeda da conta), quando disponível */
  purchaseValue?: number;
  conversions?: number;
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
}

export interface MetaAdsDailyRow {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  purchases: number;
}

export type MetaAdsMetricsResult =
  | { ok: true; summary: MetaAdsMetricsSummary; campaigns: MetaAdsCampaignRow[]; daily?: MetaAdsDailyRow[] }
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

interface PagedResponse<T> {
  data: T[];
  paging?: { next?: string; cursors?: { after?: string } };
}

/** Busca todos os itens paginados da Graph API (segue paging.next). */
async function graphGetAllPages<T>(
  path: string,
  accessToken: string,
  appSecret: string
): Promise<T[]> {
  const all: T[] = [];
  let nextUrl: string | null = null;
  let first = true;

  while (first || nextUrl) {
    let res: PagedResponse<T>;
    if (first) {
      res = await graphGet<PagedResponse<T>>(path, accessToken, appSecret);
    } else {
      const proof = appSecretProof(accessToken, appSecret);
      const url = `${nextUrl!}${nextUrl!.includes("?") ? "&" : "?"}appsecret_proof=${encodeURIComponent(proof)}`;
      const r = await fetch(url);
      const text = await r.text();
      if (!r.ok) throw new Error(`Graph API ${r.status}: ${text.slice(0, 200)}`);
      res = JSON.parse(text) as PagedResponse<T>;
    }
    first = false;
    const list = res.data ?? [];
    all.push(...list);
    nextUrl = res.paging?.next ?? null;
  }
  return all;
}

type ActionEntry = { action_type?: string; value?: string };

const MSG_CONV_STARTED_7D = "onsite_conversion.messaging_conversation_started_7d";
const MSG_CONV_STARTED_28D = "onsite_conversion.messaging_conversation_started_28d";

/** Tipos de ação Meta que contamos como lead / captação (próximo ao Gerenciador: leads, conversas, contatos) */
const LEAD_ACTION_TYPES = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead",
  "onsite_conversion.messaging_first_reply",
  "onsite_conversion.messaging_conversation_replied_7d",
  "onsite_conversion.messaging_conversation_replied_28d",
  "onsite_conversion.messaging_user_subscribed",
  "onsite_conversion.messaging_welcome_message_view",
  "onsite_conversion.messaging_conversation_replied_1d",
  "onsite_conversion.contact_website",
  "onsite_conversion.contact_total",
]);

function isLeadActionType(t: string): boolean {
  if (t === MSG_CONV_STARTED_7D || t === MSG_CONV_STARTED_28D) return false;
  if (LEAD_ACTION_TYPES.has(t)) return true;
  if (t.includes("messaging_first_reply")) return true;
  if (t.includes("messaging_conversation_replied")) return true;
  return false;
}

/** Tipos de ação Meta que contamos como venda/compra */
const PURCHASE_ACTION_TYPES = new Set([
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
  "purchase",
  "onsite_conversion.purchase",
  "offsite_conversion.purchase",
]);

function parseIntSafe(v: string | undefined): number {
  const n = parseInt(v ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

function parseFloatSafe(v: string | undefined): number {
  const n = parseFloat(v ?? "0");
  return Number.isFinite(n) ? n : 0;
}

function aggregateActions(actions?: ActionEntry[]): { leads: number; purchases: number } {
  let leads = 0;
  let purchases = 0;
  let msgStarted7d = 0;
  let msgStarted28d = 0;
  for (const a of actions ?? []) {
    const t = a.action_type ?? "";
    const val = parseIntSafe(a.value);
    if (t === MSG_CONV_STARTED_7D) {
      msgStarted7d += val;
      continue;
    }
    if (t === MSG_CONV_STARTED_28D) {
      msgStarted28d += val;
      continue;
    }
    if (PURCHASE_ACTION_TYPES.has(t)) {
      purchases += val;
      continue;
    }
    if (isLeadActionType(t)) leads += val;
  }
  leads += msgStarted7d > 0 ? msgStarted7d : msgStarted28d;
  return { leads, purchases };
}

function aggregatePurchaseValue(actionValues?: ActionEntry[]): number {
  let total = 0;
  for (const a of actionValues ?? []) {
    const t = a.action_type ?? "";
    if (PURCHASE_ACTION_TYPES.has(t)) total += parseFloatSafe(a.value);
  }
  return total;
}

type DailyAcc = {
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  purchases: number;
};

async function fetchMetaDailyForAccount(
  accountNumericId: string,
  accessToken: string,
  appSecret: string,
  timeRange: string
): Promise<Map<string, DailyAcc>> {
  const path = `/act_${accountNumericId}/insights?fields=date_start,impressions,clicks,spend,actions,action_values&time_range=${encodeURIComponent(timeRange)}&time_increment=1&level=account&limit=500`;
  const rows = await graphGetAllPages<{
    date_start?: string;
    impressions?: string;
    clicks?: string;
    spend?: string;
    actions?: ActionEntry[];
    action_values?: ActionEntry[];
  }>(path, accessToken, appSecret);

  const map = new Map<string, DailyAcc>();
  for (const row of rows) {
    const d = row.date_start ?? "";
    if (!d) continue;
    const imp = parseInt(row.impressions ?? "0", 10) || 0;
    const clk = parseInt(row.clicks ?? "0", 10) || 0;
    const sp = parseFloat(row.spend ?? "0") || 0;
    const { leads, purchases } = aggregateActions(row.actions);
    const cur = map.get(d);
    if (cur) {
      cur.impressions += imp;
      cur.clicks += clk;
      cur.spend += sp;
      cur.leads += leads;
      cur.purchases += purchases;
    } else {
      map.set(d, { impressions: imp, clicks: clk, spend: sp, leads, purchases });
    }
  }
  return map;
}

export async function fetchMetaAdsMetrics(
  organizationId: string,
  range: { start: string; end: string }
): Promise<MetaAdsMetricsResult> {
  const config = await getMetaAdsConfig(organizationId);
  if (!config?.access_token) {
    return { ok: false, message: "Meta Ads não conectado. Conecte em Integrações." };
  }

  const timeRange = JSON.stringify({ since: range.start, until: range.end });
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
      return {
        ok: true,
        summary: { impressions: 0, clicks: 0, spend: 0, leads: 0, purchases: 0 },
        campaigns: [],
        daily: [],
      };
    }

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalSpend = 0;
    let totalLeads = 0;
    let totalPurchases = 0;
    let totalPurchaseValue = 0;
    const campaignMap = new Map<string, MetaAdsCampaignRow>();

    type InsightRow = {
      impressions?: string;
      clicks?: string;
      spend?: string;
      campaign_name?: string;
      campaign_id?: string;
      actions?: ActionEntry[];
      action_values?: ActionEntry[];
    };

    for (const account of accounts) {
      const accountId = account.id.replace("act_", "");
      const insightsPath = `/act_${accountId}/insights?fields=impressions,clicks,spend,actions,action_values&time_range=${encodeURIComponent(timeRange)}&level=account`;
      const accountInsights = await graphGet<{ data: InsightRow[] }>(
        insightsPath,
        config.access_token,
        appSecret
      );
      const row = accountInsights.data?.[0];
      if (row) {
        const imp = parseInt(row.impressions ?? "0", 10) || 0;
        const clk = parseInt(row.clicks ?? "0", 10) || 0;
        const sp = parseFloat(row.spend ?? "0") || 0;
        const { leads, purchases } = aggregateActions(row.actions);
        const pVal = aggregatePurchaseValue(row.action_values);
        totalImpressions += imp;
        totalClicks += clk;
        totalSpend += sp;
        totalLeads += leads;
        totalPurchases += purchases;
        totalPurchaseValue += pVal;
      }

      const campaignPath = `/act_${accountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range=${encodeURIComponent(timeRange)}&level=campaign&limit=500`;
      const campaigns = await graphGetAllPages<InsightRow & { campaign_id?: string }>(
        campaignPath,
        config.access_token,
        appSecret
      );
      for (const c of campaigns) {
        const name = c.campaign_name ?? "—";
        const key = (c as { campaign_id?: string }).campaign_id ?? name;
        const existing = campaignMap.get(key);
        const imp = parseInt(c.impressions ?? "0", 10) || 0;
        const clk = parseInt(c.clicks ?? "0", 10) || 0;
        const sp = parseFloat(c.spend ?? "0") || 0;
        const { leads, purchases } = aggregateActions(c.actions);
        const pVal = aggregatePurchaseValue(c.action_values);
        if (existing) {
          existing.impressions += imp;
          existing.clicks += clk;
          existing.spend += sp;
          existing.leads += leads;
          existing.purchases += purchases;
          existing.purchaseValue = (existing.purchaseValue ?? 0) + pVal;
        } else {
          const cid = (c as InsightRow).campaign_id;
          campaignMap.set(key, {
            campaignName: name,
            campaignId: cid,
            impressions: imp,
            clicks: clk,
            spend: sp,
            leads,
            purchases,
            purchaseValue: pVal > 0 ? pVal : undefined,
          });
        }
      }
    }

    const mergedDaily = new Map<string, DailyAcc>();
    for (const account of accounts) {
      const accountId = account.id.replace("act_", "");
      try {
        const part = await fetchMetaDailyForAccount(accountId, config.access_token, appSecret, timeRange);
        for (const [d, v] of part) {
          const cur = mergedDaily.get(d);
          if (cur) {
            cur.impressions += v.impressions;
            cur.clicks += v.clicks;
            cur.spend += v.spend;
            cur.leads += v.leads;
            cur.purchases += v.purchases;
          } else {
            mergedDaily.set(d, { ...v });
          }
        }
      } catch (e) {
        console.error("[Meta Ads] daily series:", e instanceof Error ? e.message : e);
      }
    }

    const daily: MetaAdsDailyRow[] = Array.from(mergedDaily.entries())
      .map(([date, v]) => ({
        date,
        impressions: v.impressions,
        clicks: v.clicks,
        spend: v.spend,
        leads: v.leads,
        purchases: v.purchases,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      ok: true,
      summary: {
        impressions: totalImpressions,
        clicks: totalClicks,
        spend: totalSpend,
        leads: totalLeads,
        purchases: totalPurchases,
        purchaseValue: totalPurchaseValue > 0 ? totalPurchaseValue : undefined,
      },
      campaigns: Array.from(campaignMap.values()),
      daily,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao buscar métricas do Meta Ads.";
    console.error("Meta Ads metrics:", msg);
    return { ok: false, message: msg };
  }
}

async function graphPost(
  path: string,
  accessToken: string,
  appSecret: string,
  body: Record<string, string>
): Promise<unknown> {
  const proof = appSecretProof(accessToken, appSecret);
  const params = new URLSearchParams({
    ...body,
    access_token: accessToken,
    appsecret_proof: proof,
  });
  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
  const res = await fetch(url, { method: "POST", body: params });
  const text = await res.text();
  if (!res.ok) {
    try {
      const json = JSON.parse(text) as { error?: { message?: string } };
      throw new Error(json?.error?.message ?? text.slice(0, 200));
    } catch (e) {
      if (e instanceof Error && e.message !== text) throw e;
      throw new Error(`Graph API ${res.status}: ${text.slice(0, 200)}`);
    }
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
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
};

export type MetaDemographicRow = {
  age?: string;
  gender?: string;
  impressions: number;
  clicks: number;
  spend: number;
};

export type MetaDeepResult<T> = { ok: true; rows: T[] } | { ok: false; message: string };

export async function fetchMetaAdsetMetrics(
  organizationId: string,
  range: { start: string; end: string }
): Promise<MetaDeepResult<MetaAdsetRow>> {
  const config = await getMetaAdsConfig(organizationId);
  if (!config?.access_token) {
    return { ok: false, message: "Meta Ads não conectado." };
  }
  const appSecret = env.META_APP_SECRET;
  if (!appSecret) {
    return { ok: false, message: "META_APP_SECRET não configurado no servidor." };
  }
  const timeRange = JSON.stringify({ since: range.start, until: range.end });
  try {
    const adAccountsRes = await graphGet<{ data: { id: string }[] }>(
      `/me/adaccounts?fields=id`,
      config.access_token,
      appSecret
    );
    const accounts = adAccountsRes.data ?? [];
    const map = new Map<string, MetaAdsetRow>();
    type R = {
      adset_id?: string;
      adset_name?: string;
      campaign_name?: string;
      impressions?: string;
      clicks?: string;
      spend?: string;
      actions?: ActionEntry[];
    };
    for (const account of accounts) {
      const accountId = account.id.replace("act_", "");
      const path = `/act_${accountId}/insights?fields=adset_id,adset_name,campaign_name,impressions,clicks,spend,actions&time_range=${encodeURIComponent(timeRange)}&level=adset&limit=500`;
      const rows = await graphGetAllPages<R>(path, config.access_token, appSecret);
      for (const c of rows) {
        const key = c.adset_id ?? c.adset_name ?? Math.random().toString();
        const imp = parseInt(c.impressions ?? "0", 10) || 0;
        const clk = parseInt(c.clicks ?? "0", 10) || 0;
        const sp = parseFloat(c.spend ?? "0") || 0;
        const { leads, purchases } = aggregateActions(c.actions);
        const existing = map.get(key);
        if (existing) {
          existing.impressions += imp;
          existing.clicks += clk;
          existing.spend += sp;
          existing.leads += leads;
          existing.purchases += purchases;
        } else {
          map.set(key, {
            adsetName: c.adset_name ?? "—",
            adsetId: c.adset_id,
            campaignName: c.campaign_name,
            impressions: imp,
            clicks: clk,
            spend: sp,
            leads,
            purchases,
          });
        }
      }
    }
    return { ok: true, rows: Array.from(map.values()) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

export async function fetchMetaAdLevelMetrics(
  organizationId: string,
  range: { start: string; end: string }
): Promise<MetaDeepResult<MetaAdRow>> {
  const config = await getMetaAdsConfig(organizationId);
  if (!config?.access_token) {
    return { ok: false, message: "Meta Ads não conectado." };
  }
  const appSecret = env.META_APP_SECRET;
  if (!appSecret) {
    return { ok: false, message: "META_APP_SECRET não configurado no servidor." };
  }
  const timeRange = JSON.stringify({ since: range.start, until: range.end });
  try {
    const adAccountsRes = await graphGet<{ data: { id: string }[] }>(
      `/me/adaccounts?fields=id`,
      config.access_token,
      appSecret
    );
    const accounts = adAccountsRes.data ?? [];
    const map = new Map<string, MetaAdRow>();
    type R = {
      ad_id?: string;
      ad_name?: string;
      adset_name?: string;
      campaign_name?: string;
      impressions?: string;
      clicks?: string;
      spend?: string;
      actions?: ActionEntry[];
    };
    for (const account of accounts) {
      const accountId = account.id.replace("act_", "");
      const path = `/act_${accountId}/insights?fields=ad_id,ad_name,adset_name,campaign_name,impressions,clicks,spend,actions&time_range=${encodeURIComponent(timeRange)}&level=ad&limit=500`;
      const rows = await graphGetAllPages<R>(path, config.access_token, appSecret);
      for (const c of rows) {
        const key = c.ad_id ?? c.ad_name ?? Math.random().toString();
        const imp = parseInt(c.impressions ?? "0", 10) || 0;
        const clk = parseInt(c.clicks ?? "0", 10) || 0;
        const sp = parseFloat(c.spend ?? "0") || 0;
        const { leads, purchases } = aggregateActions(c.actions);
        const existing = map.get(key);
        if (existing) {
          existing.impressions += imp;
          existing.clicks += clk;
          existing.spend += sp;
          existing.leads += leads;
          existing.purchases += purchases;
        } else {
          map.set(key, {
            adName: c.ad_name ?? "—",
            adId: c.ad_id,
            adsetName: c.adset_name,
            campaignName: c.campaign_name,
            impressions: imp,
            clicks: clk,
            spend: sp,
            leads,
            purchases,
          });
        }
      }
    }
    return { ok: true, rows: Array.from(map.values()) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

export async function fetchMetaAgeGenderBreakdown(
  organizationId: string,
  range: { start: string; end: string }
): Promise<MetaDeepResult<MetaDemographicRow>> {
  const config = await getMetaAdsConfig(organizationId);
  if (!config?.access_token) {
    return { ok: false, message: "Meta Ads não conectado." };
  }
  const appSecret = env.META_APP_SECRET;
  if (!appSecret) {
    return { ok: false, message: "META_APP_SECRET não configurado no servidor." };
  }
  const timeRange = JSON.stringify({ since: range.start, until: range.end });
  try {
    const adAccountsRes = await graphGet<{ data: { id: string }[] }>(
      `/me/adaccounts?fields=id`,
      config.access_token,
      appSecret
    );
    const accounts = adAccountsRes.data ?? [];
    const out: MetaDemographicRow[] = [];
    type R = {
      age?: string;
      gender?: string;
      impressions?: string;
      clicks?: string;
      spend?: string;
    };
    for (const account of accounts) {
      const accountId = account.id.replace("act_", "");
      const path = `/act_${accountId}/insights?fields=impressions,clicks,spend&breakdowns=age,gender&time_range=${encodeURIComponent(timeRange)}&level=campaign&limit=500`;
      const rows = await graphGetAllPages<R>(path, config.access_token, appSecret);
      for (const c of rows) {
        out.push({
          age: c.age,
          gender: c.gender,
          impressions: parseInt(c.impressions ?? "0", 10) || 0,
          clicks: parseInt(c.clicks ?? "0", 10) || 0,
          spend: parseFloat(c.spend ?? "0") || 0,
        });
      }
    }
    return { ok: true, rows: out };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

export async function updateMetaCampaignStatus(
  organizationId: string,
  metaCampaignId: string,
  status: "PAUSED" | "ACTIVE"
): Promise<{ ok: true } | { ok: false; message: string }> {
  const config = await getMetaAdsConfig(organizationId);
  if (!config?.access_token) {
    return { ok: false, message: "Meta Ads não conectado." };
  }
  const appSecret = env.META_APP_SECRET;
  if (!appSecret) {
    return { ok: false, message: "META_APP_SECRET não configurado." };
  }
  try {
    await graphPost(`/${metaCampaignId}`, config.access_token, appSecret, { status });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
