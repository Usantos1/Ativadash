import type { AlertRule, AutomationActionType, MarketingSettings } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { appendAutomationExecutionLog } from "./automation-execution-log.service.js";
import {
  entityMatchesAlertRule,
  getAutomationEntityMetricSnapshot,
  resolveDynamicThreshold,
  type AutomationEntityMetricInput,
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
  fetchGoogleAdsAdGroupMetrics,
  fetchGoogleAdsAdMetrics,
  mutateGoogleCampaignStatus,
  mutateGoogleCampaignDailyBudget,
  mutateGoogleAdGroupStatus,
  mutateGoogleAdGroupAdStatus,
  fetchGoogleCampaignBudgetMicros,
  type GoogleAdsCampaignRow,
  type GoogleAdsAdGroupRow,
  type GoogleAdsAdRow,
} from "./google-ads-metrics.service.js";
import type { InsightAlert } from "../types/marketing-insight.types.js";

const PERIOD_KEY = "7d";

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

function ruleCooldownMinutes(rule: AlertRule): number {
  const n = rule.cooldownMinutes;
  return n != null && Number.isFinite(n) && n > 0 ? n : 1440;
}

function scalePercentFromRule(rule: AlertRule): number {
  const raw = rule.actionValue != null ? Number(rule.actionValue) : 20;
  if (!Number.isFinite(raw)) return 20;
  return Math.min(90, Math.max(1, raw));
}

function budgetMultiplierIncrease(rule: AlertRule): number {
  return 1 + scalePercentFromRule(rule) / 100;
}

function budgetMultiplierDecrease(rule: AlertRule): number {
  return 1 - scalePercentFromRule(rule) / 100;
}

function formatMetricForAutomation(metric: string, v: number): string {
  if (metric === "roas") return v.toFixed(2);
  if (metric === "ctr") return `${v.toFixed(2)}%`;
  return formatMoney(v);
}

function formatThresholdForAutomation(metric: string, t: number | null): string {
  if (t == null || !Number.isFinite(t)) return "—";
  return formatMetricForAutomation(metric, t);
}

function passesWorkerEvaluationGate(rule: AlertRule, now = Date.now()): boolean {
  if (rule.checkFrequencyMinutes == null) return true;
  const last = rule.lastEvaluationAt;
  if (!last) return true;
  return now - last.getTime() >= rule.checkFrequencyMinutes * 60_000;
}

