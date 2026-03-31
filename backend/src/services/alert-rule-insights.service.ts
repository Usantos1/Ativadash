import type { MarketingSettings } from "@prisma/client";
import type { InsightAlert } from "../types/marketing-insight.types.js";
import {
  resolveBlendedDailyBudgetMaxBrl,
  resolveChannelGoals,
} from "../lib/marketing-channel-settings.js";
import { prisma } from "../utils/prisma.js";
import { getEffectivePlanFeatures } from "./effective-plan-features.service.js";
import { formatMoney } from "./marketing-settings-format.js";
import { recordAlertOccurrenceDeduped } from "./alert-rules.service.js";

function utcHour(): number {
  return new Date().getUTCHours();
}

/** Janela de mute em horas UTC (0–23). Legado; omitido na UI nova quando há horário local. */
export function isUtcHourMuted(muteStart: number | null, muteEnd: number | null): boolean {
  if (muteStart == null || muteEnd == null) return false;
  const h = utcHour();
  if (muteStart <= muteEnd) return h >= muteStart && h <= muteEnd;
  return h >= muteStart || h <= muteEnd;
}

/**
 * Regra com horário local + fuso (IANA): dispara se o relógio local estiver perto do HH:mm configurado.
 * Sem horário configurado → não restringe por tempo (compatível com regras antigas).
 */
export function isNearEvaluationLocalTime(
  timezone: string | null | undefined,
  hhmm: string | null | undefined,
  toleranceMin = 45
): boolean {
  if (!timezone?.trim() || !hhmm?.trim()) return true;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return true;
  const targetH = Number(m[1]);
  const targetM = Number(m[2]);
  if (!Number.isFinite(targetH) || !Number.isFinite(targetM) || targetH > 23 || targetM > 59) return true;
  const targetMinutes = targetH * 60 + targetM;
  const now = new Date();
  let ch = 0;
  let cm = 0;
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone.trim(),
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    ch = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    cm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  } catch {
    return true;
  }
  const cur = ch * 60 + cm;
  let diff = Math.abs(cur - targetMinutes);
  if (diff > 720) diff = 1440 - diff;
  return diff <= toleranceMin;
}

function passesTimeWindow(rule: {
  evaluationTimeLocal: string | null;
  evaluationTimezone: string | null;
  muteStartHour: number | null;
  muteEndHour: number | null;
}): boolean {
  if (rule.evaluationTimeLocal && rule.evaluationTimezone) {
    return isNearEvaluationLocalTime(rule.evaluationTimezone, rule.evaluationTimeLocal);
  }
  return !isUtcHourMuted(rule.muteStartHour, rule.muteEndHour);
}

function compareOp(operator: string, value: number, threshold: number): boolean {
  switch (operator) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    default:
      return false;
  }
}

function formatRuleMessage(
  tpl: string | null | undefined,
  fallback: string,
  vars: Record<string, string>
): string {
  const base = tpl?.trim() || fallback;
  return base
    .replace(/\{\{rule_name\}\}/gi, vars.rule_name)
    .replace(/\{\{period\}\}/gi, vars.period)
    .replace(/\{\{metric_value\}\}/gi, vars.metric_value)
    .replace(/\{\{goal_value\}\}/gi, vars.goal_value)
    .replace(/\{\{campaign_name\}\}/gi, vars.campaign_name);
}

type GoalSnapshot = {
  targetCpaBrl: number | null;
  maxCpaBrl: number | null;
  targetRoas: number | null;
};

function outsideTargetMatches(metric: string, value: number, settings: GoalSnapshot | null): boolean {
  if (!settings) return false;
  if (metric === "cpa") {
    const maxC = settings.maxCpaBrl;
    const tgt = settings.targetCpaBrl;
    const line = maxC ?? tgt;
    return line != null && Number.isFinite(line) && value > line;
  }
  if (metric === "roas") {
    const tgt = settings.targetRoas;
    return tgt != null && Number.isFinite(tgt) && value < tgt;
  }
  return false;
}

