import type { AlertRule, AutomationActionType } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { appendAutomationExecutionLog } from "./automation-execution-log.service.js";
import {
  entityMatchesAlertRule,
  type AutomationEntityMetricInput,
  type RuleEvaluatingChannel,
} from "./alert-rule-insights.service.js";
import { getEffectivePlanFeatures } from "./effective-plan-features.service.js";
import { formatMoney } from "./marketing-settings-format.js";
import { maybeSendAtivaCrmAlerts } from "./marketing-settings.service.js";
import { recordAlertOccurrenceDeduped } from "./alert-rules.service.js";
import {
  fetchMetaAdsMetrics,
  fetchMetaAdsetMetrics,
  fetchMetaAdLevelMetrics,
  fetchMetaCampaignBudgetMeta,
  fetchMetaAdsetBudgetMeta,
  updateMetaCampaignStatus,
  updateMetaCampaignDailyBudget,
  updateMetaAdsetStatus,
  updateMetaAdStatus,
  updateMetaAdsetDailyBudget,
  type MetaAdsCampaignRow,
  type MetaAdRow,
  type MetaAdsetRow,
} from "./meta-ads-metrics.service.js";
import {
  fetchGoogleAdsMetrics,
  mutateGoogleCampaignStatus,
  mutateGoogleCampaignDailyBudget,
  fetchGoogleCampaignBudgetMicros,
  type GoogleAdsCampaignRow,
} from "./google-ads-metrics.service.js";
import type { InsightAlert } from "../types/marketing-insight.types.js";

const PERIOD_KEY = "7d";
const COOLDOWN_HOURS = 24;

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function ruleAppliesToChannel(rule: AlertRule, ch: "meta" | "google"): boolean {
  const raw = (rule.appliesToChannel ?? "").trim().toLowerCase();
  const scope = raw === "" ? "all" : raw;
  return scope === "all" || scope === ch;
}

async function wasRecentlyExecuted(
  organizationId: string,
  ruleId: string,
  assetId: string,
  actionTaken: AutomationActionType
): Promise<boolean> {
  const since = new Date(Date.now() - COOLDOWN_HOURS * 3600_000);
  const hit = await prisma.automationExecutionLog.findFirst({
    where: {
      organizationId,
      ruleId,
      assetId,
      actionTaken: String(actionTaken),
      executedAt: { gte: since },
    },
    select: { id: true },
  });
  return hit != null;
}

function metaCampaignToEntity(row: MetaAdsCampaignRow): AutomationEntityMetricInput {
  const results = row.leads + row.purchases;
  const purchaseValue = row.purchaseValue ?? 0;
  return {
    spendBrl: row.spend,
    resultsForCpa: Math.max(0, results),
    purchaseValueBrl: purchaseValue,
    impressions: row.impressions,
    clicks: row.clicks,
  };
}

function metaAdsetToEntity(row: MetaAdsetRow): AutomationEntityMetricInput {
  const results = row.leads + row.purchases;
  const purchaseValue = row.purchaseValue ?? 0;
  return {
    spendBrl: row.spend,
    resultsForCpa: Math.max(0, results),
    purchaseValueBrl: purchaseValue,
    impressions: row.impressions,
    clicks: row.clicks,
  };
}

function metaAdToEntity(row: MetaAdRow): AutomationEntityMetricInput {
  const results = row.leads + row.purchases;
  const purchaseValue = row.purchaseValue ?? 0;
  return {
    spendBrl: row.spend,
    resultsForCpa: Math.max(0, results),
    purchaseValueBrl: purchaseValue,
    impressions: row.impressions,
    clicks: row.clicks,
  };
}

function googleCampaignToEntity(row: GoogleAdsCampaignRow): AutomationEntityMetricInput {
  const costBrl = row.costMicros / 1_000_000;
  return {
    spendBrl: costBrl,
    resultsForCpa: Math.max(0, row.conversions),
    purchaseValueBrl: row.conversionsValue,
    impressions: row.impressions,
    clicks: row.clicks,
  };
}

