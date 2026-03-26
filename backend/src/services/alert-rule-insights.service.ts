import type { InsightAlert } from "../types/marketing-insight.types.js";
import { prisma } from "../utils/prisma.js";
import { getEffectivePlanFeatures } from "./effective-plan-features.service.js";
import { formatMoney } from "./marketing-settings-format.js";
import { recordAlertOccurrenceDeduped } from "./alert-rules.service.js";

function utcHour(): number {
  return new Date().getUTCHours();
}

/** Janela de mute em horas UTC (0–23). Ambos null = sem mute. */
export function isUtcHourMuted(muteStart: number | null, muteEnd: number | null): boolean {
  if (muteStart == null || muteEnd == null) return false;
  const h = utcHour();
  if (muteStart <= muteEnd) return h >= muteStart && h <= muteEnd;
  return h >= muteStart || h <= muteEnd;
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

export type CustomAlertKpisContext = {
  periodLabel: string;
  totalSpendBrl: number;
  totalResults: number;
  totalAttributedValueBrl: number;
  totalImpressions?: number;
  totalClicks?: number;
  cpa: number | null;
  roas: number | null;
};

/**
 * Acrescenta alertas de AlertRule ativas ao array existente.
 * Exige `performanceAlerts` no plano. Respeita mute UTC nas regras.
 */
export type RuleEvaluatingChannel = "meta" | "google" | "blended";

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

  const rules = await prisma.alertRule.findMany({
    where: { organizationId, active: true },
    orderBy: { createdAt: "asc" },
  });

  for (const rule of rules) {
    if (!ruleMatchesEvalScope(rule.appliesToChannel, scope)) continue;
    if (isUtcHourMuted(rule.muteStartHour, rule.muteEndHour)) continue;

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

    const threshold = Number(rule.threshold);
    if (!Number.isFinite(threshold)) continue;

    let v = value;
    let t = threshold;
    if (rule.metric === "cpa") {
      v = Math.round(value * 100) / 100;
      t = Math.round(threshold * 100) / 100;
    }

    if (!compareOp(rule.operator, v, t)) continue;

    const sev = rule.severity === "critical" ? "critical" : "warning";
    const displayVal = rule.metric === "cpa" ? v : value;
    const displayTh = rule.metric === "cpa" ? t : threshold;
    const metricLabel =
      rule.metric === "cpa"
        ? formatMoney(displayVal)
        : rule.metric === "spend"
          ? formatMoney(value)
          : rule.metric === "ctr"
            ? `${value.toFixed(2)}%`
            : `${value.toFixed(2)}×`;

    const thLabel =
      rule.metric === "cpa" || rule.metric === "spend"
        ? formatMoney(displayTh)
        : rule.metric === "ctr"
          ? `${threshold.toFixed(2)}%`
          : `${threshold.toFixed(2)}×`;

    const msg = `Valor atual ${metricLabel} — condição ${rule.operator} ${thLabel} (${ctx.periodLabel}).`;

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