export type CustomAlertKpisContext = {
  /** Ex.: 7d, 30d — usado para estimar gasto diário quando não há spendTodayBrl. */
  period: string;
  periodLabel: string;
  totalSpendBrl: number;
  /** Gasto do dia corrente (BRL), quando o cliente envia na avaliação. */
  spendTodayBrl?: number | null;
  totalResults: number;
  totalAttributedValueBrl: number;
  totalImpressions?: number;
  totalClicks?: number;
  cpa: number | null;
  roas: number | null;
};

export type RuleEvaluatingChannel = "meta" | "google" | "blended";

function periodDays(p: string): number {
  if (p === "7d") return 7;
  if (p === "30d") return 30;
  if (p === "90d") return 90;
  return 30;
}

function channelGoalSnapshot(
  row: MarketingSettings | null,
  evaluatingChannel: RuleEvaluatingChannel
): GoalSnapshot | null {
  if (!row) return null;
  if (evaluatingChannel === "blended") {
    return {
      targetCpaBrl: row.targetCpaBrl != null ? Number(row.targetCpaBrl) : null,
      maxCpaBrl: row.maxCpaBrl != null ? Number(row.maxCpaBrl) : null,
      targetRoas: row.targetRoas != null ? Number(row.targetRoas) : null,
    };
  }
  const g = resolveChannelGoals(row, evaluatingChannel);
  return {
    targetCpaBrl: g.targetCpaBrl,
    maxCpaBrl: g.maxCpaBrl,
    targetRoas: g.targetRoas,
  };
}

function resolveDynamicThreshold(
  rule: { thresholdRef: string | null; threshold: unknown },
  row: MarketingSettings | null,
  evaluatingChannel: RuleEvaluatingChannel
): number | null {
  const ref = rule.thresholdRef?.trim() ?? "";
  if (!ref) {
    const n = Number(rule.threshold);
    return Number.isFinite(n) ? n : null;
  }
  if (!row) return null;
  if (ref === "VAR_CHANNEL_MAX_CPA") {
    if (evaluatingChannel === "blended") {
      const g = channelGoalSnapshot(row, "blended");
      return g?.maxCpaBrl ?? g?.targetCpaBrl ?? null;
    }
    const g = resolveChannelGoals(row, evaluatingChannel);
    return g.maxCpaBrl ?? g.targetCpaBrl ?? null;
  }
  if (ref === "VAR_CHANNEL_TARGET_ROAS") {
    if (evaluatingChannel === "blended") {
      return channelGoalSnapshot(row, "blended")?.targetRoas ?? null;
    }
    return resolveChannelGoals(row, evaluatingChannel).targetRoas;
  }
  if (ref === "VAR_BLENDED_DAILY_BUDGET_MAX") {
    return resolveBlendedDailyBudgetMaxBrl(row);
  }
  const n = Number(rule.threshold);
  return Number.isFinite(n) ? n : null;
}

function ruleMatchesEvalScope(
  appliesToChannel: string | null | undefined,
  evaluatingChannel: RuleEvaluatingChannel
): boolean {
  const raw = (appliesToChannel ?? "").trim().toLowerCase();
  const ch = raw === "" ? "all" : raw;
  if (evaluatingChannel === "blended") {
    return ch === "all";
  }
  return ch === "all" || ch === evaluatingChannel;
}

