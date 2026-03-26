import crypto from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../utils/prisma.js";
import { resolveMetaAdAccountsForQuery } from "./meta-ads-accounts.service.js";

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
  /** Leads (formulários, contatos etc.) — sem conversas iniciadas no WhatsApp */
  leads: number;
  /** Compras / conversões de compra rastreadas pelo pixel */
  purchases: number;
  /** Valor atribuído a compras (moeda da conta), quando disponível */
  purchaseValue?: number;
  conversions?: number;
  /** Alcance (soma entre contas; pode sobrepor audiência entre contas) */
  reach?: number;
  /** Frequência média ponderada por impressões */
  frequency?: number;
  /** Cliques no link (inline_link_clicks) */
  linkClicks?: number;
  /** Visualizações de página de destino (ações Meta) */
  landingPageViews?: number;
  /** Conversas iniciadas (ex.: WhatsApp 7d/28d) */
  messagingConversationsStarted?: number;
  /** Métricas derivadas (percentuais 0–100 onde aplicável) */
  ctrPct?: number;
  linkCtrPct?: number;
  cpc?: number;
  cpm?: number;
  linkCpc?: number;
  cplLeads?: number;
  costPerPurchase?: number;
  roas?: number;
}

/** Alinhado ao contrato do frontend (Google `entityStatus`). */
export type MetaEntityStatusUi = "ACTIVE" | "PAUSED" | "ARCHIVED" | "UNKNOWN";

function mapMetaEffectiveStatusToUi(raw: string | undefined): MetaEntityStatusUi {
  const u = (raw ?? "").toUpperCase();
  if (u === "ACTIVE") return "ACTIVE";
  if (u === "PAUSED") return "PAUSED";
  if (u === "ARCHIVED" || u === "DELETED") return "ARCHIVED";
  return "UNKNOWN";
}

/** effective_status por id de campanha (Graph). */
async function fetchMetaCampaignStatusById(
  accountNumericId: string,
  accessToken: string,
  appSecret: string
): Promise<Map<string, MetaEntityStatusUi>> {
  const path = `/act_${accountNumericId}/campaigns?fields=id,effective_status&limit=500`;
  const rows = await graphGetAllPages<{ id?: string; effective_status?: string }>(
    path,
    accessToken,
    appSecret
  );
  const map = new Map<string, MetaEntityStatusUi>();
  for (const r of rows) {
    if (!r.id) continue;
    map.set(String(r.id), mapMetaEffectiveStatusToUi(r.effective_status));
  }
  return map;
}

export interface MetaAdsCampaignRow {
  campaignName: string;
  campaignId?: string;
  /** Status de entrega no Meta (Graph `effective_status`), quando disponível */
  entityStatus?: MetaEntityStatusUi;
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

function isLandingPageViewAction(t: string): boolean {
  return (
    t === "landing_page_view" ||
    t === "onsite_conversion.landing_page_view" ||
    t.includes("landing_page_view")
  );
}

/** Leads, compras, conversas (WhatsApp etc.) e LPV — conversas não entram em `leads`. */
function aggregateEngagement(actions?: ActionEntry[]): {
  leads: number;
  purchases: number;
  messagingConversationsStarted: number;
  landingPageViews: number;
} {
  let leads = 0;
  let purchases = 0;
  let msgStarted7d = 0;
  let msgStarted28d = 0;
  let landingPageViews = 0;
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
    if (isLandingPageViewAction(t)) {
      landingPageViews += val;
      continue;
    }
    if (isLeadActionType(t)) leads += val;
  }
  const messagingConversationsStarted = msgStarted7d > 0 ? msgStarted7d : msgStarted28d;
  return { leads, purchases, messagingConversationsStarted, landingPageViews };
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
  linkClicks: number;
  landingPageViews: number;
  messagingConversationsStarted: number;
};