async function wasRecentlyExecuted(
  organizationId: string,
  ruleId: string,
  assetId: string,
  actionTaken: AutomationActionType,
  cooldownMinutes: number
): Promise<boolean> {
  const since = new Date(Date.now() - cooldownMinutes * 60_000);
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

function googleAdGroupToEntity(row: GoogleAdsAdGroupRow): AutomationEntityMetricInput {
  const costBrl = row.costMicros / 1_000_000;
  return {
    spendBrl: costBrl,
    resultsForCpa: Math.max(0, row.conversions),
    purchaseValueBrl: row.conversionsValue,
    impressions: row.impressions,
    clicks: row.clicks,
  };
}

function googleAdsAdRowToEntity(row: GoogleAdsAdRow): AutomationEntityMetricInput {
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
      if (await wasRecentlyExecuted(organizationId, rule.id, id, rule.actionType, ruleCooldownMinutes(rule)))
        continue;
      const n = await runMetaMutation(
        organizationId,
        rule,
        "campaign",
        id,
        row.campaignName || id,
        row.entityStatus,
        settingsRow,
        entity
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
      if (await wasRecentlyExecuted(organizationId, rule.id, id, rule.actionType, ruleCooldownMinutes(rule)))
        continue;
      const n = await runMetaMutation(
        organizationId,
        rule,
        "ad_set",
        id,
        row.adsetName || id,
        undefined,
        settingsRow,
        entity
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
    if (await wasRecentlyExecuted(organizationId, rule.id, id, rule.actionType, ruleCooldownMinutes(rule)))
      continue;
    const n = await runMetaMutation(organizationId, rule, "ad", id, row.adName || id, undefined, settingsRow, entity);
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
  entityStatus: string | undefined,
  settingsRow: MarketingSettings | null,
  entity: AutomationEntityMetricInput
): Promise<number> {
  const action = rule.actionType;
  const cd = ruleCooldownMinutes(rule);

  if (action === "NOTIFY_ONLY") {
    if (await wasRecentlyExecuted(organizationId, rule.id, externalId, action, cd)) return 0;
    const snap = getAutomationEntityMetricSnapshot(rule, settingsRow, "meta", PERIOD_KEY, entity);
    if (snap == null) return 0;
    const thr = resolveDynamicThreshold(rule, settingsRow, "meta");
    const mv = formatMetricForAutomation(rule.metric, snap);
    const tv = formatThresholdForAutomation(rule.metric, thr);
    const msg = `*${rule.name}* — *${label}* (Meta): ${rule.metric.toUpperCase()} = ${mv} (limiar ${tv}).`;
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: externalId,
      assetLabel: label,
      actionTaken: "NOTIFY_ONLY",
      previousValue: mv,
      newValue: tv,
    });
    if (!log) return 0;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "meta");
    return 1;
  }

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

  if (action === "ACTIVATE_ASSET") {
    if (entityStatus === "ACTIVE") return 0;
    let out: { ok: true } | { ok: false; message: string };
    if (kind === "campaign") out = await updateMetaCampaignStatus(organizationId, externalId, "ACTIVE");
    else if (kind === "ad_set") out = await updateMetaAdsetStatus(organizationId, externalId, "ACTIVE");
    else out = await updateMetaAdStatus(organizationId, externalId, "ACTIVE");
    if (!out.ok) {
      console.warn(`[automation] Meta ativar falhou ${externalId}:`, out.message);
      return 0;
    }
    const prev = entityStatus ?? "PAUSED";
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: externalId,
      assetLabel: label,
      actionTaken: "ACTIVATE_ASSET",
      previousValue: prev,
      newValue: "ACTIVE",
    });
    if (!log) return 0;
    const msg = `Ativação automática (${kind}) em *${label}*.`;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "meta");
    return 1;
  }

  if (action === "INCREASE_BUDGET_20" || action === "DECREASE_BUDGET_20") {
    if (kind === "ad") {
      console.info(`[automation] Orçamento em anúncio ignorado (regra ${rule.id}); use campanha ou conjunto.`);
      return 0;
    }
    const mult =
      action === "INCREASE_BUDGET_20" ? budgetMultiplierIncrease(rule) : budgetMultiplierDecrease(rule);
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
      const msg = `Orçamento diário (campanha) *${label}*: ${formatMoney(cur.dailyBudgetMajorBrl)} → ${formatMoney(next)} (${scalePercentFromRule(rule)}%).`;
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
    const msg = `Orçamento diário (conjunto) *${label}*: ${formatMoney(cur.dailyBudgetMajorBrl)} → ${formatMoney(next)} (${scalePercentFromRule(rule)}%).`;
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

  if (level === "ad") {
    let actions = 0;
    const pack = await fetchGoogleAdsAdMetrics(organizationId, range, undefined);
    if (!pack.ok) return 0;
    const adMutationMetrics = { skippedBudgetMissingCampaign: 0 };
    for (const row of pack.rows) {
      const agId = row.adGroupId;
      const adId = row.adId;
      const campId = row.campaignId;
      if (!agId || !adId) continue;
      const assetKey = `${agId}~${adId}`;
      const entity = googleAdsAdRowToEntity(row);
      if (!entityMatchesAlertRule(rule, settingsRow, "google", PERIOD_KEY, entity)) continue;
      if (await wasRecentlyExecuted(organizationId, rule.id, assetKey, rule.actionType, ruleCooldownMinutes(rule)))
        continue;
      const adLabel = row.adName?.trim() || adId;
      const n = await runGoogleAdMutation(
        organizationId,
        rule,
        agId,
        adId,
        assetKey,
        adLabel,
        row.adGroupName || agId,
        campId,
        row.campaignName || campId || "—",
        row.entityStatus,
        settingsRow,
        entity,
        adMutationMetrics
      );
      actions += n;
    }
    if (adMutationMetrics.skippedBudgetMissingCampaign > 0) {
      console.warn(
        `[automation] Google regra ${rule.id} org ${organizationId}: ${adMutationMetrics.skippedBudgetMissingCampaign} gatilho(s) ±20% em nível anúncio ignorados (sem campaignId na métrica; o orçamento é ao nível da campanha).`
      );
    }
    return actions;
  }

  if (level === "ad_set") {
    let actions = 0;
    const pack = await fetchGoogleAdsAdGroupMetrics(organizationId, range, undefined);
    if (!pack.ok) return 0;
    for (const row of pack.rows) {
      const agId = row.adGroupId;
      const campId = row.campaignId;
      if (!agId || !campId) continue;
      const entity = googleAdGroupToEntity(row);
      if (!entityMatchesAlertRule(rule, settingsRow, "google", PERIOD_KEY, entity)) continue;
      if (await wasRecentlyExecuted(organizationId, rule.id, agId, rule.actionType, ruleCooldownMinutes(rule)))
        continue;
      const n = await runGoogleAdGroupMutation(
        organizationId,
        rule,
        agId,
        row.adGroupName || agId,
        campId,
        row.campaignName || campId,
        row.entityStatus,
        settingsRow,
        entity
      );
      actions += n;
    }
    return actions;
  }

  let actions = 0;
  const pack = await fetchGoogleAdsMetrics(organizationId, range, undefined);
  if (!pack.ok) return 0;

  for (const row of pack.campaigns) {
    const id = row.campaignId;
    if (!id) continue;
    const entity = googleCampaignToEntity(row);
    if (!entityMatchesAlertRule(rule, settingsRow, "google", PERIOD_KEY, entity)) continue;
    if (await wasRecentlyExecuted(organizationId, rule.id, id, rule.actionType, ruleCooldownMinutes(rule)))
      continue;
    const n = await runGoogleMutation(
      organizationId,
      rule,
      id,
      row.campaignName || id,
      row.entityStatus,
      settingsRow,
      entity
    );
    actions += n;
  }
  return actions;
}

