import type { MarketingSettings } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { normalizeAtivaCrmPhone, sendAtivaCrmTextMessage } from "./ativacrm.service.js";
import type { UpdateMarketingSettingsInput } from "../validators/marketing-settings.validator.js";

export type MarketingSettingsDto = {
  targetCpaBrl: number | null;
  maxCpaBrl: number | null;
  targetRoas: number | null;
  minResultsForCpa: number;
  minSpendForAlertsBrl: number | null;
  alertsEnabled: boolean;
  alertCpaAboveMax: boolean;
  alertCpaAboveTarget: boolean;
  alertRoasBelowTarget: boolean;
  ativaCrmTokenConfigured: boolean;
  ativaCrmNotifyPhone: string | null;
  ativaCrmAlertsEnabled: boolean;
};

export type InsightAlert = {
  severity: "critical" | "warning" | "info" | "success";
  code: string;
  title: string;
  message: string;
};

function decToNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDto(row: MarketingSettings): MarketingSettingsDto {
  return {
    targetCpaBrl: decToNumber(row.targetCpaBrl),
    maxCpaBrl: decToNumber(row.maxCpaBrl),
    targetRoas: decToNumber(row.targetRoas),
    minResultsForCpa: row.minResultsForCpa,
    minSpendForAlertsBrl: decToNumber(row.minSpendForAlertsBrl),
    alertsEnabled: row.alertsEnabled,
    alertCpaAboveMax: row.alertCpaAboveMax,
    alertCpaAboveTarget: row.alertCpaAboveTarget,
    alertRoasBelowTarget: row.alertRoasBelowTarget,
    ativaCrmTokenConfigured: Boolean(row.ativaCrmApiToken?.trim()),
    ativaCrmNotifyPhone: row.ativaCrmNotifyPhone ?? null,
    ativaCrmAlertsEnabled: row.ativaCrmAlertsEnabled,
  };
}

const periodLabels: Record<string, string> = {
  "7d": "últimos 7 dias",
  "30d": "últimos 30 dias",
  "90d": "últimos 90 dias",
};