async function fetchMetaDailyForAccount(
  accountNumericId: string,
  accessToken: string,
  appSecret: string,
  timeRange: string
): Promise<Map<string, DailyAcc>> {
  const path = `/act_${accountNumericId}/insights?fields=date_start,impressions,clicks,inline_link_clicks,spend,actions,action_values&time_range=${encodeURIComponent(timeRange)}&time_increment=1&level=account&limit=500`;
  const rows = await graphGetAllPages<{
    date_start?: string;
    impressions?: string;
    clicks?: string;
    inline_link_clicks?: string;
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
    const lk = parseInt(row.inline_link_clicks ?? "0", 10) || 0;
    const sp = parseFloat(row.spend ?? "0") || 0;
    const { leads, purchases, messagingConversationsStarted, landingPageViews } = aggregateEngagement(row.actions);
    const cur = map.get(d);
    if (cur) {
      cur.impressions += imp;
      cur.clicks += clk;
      cur.linkClicks += lk;
      cur.spend += sp;
      cur.leads += leads;
      cur.purchases += purchases;
      cur.messagingConversationsStarted += messagingConversationsStarted;
      cur.landingPageViews += landingPageViews;
    } else {
      map.set(d, {
        impressions: imp,
        clicks: clk,
        linkClicks: lk,
        spend: sp,
        leads,
        purchases,
        messagingConversationsStarted,
        landingPageViews,
      });
    }
  }
  return map;
}

