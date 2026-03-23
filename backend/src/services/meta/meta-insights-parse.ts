/**
 * Normalização de actions, action_values e cost_per_action_type retornados pela Graph API (insights).
 * Logs de debug: DEBUG_META_INSIGHTS=true (ver env.ts).
 */

import { env } from "../../config/env.js";

export type ActionEntry = { action_type?: string; value?: string };
export type CostPerActionEntry = { action_type?: string; value?: string };

const DEBUG = env.DEBUG_META_INSIGHTS;

const MSG_7D = "onsite_conversion.messaging_conversation_started_7d";
const MSG_28D = "onsite_conversion.messaging_conversation_started_28d";

/** Aliases for messaging started */
const MESSAGING_STARTED_TYPES = new Set([
  MSG_7D,
  MSG_28D,
  "messaging_conversation_started_7d",
  "messaging_conversation_started_28d",
]);

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

const PURCHASE_ACTION_TYPES = new Set([
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
  "purchase",
  "onsite_conversion.purchase",
  "offsite_conversion.purchase",
]);

const LANDING_PAGE_TYPES = new Set([
  "landing_page_view",
  "onsite_conversion.landing_page_view",
]);

const INITIATE_CHECKOUT_TYPES = new Set([
  "initiate_checkout",
  "offsite_conversion.fb_pixel_initiate_checkout",
  "onsite_conversion.initiate_checkout",
]);

const ADD_TO_CART_TYPES = new Set([
  "add_to_cart",
  "offsite_conversion.fb_pixel_add_to_cart",
  "onsite_conversion.add_to_cart",
]);

const COMPLETE_REGISTRATION_TYPES = new Set([
  "complete_registration",
  "offsite_conversion.fb_pixel_complete_registration",
  "onsite_conversion.complete_registration",
]);

const LINK_CLICK_ACTION_TYPES = new Set(["link_click", "onsite_conversion.link_click"]);