async function runGoogleAdGroupMutation(
  organizationId: string,
  rule: AlertRule,
  adGroupId: string,
  adGroupLabel: string,
  campaignId: string,
  campaignLabel: string,
  entityStatus: string | undefined,
  settingsRow: MarketingSettings | null,
  entity: AutomationEntityMetricInput
): Promise<number> {
  const action = rule.actionType;
  const cd = ruleCooldownMinutes(rule);

  if (action === "NOTIFY_ONLY") {
    if (await wasRecentlyExecuted(organizationId, rule.id, adGroupId, action, cd)) return 0;
    const snap = getAutomationEntityMetricSnapshot(rule, settingsRow, "google", PERIOD_KEY, entity);
    if (snap == null) return 0;
    const thr = resolveDynamicThreshold(rule, settingsRow, "google");
    const mv = formatMetricForAutomation(rule.metric, snap);
    const tv = formatThresholdForAutomation(rule.metric, thr);
    const msg = `*${rule.name}* — *${adGroupLabel}* (Google Ads): ${rule.metric.toUpperCase()} = ${mv} (limiar ${tv}).`;
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: adGroupId,
      assetLabel: `${adGroupLabel} · ${campaignLabel}`,
      actionTaken: "NOTIFY_ONLY",
      previousValue: mv,
      newValue: tv,
    });
    if (!log) return 0;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "google");
    return 1;
  }

  if (action === "PAUSE_ASSET") {
    if (entityStatus === "PAUSED") return 0;
    const out = await mutateGoogleAdGroupStatus(organizationId, adGroupId, false, undefined);
    if (!out.ok) {
      console.warn(`[automation] Google pause ad_group ${adGroupId}:`, out.message);
      return 0;
    }
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: adGroupId,
      assetLabel: `${adGroupLabel} · ${campaignLabel}`,
      actionTaken: "PAUSE_ASSET",
      previousValue: entityStatus ?? "ACTIVE",
      newValue: "PAUSED",
    });
    if (!log) return 0;
    const msg = `Pausa automática (Google) no conjunto *${adGroupLabel}* (campanha *${campaignLabel}*).`;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "google");
    return 1;
  }

  if (action === "ACTIVATE_ASSET") {
    if (entityStatus !== "PAUSED") return 0;
    const out = await mutateGoogleAdGroupStatus(organizationId, adGroupId, true, undefined);
    if (!out.ok) {
      console.warn(`[automation] Google ativar ad_group ${adGroupId}:`, out.message);
      return 0;
    }
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: adGroupId,
      assetLabel: `${adGroupLabel} · ${campaignLabel}`,
      actionTaken: "ACTIVATE_ASSET",
      previousValue: entityStatus ?? "PAUSED",
      newValue: "ENABLED",
    });
    if (!log) return 0;
    const msg = `Ativação automática (Google) no conjunto *${adGroupLabel}* (campanha *${campaignLabel}*).`;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "google");
    return 1;
  }

  if (action === "INCREASE_BUDGET_20" || action === "DECREASE_BUDGET_20") {
    if (entityStatus === "PAUSED") return 0;
    const mult =
      action === "INCREASE_BUDGET_20" ? budgetMultiplierIncrease(rule) : budgetMultiplierDecrease(rule);
    const cur = await fetchGoogleCampaignBudgetMicros(organizationId, campaignId, undefined);
    if (!cur.ok) {
      console.warn(`[automation] Google orçamento (campanha pai) ${campaignId}:`, cur.message);
      return 0;
    }
    const prevMajor = cur.amountMicros / 1_000_000;
    const nextMajor = Math.max(1, Math.round(prevMajor * mult * 100) / 100);
    const out = await mutateGoogleCampaignDailyBudget(organizationId, campaignId, nextMajor, undefined);
    if (!out.ok) {
      console.warn(`[automation] Google budget campanha ${campaignId}:`, out.message);
      return 0;
    }
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: adGroupId,
      assetLabel: `${adGroupLabel} → camp. ${campaignLabel}`,
      actionTaken: String(action),
      previousValue: formatMoney(prevMajor),
      newValue: formatMoney(nextMajor),
    });
    if (!log) return 0;
    const msg = `Orçamento diário da campanha *${campaignLabel}* (gatilho no conjunto *${adGroupLabel}*): ${formatMoney(prevMajor)} → ${formatMoney(nextMajor)} (${scalePercentFromRule(rule)}%).`;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "google");
    return 1;
  }

  return 0;
}