async function notifyAutomationWhatsApp(
  organizationId: string,
  rule: AlertRule,
  message: string,
  channel: "meta" | "google"
): Promise<void> {
  if (!rule.notifyWhatsapp) return;
  const alert: InsightAlert = {
    severity: rule.severity === "critical" ? "critical" : "warning",
    code: `CUSTOM_RULE:${rule.id}`,
    title: rule.name,
    message,
    channel,
  };
  await maybeSendAtivaCrmAlerts(organizationId, {
    alerts: [alert],
    periodLabel: "Automação (motor)",
  });
}

async function persistOccurrence(
  organizationId: string,
  rule: AlertRule,
  message: string
): Promise<void> {
  await recordAlertOccurrenceDeduped(organizationId, rule.id, {
    severity: rule.severity === "critical" ? "critical" : "warning",
    title: rule.name,
    message,
    metricValue: 0,
  }).catch((err) => console.error("[automation] occurrence", err));
}

async function executeMetaForRule(
  organizationId: string,
  rule: AlertRule,
  settingsRow: NonNullable<Awaited<ReturnType<typeof prisma.marketingSettings.findUnique>>>,
  range: { start: string; end: string }
): Promise<number> {
  let actions = 0;
  const level = (rule.evaluationLevel ?? "campaign").trim() || "campaign";

  if (level === "campaign") {
    const pack = await fetchMetaAdsMetrics(organizationId, range, undefined);
    if (!pack.ok) return 0;
    for (const row of pack.campaigns) {
      const id = row.campaignId;
      if (!id) continue;
      const entity = metaCampaignToEntity(row);
      if (!entityMatchesAlertRule(rule, settingsRow, "meta", PERIOD_KEY, entity)) continue;
      if (await wasRecentlyExecuted(organizationId, rule.id, id, rule.actionType)) continue;
      const n = await runMetaMutation(
        organizationId,
        rule,
        "campaign",
        id,
        row.campaignName || id,
        row.entityStatus
      );
      actions += n;
    }
    return actions;
  }

  if (level === "ad_set") {
    const pack = await fetchMetaAdsetMetrics(organizationId, range);
    if (!pack.ok) return 0;
    for (const row of pack.rows) {
      const id = row.adsetId;
      if (!id) continue;
      const entity = metaAdsetToEntity(row);
      if (!entityMatchesAlertRule(rule, settingsRow, "meta", PERIOD_KEY, entity)) continue;
      if (await wasRecentlyExecuted(organizationId, rule.id, id, rule.actionType)) continue;
      const n = await runMetaMutation(
        organizationId,
        rule,
        "ad_set",
        id,
        row.adsetName || id,
        undefined
      );
      actions += n;
    }
    return actions;
  }

  const pack = await fetchMetaAdLevelMetrics(organizationId, range);
  if (!pack.ok) return 0;
  for (const row of pack.rows) {
    const id = row.adId;
    if (!id) continue;
    const entity = metaAdToEntity(row);
    if (!entityMatchesAlertRule(rule, settingsRow, "meta", PERIOD_KEY, entity)) continue;
    if (await wasRecentlyExecuted(organizationId, rule.id, id, rule.actionType)) continue;
    const n = await runMetaMutation(organizationId, rule, "ad", id, row.adName || id, undefined);
    actions += n;
  }
  return actions;
}