function parseIntSafe(v: string | undefined): number {
  const n = parseInt(v ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

function parseFloatSafe(v: string | undefined): number {
  const n = parseFloat(v ?? "0");
  return Number.isFinite(n) ? n : 0;
}

export interface MetaInsightEngagement {
  leads: number;
  purchases: number;
  /** Soma dos valores monetários em action_values para tipos de compra */
  purchaseValue: number;
  messagingConversationsStarted: number;
  landingPageViews: number;
  initiateCheckout: number;
  addToCart: number;
  completeRegistration: number;
  /** Contagem em actions para tipos link_click (complementa inline_link_clicks) */
  linkClickActionCount: number;
}

export function emptyEngagement(): MetaInsightEngagement {
  return {
    leads: 0,
    purchases: 0,
    purchaseValue: 0,
    messagingConversationsStarted: 0,
    landingPageViews: 0,
    initiateCheckout: 0,
    addToCart: 0,
    completeRegistration: 0,
    linkClickActionCount: 0,
  };
}

export function mergeEngagement(a: MetaInsightEngagement, b: MetaInsightEngagement): MetaInsightEngagement {
  return {
    leads: a.leads + b.leads,
    purchases: a.purchases + b.purchases,
    purchaseValue: a.purchaseValue + b.purchaseValue,
    messagingConversationsStarted: a.messagingConversationsStarted + b.messagingConversationsStarted,
    landingPageViews: a.landingPageViews + b.landingPageViews,
    initiateCheckout: a.initiateCheckout + b.initiateCheckout,
    addToCart: a.addToCart + b.addToCart,
    completeRegistration: a.completeRegistration + b.completeRegistration,
    linkClickActionCount: a.linkClickActionCount + b.linkClickActionCount,
  };
}

function isLeadActionType(t: string): boolean {
  if (MESSAGING_STARTED_TYPES.has(t)) return false;
  if (t === MSG_7D || t === MSG_28D) return false;
  if (LEAD_ACTION_TYPES.has(t)) return true;
  if (t.includes("messaging_first_reply")) return true;
  if (t.includes("messaging_conversation_replied")) return true;
  return false;
}

function isLandingPageViewAction(t: string): boolean {
  if (LANDING_PAGE_TYPES.has(t)) return true;
  return t.includes("landing_page_view");
}

function classifyActionType(
  t: string
): keyof Omit<MetaInsightEngagement, "purchaseValue"> | "purchase" | "unmapped" {
  if (MESSAGING_STARTED_TYPES.has(t) || t === MSG_7D || t === MSG_28D) {
    return "messagingConversationsStarted";
  }
  if (PURCHASE_ACTION_TYPES.has(t)) return "purchase";
  if (isLandingPageViewAction(t)) return "landingPageViews";
  if (INITIATE_CHECKOUT_TYPES.has(t)) return "initiateCheckout";
  if (ADD_TO_CART_TYPES.has(t)) return "addToCart";
  if (COMPLETE_REGISTRATION_TYPES.has(t)) return "completeRegistration";
  if (LINK_CLICK_ACTION_TYPES.has(t)) return "linkClickActionCount";
  if (isLeadActionType(t)) return "leads";
  return "unmapped";
}

/**
 * Extrai buckets a partir de actions (+ valores de compra em action_values).
 * cost_per_action_type: custos médios por tipo; usamos como fallback de CPL quando faz sentido.
 */
export function parseInsightEngagement(
  actions?: ActionEntry[] | null,
  actionValues?: ActionEntry[] | null,
  costPerActionType?: CostPerActionEntry[] | null,
  debugContext?: string
): MetaInsightEngagement {
  const out = emptyEngagement();
  const unmapped = new Set<string>();
  let msg7 = 0;
  let msg28 = 0;

  for (const a of actions ?? []) {
    const t = (a.action_type ?? "").trim();
    if (!t) continue;
    const val = parseIntSafe(a.value);
    const kind = classifyActionType(t);
    if (kind === "unmapped") {
      unmapped.add(t);
      continue;
    }
    if (kind === "messagingConversationsStarted") {
      if (t.includes("28d")) msg28 += val;
      else msg7 += val;
      continue;
    }
    if (kind === "purchase") {
      out.purchases += val;
      continue;
    }
    if (kind === "linkClickActionCount") {
      out.linkClickActionCount += val;
      continue;
    }
    out[kind] += val;
  }

  out.messagingConversationsStarted = msg7 > 0 ? msg7 : msg28;

  for (const a of actionValues ?? []) {
    const t = (a.action_type ?? "").trim();
    if (PURCHASE_ACTION_TYPES.has(t)) {
      out.purchaseValue += parseFloatSafe(a.value);
    }
  }

  if (DEBUG && debugContext && unmapped.size > 0) {
    console.info(`[Meta parse] ${debugContext} unmapped action_types (${unmapped.size}):`, [...unmapped].slice(0, 40));
  }
  if (DEBUG && debugContext && (actions?.length || costPerActionType?.length)) {
    const sample = (actions ?? []).slice(0, 5).map((x) => `${x.action_type}=${x.value}`);
    if (sample.length) console.info(`[Meta parse] ${debugContext} actions sample:`, sample);
  }

  void costPerActionType;
  return out;
}


/** Soma purchaseValue apenas a partir de action_values (sem actions). */
export function sumPurchaseValueFromActionValues(actionValues?: ActionEntry[] | null): number {
  let total = 0;
  for (const a of actionValues ?? []) {
    const t = (a.action_type ?? "").trim();
    if (PURCHASE_ACTION_TYPES.has(t)) total += parseFloatSafe(a.value);
  }
  return total;
}

export interface DerivedRates {
  ctrPct: number | null;
  cpc: number | null;
  cpm: number | null;
  linkCtrPct: number | null;
  linkCpc: number | null;
  cplLeads: number | null;
  costPerPurchase: number | null;
  roas: number | null;
  /** Preferência: API; senão impressões/alcance */
  frequency: number | null;
  frequencySource: "api" | "computed_impressions_over_reach" | null;
  clickToLeadRate: number | null;
  leadToPurchaseRate: number | null;
}

export function computeDerivedRates(input: {
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  leads: number;
  purchases: number;
  purchaseValue: number;
  reach: number | null;
  /** frequência já vinda da API (opcional) */
  frequencyFromApi: number | null;
}): DerivedRates {
  const { spend, impressions, clicks, linkClicks, leads, purchases, purchaseValue, reach, frequencyFromApi } = input;

  const ctrPct = impressions > 0 ? (clicks / impressions) * 100 : null;
  const cpc = clicks > 0 && spend > 0 ? spend / clicks : null;
  const cpm = impressions > 0 && spend > 0 ? (spend / impressions) * 1000 : null;
  const linkCtrPct = impressions > 0 && linkClicks > 0 ? (linkClicks / impressions) * 100 : null;
  const linkCpc = linkClicks > 0 && spend > 0 ? spend / linkClicks : null;
  const cplLeads = leads > 0 && spend > 0 ? spend / leads : null;
  const costPerPurchase = purchases > 0 && spend > 0 ? spend / purchases : null;
  const roas = spend > 0 && purchaseValue > 0 ? purchaseValue / spend : null;

  const computedFreq =
    reach != null && reach > 0 && impressions > 0 ? impressions / reach : null;
  let frequency: number | null = null;
  let frequencySource: DerivedRates["frequencySource"] = null;
  if (frequencyFromApi != null && frequencyFromApi > 0 && Number.isFinite(frequencyFromApi)) {
    frequency = frequencyFromApi;
    frequencySource = "api";
  } else if (computedFreq != null && computedFreq > 0) {
    frequency = computedFreq;
    frequencySource = "computed_impressions_over_reach";
  }

  const linkBasis = linkClicks > 0 ? linkClicks : clicks > 0 ? clicks : 0;
  const clickToLeadRate = leads > 0 && linkBasis > 0 ? leads / linkBasis : null;
  const leadToPurchaseRate = purchases > 0 && leads > 0 ? purchases / leads : null;

  return {
    ctrPct,
    cpc,
    cpm,
    linkCtrPct,
    linkCpc,
    cplLeads,
    costPerPurchase,
    roas,
    frequency,
    frequencySource,
    clickToLeadRate,
    leadToPurchaseRate,
  };
}