async function runGoogleAdMutation(
  organizationId: string,
  rule: AlertRule,
  adGroupId: string,
  adId: string,
  assetKey: string,
  adLabel: string,
  adGroupLabel: string,
  campaignId: string | undefined,
  campaignLabel: string,
  entityStatus: string | undefined,
  settingsRow: MarketingSettings | null,
  entity: AutomationEntityMetricInput,
  metrics?: { skippedBudgetMissingCampaign: number }
): Promise<number> {
  const action = rule.actionType;
  const fullLabel = `${adLabel} · ${adGroupLabel} · ${campaignLabel}`;
  const cd = ruleCooldownMinutes(rule);

  if (action === "NOTIFY_ONLY") {
    if (await wasRecentlyExecuted(organizationId, rule.id, assetKey, action, cd)) return 0;
    const snap = getAutomationEntityMetricSnapshot(rule, settingsRow, "google", PERIOD_KEY, entity);
    if (snap == null) return 0;
    const thr = resolveDynamicThreshold(rule, settingsRow, "google");
    const mv = formatMetricForAutomation(rule.metric, snap);
    const tv = formatThresholdForAutomation(rule.metric, thr);
    const msg = `*${rule.name}* — *${fullLabel}* (Google Ads): ${rule.metric.toUpperCase()} = ${mv} (limiar ${tv}).`;
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: assetKey,
      assetLabel: fullLabel,
      actionTaken: "NOTIFY_ONLY",
      previousValue: mv,
      newValue: tv,
    });
    if (!log) return 0;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "google");
    return 1;
  }

  if (action === "PAUSE_ASSET") {
    if (entityStatus === "PAUSED") return 0;
    const out = await mutateGoogleAdGroupAdStatus(organizationId, adGroupId, adId, false, undefined);
    if (!out.ok) {
      console.warn(`[automation] Google pause ad ${adGroupId}~${adId}:`, out.message);
      return 0;
    }
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: assetKey,
      assetLabel: fullLabel,
      actionTaken: "PAUSE_ASSET",
      previousValue: entityStatus ?? "ACTIVE",
      newValue: "PAUSED",
    });
    if (!log) return 0;
    const msg = `Pausa automática (Google) no anúncio *${adLabel}* (conjunto *${adGroupLabel}*, campanha *${campaignLabel}*).`;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "google");
    return 1;
  }

  if (action === "ACTIVATE_ASSET") {
    if (entityStatus !== "PAUSED") return 0;
    const out = await mutateGoogleAdGroupAdStatus(organizationId, adGroupId, adId, true, undefined);
    if (!out.ok) {
      console.warn(`[automation] Google ativar ad ${adGroupId}~${adId}:`, out.message);
      return 0;
    }
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: assetKey,
      assetLabel: fullLabel,
      actionTaken: "ACTIVATE_ASSET",
      previousValue: entityStatus ?? "PAUSED",
      newValue: "ENABLED",
    });
    if (!log) return 0;
    const msg = `Ativação automática (Google) no anúncio *${adLabel}* (conjunto *${adGroupLabel}*, campanha *${campaignLabel}*).`;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "google");
    return 1;
  }

  if (action === "INCREASE_BUDGET_20" || action === "DECREASE_BUDGET_20") {
    if (!campaignId) {
      if (metrics) metrics.skippedBudgetMissingCampaign += 1;
      return 0;
    }
    if (entityStatus === "PAUSED") return 0;
    const mult =
      action === "INCREASE_BUDGET_20" ? budgetMultiplierIncrease(rule) : budgetMultiplierDecrease(rule);
    const cur = await fetchGoogleCampaignBudgetMicros(organizationId, campaignId, undefined);
    if (!cur.ok) {
      console.warn(`[automation] Google orçamento (campanha pai, gatilho anúncio) ${campaignId}:`, cur.message);
      return 0;
    }
    const prevMajor = cur.amountMicros / 1_000_000;
    const nextMajor = Math.max(1, Math.round(prevMajor * mult * 100) / 100);
    const out = await mutateGoogleCampaignDailyBudget(organizationId, campaignId, nextMajor, undefined);
    if (!out.ok) {
      console.warn(`[automation] Google budget campanha ${campaignId} (gatilho anúncio):`, out.message);
      return 0;
    }
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: assetKey,
      assetLabel: `${fullLabel} → camp.`,
      actionTaken: String(action),
      previousValue: formatMoney(prevMajor),
      newValue: formatMoney(nextMajor),
    });
    if (!log) return 0;
    const msg = `Orçamento diário da campanha *${campaignLabel}* (gatilho no anúncio *${adLabel}*): ${formatMoney(prevMajor)} → ${formatMoney(nextMajor)} (${scalePercentFromRule(rule)}%).`;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "google");
    return 1;
  }

  return 0;
}