export async function fetchMetaAdsMetrics(
  organizationId: string,
  range: { start: string; end: string },
  queryContext?: { clientAccountId?: string | null }
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
    const resolved = await resolveMetaAdAccountsForQuery(organizationId, queryContext?.clientAccountId);
    if ("error" in resolved) {
      if (resolved.error === "not_connected") {
        return { ok: false, message: "Meta Ads não conectado. Conecte em Integrações." };
      }
      return { ok: false, message: resolved.error };
    }
    const accounts = resolved.accounts;
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
    let totalReach = 0;
    let totalFreqWeight = 0;
    let totalLinkClicks = 0;
    let totalLandingPageViews = 0;
    let totalMessagingConversationsStarted = 0;
    const campaignMap = new Map<string, MetaAdsCampaignRow>();

    type InsightRow = {
      impressions?: string;
      clicks?: string;
      spend?: string;
      reach?: string;
      frequency?: string;
      inline_link_clicks?: string;
      campaign_name?: string;
      campaign_id?: string;
      actions?: ActionEntry[];
      action_values?: ActionEntry[];
    };

    function mergeDerivedSummary(): MetaAdsMetricsSummary {
      const imp = totalImpressions;
      const clk = totalClicks;
      const lk = totalLinkClicks;
      const sp = totalSpend;
      const s: MetaAdsMetricsSummary = {
        impressions: imp,
        clicks: clk,
        spend: sp,
        leads: totalLeads,
        purchases: totalPurchases,
      };
      if (totalPurchaseValue > 0) s.purchaseValue = totalPurchaseValue;
      if (totalReach > 0) s.reach = totalReach;
      if (imp > 0 && totalFreqWeight > 0) s.frequency = totalFreqWeight / imp;
      if (lk > 0) s.linkClicks = lk;
      if (totalLandingPageViews > 0) s.landingPageViews = totalLandingPageViews;
      if (totalMessagingConversationsStarted > 0) {
        s.messagingConversationsStarted = totalMessagingConversationsStarted;
      }
      if (imp > 0) s.ctrPct = (clk / imp) * 100;
      if (imp > 0 && lk > 0) s.linkCtrPct = (lk / imp) * 100;
      if (clk > 0 && sp > 0) s.cpc = sp / clk;
      if (imp > 0 && sp > 0) s.cpm = (sp / imp) * 1000;
      if (lk > 0 && sp > 0) s.linkCpc = sp / lk;
      if (totalLeads > 0 && sp > 0) s.cplLeads = sp / totalLeads;
      if (totalPurchases > 0 && sp > 0) s.costPerPurchase = sp / totalPurchases;
      if (totalPurchaseValue > 0 && sp > 0) s.roas = totalPurchaseValue / sp;
      return s;
    }

    for (const account of accounts) {
      const accountId = account.id.replace("act_", "");
      const insightsPath = `/act_${accountId}/insights?fields=impressions,clicks,inline_link_clicks,spend,reach,frequency,actions,action_values&time_range=${encodeURIComponent(timeRange)}&level=account`;
      const accountInsights = await graphGet<{ data: InsightRow[] }>(
        insightsPath,
        config.access_token,
        appSecret
      );
      const row = accountInsights.data?.[0];
      if (row) {
        const imp = parseInt(row.impressions ?? "0", 10) || 0;
        const clk = parseInt(row.clicks ?? "0", 10) || 0;
        const lk = parseInt(row.inline_link_clicks ?? "0", 10) || 0;
        const sp = parseFloat(row.spend ?? "0") || 0;
        const rch = parseInt(row.reach ?? "0", 10) || 0;
        const freq = parseFloat(row.frequency ?? "0") || 0;
        const { leads, purchases, messagingConversationsStarted, landingPageViews } = aggregateEngagement(
          row.actions
        );
        const pVal = aggregatePurchaseValue(row.action_values);
        totalImpressions += imp;
        totalClicks += clk;
        totalSpend += sp;
        totalLeads += leads;
        totalPurchases += purchases;
        totalPurchaseValue += pVal;
        totalReach += rch;
        if (imp > 0 && freq > 0) totalFreqWeight += freq * imp;
        totalLinkClicks += lk;
        totalLandingPageViews += landingPageViews;
        totalMessagingConversationsStarted += messagingConversationsStarted;
      }

      const campaignPath = `/act_${accountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,inline_link_clicks,spend,reach,frequency,actions,action_values&time_range=${encodeURIComponent(timeRange)}&level=campaign&limit=500`;
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
        const lk = parseInt(c.inline_link_clicks ?? "0", 10) || 0;
        const sp = parseFloat(c.spend ?? "0") || 0;
        const rch = parseInt(c.reach ?? "0", 10) || 0;
        const freq = parseFloat(c.frequency ?? "0") || 0;
        const { leads, purchases, messagingConversationsStarted, landingPageViews } = aggregateEngagement(c.actions);
        const pVal = aggregatePurchaseValue(c.action_values);
        if (existing) {
          const prevImp = existing.impressions;
          const prevFreqW = (existing.frequency ?? 0) * prevImp;
          existing.impressions += imp;
          existing.clicks += clk;
          existing.spend += sp;
          existing.leads += leads;
          existing.purchases += purchases;
          existing.purchaseValue = (existing.purchaseValue ?? 0) + pVal;
          existing.reach = (existing.reach ?? 0) + rch;
          if (existing.impressions > 0 && (prevFreqW > 0 || (imp > 0 && freq > 0))) {
            existing.frequency = (prevFreqW + freq * imp) / existing.impressions;
          }
          existing.linkClicks = (existing.linkClicks ?? 0) + lk;
          existing.landingPageViews = (existing.landingPageViews ?? 0) + landingPageViews;
          existing.messagingConversationsStarted =
            (existing.messagingConversationsStarted ?? 0) + messagingConversationsStarted;
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
            reach: rch > 0 ? rch : undefined,
            frequency: imp > 0 && freq > 0 ? freq : undefined,
            linkClicks: lk > 0 ? lk : undefined,
            landingPageViews: landingPageViews > 0 ? landingPageViews : undefined,
            messagingConversationsStarted:
              messagingConversationsStarted > 0 ? messagingConversationsStarted : undefined,
          });
        }
      }

      try {
        const statusById = await fetchMetaCampaignStatusById(
          accountId,
          config.access_token,
          appSecret
        );
        for (const c of campaigns) {
          const cid = (c as InsightRow & { campaign_id?: string }).campaign_id;
          if (!cid) continue;
          const st = statusById.get(String(cid));
          if (st === undefined) continue;
          const row = campaignMap.get(cid);
          if (row) row.entityStatus = st;
        }
      } catch (e) {
        console.warn(
          `[Meta Ads] campaign effective_status act_${accountId}:`,
          e instanceof Error ? e.message : e
        );
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
            cur.linkClicks += v.linkClicks;
            cur.spend += v.spend;
            cur.leads += v.leads;
            cur.purchases += v.purchases;
            cur.messagingConversationsStarted += v.messagingConversationsStarted;
            cur.landingPageViews += v.landingPageViews;
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
        ...(v.linkClicks > 0 ? { linkClicks: v.linkClicks } : {}),
        ...(v.landingPageViews > 0 ? { landingPageViews: v.landingPageViews } : {}),
        ...(v.messagingConversationsStarted > 0
          ? { messagingConversationsStarted: v.messagingConversationsStarted }
          : {}),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      ok: true,
      summary: mergeDerivedSummary(),
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
      action_values?: ActionEntry[];
    };
    for (const account of accounts) {
      const accountId = account.id.replace("act_", "");
      const path = `/act_${accountId}/insights?fields=adset_id,adset_name,campaign_name,impressions,clicks,spend,actions,action_values&time_range=${encodeURIComponent(timeRange)}&level=adset&limit=500`;
      const rows = await graphGetAllPages<R>(path, config.access_token, appSecret);
      for (const c of rows) {
        const key = c.adset_id ?? c.adset_name ?? Math.random().toString();
        const imp = parseInt(c.impressions ?? "0", 10) || 0;
        const clk = parseInt(c.clicks ?? "0", 10) || 0;
        const sp = parseFloat(c.spend ?? "0") || 0;
        const { leads, purchases } = aggregateEngagement(c.actions);
        const pVal = aggregatePurchaseValue(c.action_values);
        const existing = map.get(key);
        if (existing) {
          existing.impressions += imp;
          existing.clicks += clk;
          existing.spend += sp;
          existing.leads += leads;
          existing.purchases += purchases;
          existing.purchaseValue = (existing.purchaseValue ?? 0) + pVal;
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
            purchaseValue: pVal > 0 ? pVal : undefined,
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
      action_values?: ActionEntry[];
    };
    for (const account of accounts) {
      const accountId = account.id.replace("act_", "");
      const path = `/act_${accountId}/insights?fields=ad_id,ad_name,adset_name,campaign_name,impressions,clicks,spend,actions,action_values&time_range=${encodeURIComponent(timeRange)}&level=ad&limit=500`;
      const rows = await graphGetAllPages<R>(path, config.access_token, appSecret);
      for (const c of rows) {
        const key = c.ad_id ?? c.ad_name ?? Math.random().toString();
        const imp = parseInt(c.impressions ?? "0", 10) || 0;
        const clk = parseInt(c.clicks ?? "0", 10) || 0;
        const sp = parseFloat(c.spend ?? "0") || 0;
        const { leads, purchases } = aggregateEngagement(c.actions);
        const pVal = aggregatePurchaseValue(c.action_values);
        const existing = map.get(key);
        if (existing) {
          existing.impressions += imp;
          existing.clicks += clk;
          existing.spend += sp;
          existing.leads += leads;
          existing.purchases += purchases;
          existing.purchaseValue = (existing.purchaseValue ?? 0) + pVal;
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
            purchaseValue: pVal > 0 ? pVal : undefined,
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

/**
 * Define orçamento diário da campanha (Marketing API).
 * `dailyBudgetMajorUnits`: valor na moeda principal (ex.: 120.5 BRL); enviado à Meta em unidade mínima (centavos × 100).
 */
export async function updateMetaCampaignDailyBudget(
  organizationId: string,
  metaCampaignId: string,
  dailyBudgetMajorUnits: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const config = await getMetaAdsConfig(organizationId);
  if (!config?.access_token) {
    return { ok: false, message: "Meta Ads não conectado." };
  }
  const appSecret = env.META_APP_SECRET;
  if (!appSecret) {
    return { ok: false, message: "META_APP_SECRET não configurado." };
  }
  const minor = Math.max(1, Math.round(dailyBudgetMajorUnits * 100));
  try {
    await graphPost(`/${metaCampaignId}`, config.access_token, appSecret, {
      daily_budget: String(minor),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
