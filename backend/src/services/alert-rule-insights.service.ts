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
export async function appendCustomRuleAlerts(
  organizationId: string,
  ctx: CustomAlertKpisContext,
  alerts: InsightAlert[],
  opts: { persistOccurrences: boolean }
): Promise<void> {
  const features = await getEffectivePlanFeatures(organizationId);
  if (!features.performanceAlerts) return;

  const rules = await prisma.alertRule.findMany({
    where: { organizationId, active: true },
    orderBy: { createdAt: "asc" },
  });

  for (const rule of rules) {
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

    if (!compareOp(rule.operator, value, threshold)) continue;

    const sev = rule.severity === "critical" ? "critical" : "warning";
    const metricLabel =
      rule.metric === "cpa"
        ? formatMoney(value)
        : rule.metric === "spend"
          ? formatMoney(value)
          : rule.metric === "ctr"
            ? `${value.toFixed(2)}%`
            : `${value.toFixed(2)}×`;

    const thLabel =
      rule.metric === "cpa" || rule.metric === "spend"
        ? formatMoney(threshold)
        : rule.metric === "ctr"
          ? `${threshold.toFixed(2)}%`
          : `${threshold.toFixed(2)}×`;

    const msg = `Valor atual ${metricLabel} — condição ${rule.operator} ${thLabel} (${ctx.periodLabel}).`;

    alerts.push({
      severity: sev,
      code: `CUSTOM_RULE:${rule.id}`,
      title: rule.name,
      message: msg,
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