async function runGoogleMutation(
  organizationId: string,
  rule: AlertRule,
  campaignId: string,
  label: string,
  entityStatus: string | undefined,
  settingsRow: MarketingSettings | null,
  entity: AutomationEntityMetricInput
): Promise<number> {
  const action = rule.actionType;
  const cd = ruleCooldownMinutes(rule);

  if (action === "NOTIFY_ONLY") {
    if (await wasRecentlyExecuted(organizationId, rule.id, campaignId, action, cd)) return 0;
    const snap = getAutomationEntityMetricSnapshot(rule, settingsRow, "google", PERIOD_KEY, entity);
    if (snap == null) return 0;
    const thr = resolveDynamicThreshold(rule, settingsRow, "google");
    const mv = formatMetricForAutomation(rule.metric, snap);
    const tv = formatThresholdForAutomation(rule.metric, thr);
    const msg = `*${rule.name}* — *${label}* (Google Ads): ${rule.metric.toUpperCase()} = ${mv} (limiar ${tv}).`;
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: campaignId,
      assetLabel: label,
      actionTaken: "NOTIFY_ONLY",
      previousValue: mv,
      newValue: tv,
    });
    if (!log) return 0;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "google");
    return 1;
  }

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

  if (action === "ACTIVATE_ASSET") {
    if (entityStatus !== "PAUSED") return 0;
    const out = await mutateGoogleCampaignStatus(organizationId, campaignId, true, undefined);
    if (!out.ok) {
      console.warn(`[automation] Google ativar campanha ${campaignId}:`, out.message);
      return 0;
    }
    const log = await appendAutomationExecutionLog(organizationId, {
      ruleId: rule.id,
      assetId: campaignId,
      assetLabel: label,
      actionTaken: "ACTIVATE_ASSET",
      previousValue: entityStatus ?? "PAUSED",
      newValue: "ENABLED",
    });
    if (!log) return 0;
    const msg = `Ativação automática (Google) na campanha *${label}*.`;
    await persistOccurrence(organizationId, rule, msg);
    await notifyAutomationWhatsApp(organizationId, rule, msg, "google");
    return 1;
  }

  if (action === "INCREASE_BUDGET_20" || action === "DECREASE_BUDGET_20") {
    if (entityStatus === "PAUSED") return 0;
    const mult =
      action === "INCREASE_BUDGET_20" ? budgetMultiplierIncrease(rule) : budgetMultiplierDecrease(rule);
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
    const msg = `Orçamento diário (Google) *${label}*: ${formatMoney(prevMajor)} → ${formatMoney(nextMajor)} (${scalePercentFromRule(rule)}%).`;
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
  if (!features.performanceAlerts) return 0;

  const rules = await prisma.alertRule.findMany({
    where: {
      organizationId,
      active: true,
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
  const now = Date.now();

  for (const rule of rules) {
    if (!passesWorkerEvaluationGate(rule, now)) continue;

    const needsCampaignWrite = rule.actionType !== "NOTIFY_ONLY";
    if (needsCampaignWrite && !features.campaignWrite) continue;

    let actionsThisRule = 0;
    try {
      if (ruleAppliesToChannel(rule, "meta")) {
        actionsThisRule += await executeMetaForRule(organizationId, rule, settingsRow, range);
      }
      if (ruleAppliesToChannel(rule, "google")) {
        actionsThisRule += await executeGoogleForRule(organizationId, rule, settingsRow, range);
      }
      total += actionsThisRule;
      if (actionsThisRule > 0) {
        await prisma.alertRule.update({
          where: { id: rule.id },
          data: { lastExecutedAt: new Date() },
        });
      }
    } catch (e) {
      console.error(`[automation] regra ${rule.id} org ${organizationId}:`, e);
    } finally {
      if (rule.checkFrequencyMinutes != null) {
        await prisma.alertRule.update({
          where: { id: rule.id },
          data: { lastEvaluationAt: new Date() },
        });
      }
    }
  }

  return total;
}

/** Varre todas as organizações ativas (uso do worker). */
export async function runAutomationExecutionTick(): Promise<{
  organizationsScanned: number;
  actionsExecuted: number;
  durationMs: number;
}> {
  const t0 = Date.now();
  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  let actionsExecuted = 0;
  for (const { id } of orgs) {
    const n = await runAutomationForOrganization(id);
    actionsExecuted += n;
  }
  return {
    organizationsScanned: orgs.length,
    actionsExecuted,
    durationMs: Date.now() - t0,
  };
}