function formatMoney(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export async function getOrCreateMarketingSettings(organizationId: string): Promise<MarketingSettingsDto> {
  const row = await prisma.marketingSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
  return toDto(row);
}

export async function updateMarketingSettings(
  organizationId: string,
  input: UpdateMarketingSettingsInput
): Promise<MarketingSettingsDto> {
  const data: Record<string, unknown> = {};
  if (input.targetCpaBrl !== undefined) data.targetCpaBrl = input.targetCpaBrl;
  if (input.maxCpaBrl !== undefined) data.maxCpaBrl = input.maxCpaBrl;
  if (input.targetRoas !== undefined) data.targetRoas = input.targetRoas;
  if (input.minResultsForCpa !== undefined) data.minResultsForCpa = input.minResultsForCpa;
  if (input.minSpendForAlertsBrl !== undefined) data.minSpendForAlertsBrl = input.minSpendForAlertsBrl;
  if (input.alertsEnabled !== undefined) data.alertsEnabled = input.alertsEnabled;
  if (input.alertCpaAboveMax !== undefined) data.alertCpaAboveMax = input.alertCpaAboveMax;
  if (input.alertCpaAboveTarget !== undefined) data.alertCpaAboveTarget = input.alertCpaAboveTarget;
  if (input.alertRoasBelowTarget !== undefined) data.alertRoasBelowTarget = input.alertRoasBelowTarget;
  if (input.ativaCrmApiToken !== undefined) {
    const t = input.ativaCrmApiToken;
    data.ativaCrmApiToken = t === null || t.trim() === "" ? null : t.trim();
  }
  if (input.ativaCrmNotifyPhone !== undefined) {
    const p = input.ativaCrmNotifyPhone;
    data.ativaCrmNotifyPhone = p === null || p.trim() === "" ? null : p.trim();
  }
  if (input.ativaCrmAlertsEnabled !== undefined) data.ativaCrmAlertsEnabled = input.ativaCrmAlertsEnabled;

  const row = await prisma.marketingSettings.upsert({
    where: { organizationId },
    create: { organizationId, ...data },
    update: data,
  });
  return toDto(row);
}

export function evaluatePerformanceInsights(
  settings: MarketingSettingsDto,
  input: {
    period: string;
    periodLabel?: string | null;
    totalSpendBrl: number;
    totalResults: number;
    totalAttributedValueBrl: number;
  }
): { kpis: { cpa: number | null; roas: number | null }; alerts: InsightAlert[]; periodLabel: string } {
  const custom = input.periodLabel?.trim();
  const periodLabel =
    custom && custom.length > 0 ? custom : (periodLabels[input.period] ?? "período selecionado");
  const cpa = input.totalResults > 0 ? input.totalSpendBrl / input.totalResults : null;
  const roas =
    input.totalSpendBrl > 0 && input.totalAttributedValueBrl > 0
      ? input.totalAttributedValueBrl / input.totalSpendBrl
      : null;

  const kpis = { cpa, roas };
  const alerts: InsightAlert[] = [];

  if (!settings.alertsEnabled) {
    return { kpis, alerts, periodLabel };
  }

  const minR = settings.minResultsForCpa;
  const minSpend = settings.minSpendForAlertsBrl;

  const spendOk = minSpend == null || input.totalSpendBrl >= minSpend;
  const resultsOkForCpa = input.totalResults >= minR;

  const hasCpaRules =
    (settings.maxCpaBrl != null && settings.alertCpaAboveMax) ||
    (settings.targetCpaBrl != null && settings.alertCpaAboveTarget);

  if (hasCpaRules && !resultsOkForCpa && (settings.targetCpaBrl != null || settings.maxCpaBrl != null)) {
    alerts.push({
      severity: "info",
      code: "CPA_INSUFFICIENT_DATA",
      title: "Poucos resultados para CPA",
      message: `Há ${input.totalResults} resultado(s) no período; configuramos mínimo de ${minR} para avaliar o CPA com segurança (${periodLabel}).`,
    });
  }

  if (hasCpaRules && minSpend != null && !spendOk) {
    alerts.push({
      severity: "info",
      code: "SPEND_BELOW_ALERT_THRESHOLD",
      title: "Gasto abaixo do mínimo para alertas",
      message: `O investimento (${formatMoney(input.totalSpendBrl)}) está abaixo do mínimo configurado (${formatMoney(minSpend)}). Alertas de CPA/ROAS ficam suspensos até o gasto subir.`,
    });
  }

  const canEvaluateCpa = resultsOkForCpa && spendOk && cpa != null;
  const canEvaluateRoas = spendOk && roas != null && input.totalAttributedValueBrl > 0;

  if (canEvaluateCpa && settings.maxCpaBrl != null && settings.alertCpaAboveMax && cpa > settings.maxCpaBrl) {
    alerts.push({
      severity: "critical",
      code: "CPA_ABOVE_MAX",
      title: "CPA acima do máximo",
      message: `CPA atual ${formatMoney(cpa)} ultrapassa o teto de ${formatMoney(settings.maxCpaBrl)} (${periodLabel}).`,
    });
  }

  if (
    canEvaluateCpa &&
    settings.targetCpaBrl != null &&
    settings.alertCpaAboveTarget &&
    cpa > settings.targetCpaBrl &&
    !(settings.maxCpaBrl != null && cpa > settings.maxCpaBrl && settings.alertCpaAboveMax)
  ) {
    alerts.push({
      severity: "warning",
      code: "CPA_ABOVE_TARGET",
      title: "CPA acima da meta",
      message: `CPA ${formatMoney(cpa)} está acima da meta de ${formatMoney(settings.targetCpaBrl)} (${periodLabel}).`,
    });
  }

  if (
    canEvaluateCpa &&
    settings.targetCpaBrl != null &&
    settings.maxCpaBrl != null &&
    settings.targetCpaBrl > settings.maxCpaBrl
  ) {
    alerts.push({
      severity: "info",
      code: "CPA_CONFIG_INCONSISTENT",
      title: "Ajuste as metas de CPA",
      message: "O CPA alvo está acima do CPA máximo configurado. Revise os valores em Config. Marketing.",
    });
  }

  if (
    canEvaluateRoas &&
    settings.targetRoas != null &&
    settings.alertRoasBelowTarget &&
    roas < settings.targetRoas
  ) {
    alerts.push({
      severity: "warning",
      code: "ROAS_BELOW_TARGET",
      title: "ROAS abaixo da meta",
      message: `ROAS ${roas.toFixed(2)}x está abaixo da meta de ${Number(settings.targetRoas).toFixed(2)}x (${periodLabel}).`,
    });
  }

  const hasBad = alerts.some((a) => a.severity === "critical" || a.severity === "warning");
  const hasAnyTarget =
    settings.targetCpaBrl != null || settings.maxCpaBrl != null || settings.targetRoas != null;

  if (!hasBad && hasAnyTarget && input.totalSpendBrl > 0) {
    let cpaOk = true;
    if (settings.targetCpaBrl != null || settings.maxCpaBrl != null) {
      cpaOk =
        canEvaluateCpa &&
        cpa != null &&
        (settings.maxCpaBrl == null || cpa <= settings.maxCpaBrl) &&
        (settings.targetCpaBrl == null || cpa <= settings.targetCpaBrl);
    }
    let roasOk = true;
    if (settings.targetRoas != null) {
      roasOk = canEvaluateRoas && roas != null && roas >= settings.targetRoas;
    }
    if (cpaOk && roasOk) {
      alerts.push({
        severity: "success",
        code: "PERFORMANCE_ON_TRACK",
        title: "Dentro das metas",
        message:
          cpa != null && canEvaluateCpa
            ? `CPA ${formatMoney(cpa)}${roas != null ? ` · ROAS ${roas.toFixed(2)}x` : ""} (${periodLabel}).`
            : roas != null
              ? `ROAS ${roas.toFixed(2)}x (${periodLabel}).`
              : `Indicadores conferem com suas metas (${periodLabel}).`,
      });
    }
  }

  return { kpis, alerts, periodLabel };
}

export async function evaluateInsightsForOrganization(
  organizationId: string,
  input: {
    period: string;
    periodLabel?: string | null;
    totalSpendBrl: number;
    totalResults: number;
    totalAttributedValueBrl: number;
  }
) {
  const settings = await getOrCreateMarketingSettings(organizationId);
  return evaluatePerformanceInsights(settings, input);
}

const ATIVA_CRM_ALERT_COOLDOWN_MS = 15 * 60 * 1000;

/** Envia alertas críticos/aviso por WhatsApp (Ativa CRM), com intervalo mínimo entre envios. */
export async function maybeSendAtivaCrmAlerts(
  organizationId: string,
  result: { alerts: InsightAlert[]; periodLabel: string }
): Promise<void> {
  const row = await prisma.marketingSettings.findUnique({
    where: { organizationId },
  });
  if (!row?.ativaCrmAlertsEnabled) return;
  const token = row.ativaCrmApiToken?.trim();
  if (!token) return;
  const phone = normalizeAtivaCrmPhone(row.ativaCrmNotifyPhone);
  if (!phone) return;

  const actionable = result.alerts.filter((a) => a.severity === "critical" || a.severity === "warning");
  if (actionable.length === 0) return;

  const last = row.lastAtivaCrmAlertSentAt;
  if (last && Date.now() - last.getTime() < ATIVA_CRM_ALERT_COOLDOWN_MS) return;

  const body =
    `*Ativa Dash* — Alertas (${result.periodLabel})\n\n` +
    actionable.map((a) => `• *${a.title}*\n${a.message}`).join("\n\n");

  const sent = await sendAtivaCrmTextMessage(token, phone, body);
  if (sent.ok) {
    await prisma.marketingSettings.update({
      where: { organizationId },
      data: { lastAtivaCrmAlertSentAt: new Date() },
    });
  } else {
    console.error("[Ativa CRM] Falha ao enviar alerta:", sent.error);
  }
}

export async function sendAtivaCrmTestForOrganization(
  organizationId: string,
  customBody?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const row = await prisma.marketingSettings.findUnique({
    where: { organizationId },
  });
  const token = row?.ativaCrmApiToken?.trim();
  if (!token) {
    return { ok: false, message: "Configure o token da Ativa CRM antes de testar." };
  }
  const phone = normalizeAtivaCrmPhone(row?.ativaCrmNotifyPhone);
  if (!phone) {
    return { ok: false, message: "Informe o número WhatsApp (com DDD) para receber o teste." };
  }
  const body =
    customBody?.trim() ||
    "Mensagem de teste — Ativa Dash. Integração Ativa CRM OK. Configure um WhatsApp padrão no CRM se ainda não enviou.";
  const sent = await sendAtivaCrmTextMessage(token, phone, body);
  if (sent.ok) return { ok: true };
  return { ok: false, message: sent.error };
}