export async function appendCustomRuleAlerts(
  organizationId: string,
  ctx: CustomAlertKpisContext,
  alerts: InsightAlert[],
  opts: { persistOccurrences: boolean; evaluatingChannel?: RuleEvaluatingChannel }
): Promise<void> {
  const features = await getEffectivePlanFeatures(organizationId);
  if (!features.performanceAlerts) return;

  const scope: RuleEvaluatingChannel = opts.evaluatingChannel ?? "blended";

  const settingsRow = await prisma.marketingSettings.findUnique({
    where: { organizationId },
  });

  const goalSnapChannel = channelGoalSnapshot(settingsRow, scope);

  const rules = await prisma.alertRule.findMany({
    where: { organizationId, active: true },
    orderBy: { createdAt: "asc" },
  });

  for (const rule of rules) {
    if (!ruleMatchesEvalScope(rule.appliesToChannel, scope)) continue;
    if (!passesTimeWindow(rule)) continue;

    let value: number | null = null;
    switch (rule.metric) {
      case "cpa":
        value = ctx.cpa;
        break;
      case "roas":
        value = ctx.roas;
        break;
      case "spend":
        value = ctx.totalSpendBrl;
        break;
      case "daily_spend": {
        const days = Math.max(1, periodDays(ctx.period));
        const st = ctx.spendTodayBrl;
        value =
          st != null && Number.isFinite(st) && st >= 0
            ? st
            : ctx.totalSpendBrl / days;
        break;
      }
      case "ctr":
        if (
          ctx.totalImpressions != null &&
          ctx.totalClicks != null &&
          ctx.totalImpressions > 0
        ) {
          value = (ctx.totalClicks / ctx.totalImpressions) * 100;
        }
        break;
      default:
        break;
    }

    if (value == null || !Number.isFinite(value)) continue;

    let fires = false;
    let v = value;
    const tResolved = resolveDynamicThreshold(rule, settingsRow, scope);
    let t = tResolved ?? NaN;

    if (rule.metric === "cpa") {
      v = Math.round(value * 100) / 100;
      t = tResolved != null && Number.isFinite(tResolved) ? Math.round(tResolved * 100) / 100 : NaN;
    }

    if (rule.operator === "outside_target") {
      fires = outsideTargetMatches(rule.metric, v, goalSnapChannel);
    } else {
      if (tResolved == null || !Number.isFinite(tResolved)) continue;
      fires = compareOp(rule.operator, v, t);
    }

    if (!fires) continue;

    const displayTh = tResolved ?? Number(rule.threshold);
    const metricLabel =
      rule.metric === "cpa" || rule.metric === "spend" || rule.metric === "daily_spend"
        ? formatMoney(v)
        : rule.metric === "ctr"
          ? `${value.toFixed(2)}%`
          : `${value.toFixed(2)}×`;

    const thLabel =
      rule.metric === "cpa" || rule.metric === "spend" || rule.metric === "daily_spend"
        ? formatMoney(Number.isFinite(displayTh) ? displayTh : Number(rule.threshold))
        : rule.metric === "ctr"
          ? `${(Number.isFinite(tResolved ?? NaN) ? (tResolved as number) : Number(rule.threshold)).toFixed(2)}%`
          : `${(Number.isFinite(tResolved ?? NaN) ? (tResolved as number) : Number(rule.threshold)).toFixed(2)}×`;

    const goalLine =
      rule.metric === "cpa"
        ? goalSnapChannel?.maxCpaBrl != null
          ? formatMoney(goalSnapChannel.maxCpaBrl)
          : goalSnapChannel?.targetCpaBrl != null
            ? formatMoney(goalSnapChannel.targetCpaBrl)
            : thLabel
        : rule.metric === "roas" && goalSnapChannel?.targetRoas != null
          ? `${goalSnapChannel.targetRoas.toFixed(2)}×`
          : rule.metric === "daily_spend"
            ? thLabel
            : thLabel;

    const fallbackMsg = `Valor atual ${metricLabel} — ${rule.operator === "outside_target" ? "fora da meta" : `condição ${rule.operator}`} (${ctx.periodLabel}).`;
    const msg = formatRuleMessage(rule.messageTemplate, fallbackMsg, {
      rule_name: rule.name,
      period: ctx.periodLabel,
      metric_value: metricLabel,
      goal_value: goalLine,
      campaign_name: ctx.periodLabel,
    });

    const sev = rule.severity === "critical" ? "critical" : "warning";

    alerts.push({
      severity: sev,
      code: `CUSTOM_RULE:${rule.id}`,
      title: rule.name,
      message: msg,
      ...(scope === "blended" ? {} : { channel: scope }),
    });

    if (opts.persistOccurrences) {
      await recordAlertOccurrenceDeduped(organizationId, rule.id, {
        severity: sev,
        title: rule.name,
        message: msg,
        metricValue: value,
      }).catch((err) => console.error("[AlertOccurrence]", err));
    }
  }
}