async function runMetaMutation(
  organizationId: string,
  rule: AlertRule,
  kind: "campaign" | "ad_set" | "ad",
  externalId: string,
  label: string,
  entityStatus: string | undefined
): Promise<number> {
  const action = rule.actionType;

  if (action === "PAUSE_ASSET") {
    if (entityStatus === "PAUSED") return 0;
    let out: { ok: true } | { ok: false; message: string };
    if (kind === "campaign") out = await updateMetaCampaignStatus(organizationId, externalId, "PAUSED");
    else if (kind === "ad_set") out = await updateMetaAdsetStatus(organizationId, externalId, "PAUSED");
    else out = await updateMetaAdStatus(organizationId, externalId, "PAUSED");
    if (!out.ok) {
      console.warn(`[automation] Meta pause falhou ${externalId}:`, out.message);
      return 0;
    }
    const prev = entityStatus ?? "ACTIVE";
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: externalId,
      assetLabel: label,
      actionTaken: "PAUSE_ASSET",
      previousValue: prev,
      newValue: "PAUSED",
    });
    if (!log) return 0;
    const msg = `Pausa automática (${kind}) em *${label}*.`;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "meta");
    return 1;
  }

  if (action === "INCREASE_BUDGET_20" || action === "DECREASE_BUDGET_20") {
    if (kind === "ad") {
      console.info(`[automation] Orçamento em anúncio ignorado (regra ${rule.id}); use campanha ou conjunto.`);
      return 0;
    }
    const mult = action === "INCREASE_BUDGET_20" ? 1.2 : 0.8;
    if (kind === "campaign") {
      if (entityStatus === "PAUSED") return 0;
      const cur = await fetchMetaCampaignBudgetMeta(organizationId, externalId);
      if (!cur.ok || cur.dailyBudgetMajorBrl <= 0) {
        console.warn(`[automation] Meta orçamento campanha ${externalId}:`, cur.ok ? "sem daily_budget" : cur.message);
        return 0;
      }
      const next = Math.max(1, Math.round(cur.dailyBudgetMajorBrl * mult * 100) / 100);
      const out = await updateMetaCampaignDailyBudget(organizationId, externalId, next);
      if (!out.ok) {
        console.warn(`[automation] Meta budget campanha ${externalId}:`, out.message);
        return 0;
      }
      const log = await appendAutomationExecutionLog(organizationId, {
        ruleId: rule.id,
        assetId: externalId,
        assetLabel: label,
        actionTaken: String(action),
        previousValue: formatMoney(cur.dailyBudgetMajorBrl),
        newValue: formatMoney(next),
      });
      if (!log) return 0;
      const msg = `Orçamento diário (campanha) *${label}*: ${formatMoney(cur.dailyBudgetMajorBrl)} → ${formatMoney(next)}.`;
      await persistOccurrence(organizationId, rule, msg);
      await notifyAutomationWhatsApp(organizationId, rule, msg, "meta");
      return 1;
    }
    const cur = await fetchMetaAdsetBudgetMeta(organizationId, externalId);
    if (!cur.ok || cur.dailyBudgetMajorBrl <= 0) {
      console.warn(`[automation] Meta orçamento adset ${externalId}:`, cur.ok ? "sem daily_budget" : cur.message);
      return 0;
    }
    const next = Math.max(1, Math.round(cur.dailyBudgetMajorBrl * mult * 100) / 100);
    const out = await updateMetaAdsetDailyBudget(organizationId, externalId, next);
    if (!out.ok) {
      console.warn(`[automation] Meta budget adset ${externalId}:`, out.message);
      return 0;
    }
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: externalId,
      assetLabel: label,
      actionTaken: String(action),
      previousValue: formatMoney(cur.dailyBudgetMajorBrl),
      newValue: formatMoney(next),
    });
    if (!log) return 0;
    const msg = `Orçamento diário (conjunto) *${label}*: ${formatMoney(cur.dailyBudgetMajorBrl)} → ${formatMoney(next)}.`;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "meta");
    return 1;
  }

  return 0;
}

async function executeGoogleForRule(
  organizationId: string,
  rule: AlertRule,
  settingsRow: NonNullable<Awaited<ReturnType<typeof prisma.marketingSettings.findUnique>>>,
  range: { start: string; end: string }
): Promise<number> {
  const level = (rule.evaluationLevel ?? "campaign").trim() || "campaign";
  if (level !== "campaign") {
    console.info(
      `[automation] Google: regra ${rule.id} nível "${level}" — execução só em campanha; ignorada na API Google.`
    );
    return 0;
  }

  let actions = 0;
  const pack = await fetchGoogleAdsMetrics(organizationId, range, undefined);
  if (!pack.ok) return 0;

  for (const row of pack.campaigns) {
    const id = row.campaignId;
    if (!id) continue;
    const entity = googleCampaignToEntity(row);
    if (!entityMatchesAlertRule(rule, settingsRow, "google", PERIOD_KEY, entity)) continue;
    if (await wasRecentlyExecuted(organizationId, rule.id, id, rule.actionType)) continue;
    const n = await runGoogleMutation(organizationId, rule, id, row.campaignName || id, row.entityStatus);
    actions += n;
  }
  return actions;
}

async function runGoogleMutation(
  organizationId: string,
  rule: AlertRule,
  campaignId: string,
  label: string,
  entityStatus: string | undefined
): Promise<number> {
  const action = rule.actionType;

  if (action === "PAUSE_ASSET") {
    if (entityStatus === "PAUSED") return 0;
    const out = await mutateGoogleCampaignStatus(organizationId, campaignId, false, undefined);
    if (!out.ok) {
      console.warn(`[automation] Google pause ${campaignId}:`, out.message);
      return 0;
    }
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: campaignId,
      assetLabel: label,
      actionTaken: "PAUSE_ASSET",
      previousValue: entityStatus ?? "ACTIVE",
      newValue: "PAUSED",
    });
    if (!log) return 0;
    const msg = `Pausa automática (Google) na campanha *${label}*.`;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "google");
    return 1;
  }

  if (action === "INCREASE_BUDGET_20" || action === "DECREASE_BUDGET_20") {
    if (entityStatus === "PAUSED") return 0;
    const mult = action === "INCREASE_BUDGET_20" ? 1.2 : 0.8;
    const cur = await fetchGoogleCampaignBudgetMicros(organizationId, campaignId, undefined);
    if (!cur.ok) {
      console.warn(`[automation] Google orçamento ${campaignId}:`, cur.message);
      return 0;
    }
    const prevMajor = cur.amountMicros / 1_000_000;
    const nextMajor = Math.max(1, Math.round(prevMajor * mult * 100) / 100);
    const out = await mutateGoogleCampaignDailyBudget(organizationId, campaignId, nextMajor, undefined);
    if (!out.ok) {
      console.warn(`[automation] Google budget ${campaignId}:`, out.message);
      return 0;
    }
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: campaignId,
      assetLabel: label,
      actionTaken: String(action),
      previousValue: formatMoney(prevMajor),
      newValue: formatMoney(nextMajor),
    });
    if (!log) return 0;
    const msg = `Orçamento diário (Google) *${label}*: ${formatMoney(prevMajor)} → ${formatMoney(nextMajor)}.`;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "google");
    return 1;
  }

  return 0;
}

/**
 * Executa uma passagem de automações para uma organização (Meta / Google, por regra).
 * @returns número de ações de mídia executadas com sucesso nesta org.
 */
export async function runAutomationForOrganization(organizationId: string): Promise<number> {
  const features = await getEffectivePlanFeatures(organizationId);
  if (!features.performanceAlerts || !features.campaignWrite) return 0;

  const rules = await prisma.alertRule.findMany({
    where: {
      organizationId,
      active: true,
      actionType: { not: "NOTIFY_ONLY" },
    },
    orderBy: { createdAt: "asc" },
  });
  if (rules.length === 0) return 0;

  const settingsRow = await prisma.marketingSettings.findUnique({
    where: { organizationId },
  });
  if (!settingsRow) return 0;

  const range = defaultDateRange();
  let total = 0;

  for (const rule of rules) {
    try {
      if (ruleAppliesToChannel(rule, "meta")) {
        total += await executeMetaForRule(organizationId, rule, settingsRow, range);
      }
      if (ruleAppliesToChannel(rule, "google")) {
        total += await executeGoogleForRule(organizationId, rule, settingsRow, range);
      }
    } catch (e) {
      console.error(`[automation] regra ${rule.id} org ${organizationId}:`, e);
    }
  }

  return total;
}

/** Varre todas as organizações ativas (uso do worker). */
export async function runAutomationExecutionTick(): Promise<{
  organizationsScanned: number;
  actionsExecuted: number;
}> {
  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  let actionsExecuted = 0;
  for (const { id } of orgs) {
    const n = await runAutomationForOrganization(id);
    actionsExecuted += n;
  }
  return { organizationsScanned: orgs.length, actionsExecuted };
}
