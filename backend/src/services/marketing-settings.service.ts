import { Prisma, type MarketingSettings } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import type { InsightAlert } from "../types/marketing-insight.types.js";
import {
  mergeAutomationsByChannel,
  mergeGoalsByChannel,
  mergeWhatsappAlertsByChannel,
  resolveAutomations,
  resolveChannelGoals,
  resolveWhatsappAlerts,
  type ChannelKey,
  type ResolvedChannelGoals,
  type ChannelAutomationsState,
  type ChannelWhatsappAlertsState,
} from "../lib/marketing-channel-settings.js";
import { normalizeAtivaCrmPhone, sendAtivaCrmTextMessage } from "./ativacrm.service.js";
import type { UpdateMarketingSettingsInput } from "../validators/marketing-settings.validator.js";
import { appendCustomRuleAlerts, isUtcHourMuted } from "./alert-rule-insights.service.js";
import { formatMoney } from "./marketing-settings-format.js";
import {
  alertWhatsappDedupeKey,
  formatWhatsappAlertLine,
  parseLastOutboundByCodeJson,
  parseMessageTemplatesJson,
} from "../lib/whatsapp-alert-format.js";

export type { InsightAlert };

export type MarketingSettingsDto = {
  businessGoalMode: "LEADS" | "SALES" | "HYBRID";
  primaryConversionLabel: string | null;
  showRevenueBlocksInLeadMode: boolean;
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
  /** Hub /marketing/integracoes — mesma regra que `ativaCrmHub` em GET /integrations */
  ativaCrmHubConnected: boolean;
  /** ISO — último alerta automático enviado com sucesso pelo WhatsApp */
  ativaCrmLastAlertSentAt: string | null;
  /** ISO — último teste de mensagem enviado com sucesso */
  ativaCrmLastTestSentAt: string | null;
  /** Metas efetivas por canal (JSON + fallback das colunas legadas). */
  goalsMeta: ResolvedChannelGoals;
  goalsGoogle: ResolvedChannelGoals;
  automationsMeta: ChannelAutomationsState;
  automationsGoogle: ChannelAutomationsState;
  whatsappAlertsMeta: ChannelWhatsappAlertsState;
  whatsappAlertsGoogle: ChannelWhatsappAlertsState;
  whatsappAlertCooldownMinutes: number | null;
  /** Modelos opcionais por código de alerta (chave `default` = fallback). */
  whatsappMessageTemplates: Record<string, string>;
  /** Preferências de resumo diário (envio real depende de cron/job no servidor). */
  whatsappDigestSchedule: {
    enabled: boolean;
    hourUtc: number;
    minuteUtc: number;
    extraPhones: string[];
  };
};

function decToNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDigestScheduleDto(json: unknown): {
  enabled: boolean;
  hourUtc: number;
  minuteUtc: number;
  extraPhones: string[];
} {
  const fb = { enabled: false, hourUtc: 9, minuteUtc: 0, extraPhones: [] as string[] };
  if (json == null || typeof json !== "object" || Array.isArray(json)) return fb;
  const o = json as Record<string, unknown>;
  const phones = o.extraPhones;
  return {
    enabled: Boolean(o.enabled),
    hourUtc: Math.min(23, Math.max(0, Math.trunc(Number(o.hourUtc)) || 9)),
    minuteUtc: Math.min(59, Math.max(0, Math.trunc(Number(o.minuteUtc)) || 0)),
    extraPhones: Array.isArray(phones)
      ? phones.map((p) => String(p).trim()).filter(Boolean).slice(0, 5)
      : [],
  };
}

async function loadRuleNotifyWhatsappMapTx(
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<Map<string, boolean>> {
  const rules = await tx.alertRule.findMany({
    where: { organizationId },
    select: { id: true, notifyWhatsapp: true },
  });
  return new Map(rules.map((r) => [r.id, r.notifyWhatsapp]));
}

/**
 * Ativa CRM “conectado” no hub: token persistido + WhatsApp (DDD) + alertas por WhatsApp ativos.
 * Mantém paridade com o que a tela de detalhe exige para operação real de alertas.
 */
export function isAtivaCrmHubConnected(params: {
  ativaCrmTokenConfigured: boolean;
  ativaCrmNotifyPhone: string | null;
  ativaCrmAlertsEnabled: boolean;
}): boolean {
  return (
    params.ativaCrmTokenConfigured &&
    Boolean(params.ativaCrmNotifyPhone?.trim()) &&
    params.ativaCrmAlertsEnabled
  );
}

function toDto(row: MarketingSettings): MarketingSettingsDto {
  const ativaCrmTokenConfigured = Boolean(row.ativaCrmApiToken?.trim());
  const ativaCrmNotifyPhone = row.ativaCrmNotifyPhone ?? null;
  const ativaCrmAlertsEnabled = row.ativaCrmAlertsEnabled;
  return {
    businessGoalMode: row.businessGoalMode,
    primaryConversionLabel: row.primaryConversionLabel?.trim() || null,
    showRevenueBlocksInLeadMode: row.showRevenueBlocksInLeadMode,
    targetCpaBrl: decToNumber(row.targetCpaBrl),
    maxCpaBrl: decToNumber(row.maxCpaBrl),
    targetRoas: decToNumber(row.targetRoas),
    minResultsForCpa: row.minResultsForCpa,
    minSpendForAlertsBrl: decToNumber(row.minSpendForAlertsBrl),
    alertsEnabled: row.alertsEnabled,
    alertCpaAboveMax: row.alertCpaAboveMax,
    alertCpaAboveTarget: row.alertCpaAboveTarget,
    alertRoasBelowTarget: row.alertRoasBelowTarget,
    ativaCrmTokenConfigured,
    ativaCrmNotifyPhone,
    ativaCrmAlertsEnabled,
    ativaCrmHubConnected: isAtivaCrmHubConnected({
      ativaCrmTokenConfigured,
      ativaCrmNotifyPhone,
      ativaCrmAlertsEnabled,
    }),
    ativaCrmLastAlertSentAt: row.lastAtivaCrmAlertSentAt?.toISOString() ?? null,
    ativaCrmLastTestSentAt: row.lastAtivaCrmTestSentAt?.toISOString() ?? null,
    goalsMeta: resolveChannelGoals(row, "meta"),
    goalsGoogle: resolveChannelGoals(row, "google"),
    automationsMeta: resolveAutomations(row, "meta"),
    automationsGoogle: resolveAutomations(row, "google"),
    whatsappAlertsMeta: resolveWhatsappAlerts(row, "meta"),
    whatsappAlertsGoogle: resolveWhatsappAlerts(row, "google"),
    whatsappAlertCooldownMinutes: row.whatsappAlertCooldownMinutes,
    whatsappMessageTemplates: parseMessageTemplatesJson(row.whatsappMessageTemplates),
    whatsappDigestSchedule: parseDigestScheduleDto(row.whatsappDigestSchedule),
  };
}

/** Payload para GET /integrations — fonte única com o DTO de settings */
export function ativaCrmHubFromSettingsDto(dto: MarketingSettingsDto) {
  return {
    connected: dto.ativaCrmHubConnected,
    tokenConfigured: dto.ativaCrmTokenConfigured,
    notifyPhone: dto.ativaCrmNotifyPhone,
    alertsEnabled: dto.ativaCrmAlertsEnabled,
  };
}

const periodLabels: Record<string, string> = {
  "7d": "últimos 7 dias",
  "30d": "últimos 30 dias",
  "90d": "últimos 90 dias",
};

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
  const existing = await prisma.marketingSettings.findUnique({ where: { organizationId } });
  const data: Record<string, unknown> = {};
  if (input.businessGoalMode !== undefined) data.businessGoalMode = input.businessGoalMode;
  if (input.primaryConversionLabel !== undefined) {
    const t = input.primaryConversionLabel;
    data.primaryConversionLabel = t === null || t.trim() === "" ? null : t.trim();
  }
  if (input.showRevenueBlocksInLeadMode !== undefined) {
    data.showRevenueBlocksInLeadMode = input.showRevenueBlocksInLeadMode;
  }
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
  if (input.whatsappAlertCooldownMinutes !== undefined) {
    data.whatsappAlertCooldownMinutes = input.whatsappAlertCooldownMinutes;
  }
  if (input.goalsByChannel !== undefined) {
    const merged = mergeGoalsByChannel(existing?.goalsByChannel, input.goalsByChannel);
    data.goalsByChannel =
      Object.keys(merged).length > 0 ? merged : Prisma.JsonNull;
  }
  if (input.automationsByChannel !== undefined) {
    const merged = mergeAutomationsByChannel(existing?.automationsByChannel, input.automationsByChannel);
    data.automationsByChannel =
      Object.keys(merged).length > 0 ? merged : Prisma.JsonNull;
  }
  if (input.whatsappAlertsByChannel !== undefined) {
    const merged = mergeWhatsappAlertsByChannel(
      existing?.whatsappAlertsByChannel,
      input.whatsappAlertsByChannel
    );
    data.whatsappAlertsByChannel =
      Object.keys(merged).length > 0 ? merged : Prisma.JsonNull;
  }
  if (input.whatsappMessageTemplates !== undefined) {
    data.whatsappMessageTemplates =
      input.whatsappMessageTemplates === null ? Prisma.JsonNull : input.whatsappMessageTemplates;
  }
  if (input.whatsappDigestSchedule !== undefined) {
    data.whatsappDigestSchedule =
      input.whatsappDigestSchedule === null ? Prisma.JsonNull : input.whatsappDigestSchedule;
  }

  const row = await prisma.marketingSettings.upsert({
    where: { organizationId },
    create: { organizationId, ...data },
    update: data,
  });
  return toDto(row);
}

type PanelAlertToggles = {
  alertsEnabled: boolean;
  alertCpaAboveMax: boolean;
  alertCpaAboveTarget: boolean;
  alertRoasBelowTarget: boolean;
};

function goalsFromDto(d: MarketingSettingsDto): ResolvedChannelGoals {
  return {
    targetCpaBrl: d.targetCpaBrl,
    maxCpaBrl: d.maxCpaBrl,
    targetRoas: d.targetRoas,
    minSpendForAlertsBrl: d.minSpendForAlertsBrl,
    minResultsForCpa: d.minResultsForCpa,
  };
}

function panelFromDto(d: MarketingSettingsDto): PanelAlertToggles {
  return {
    alertsEnabled: d.alertsEnabled,
    alertCpaAboveMax: d.alertCpaAboveMax,
    alertCpaAboveTarget: d.alertCpaAboveTarget,
    alertRoasBelowTarget: d.alertRoasBelowTarget,
  };
}

function channelTitlePrefix(ch?: ChannelKey): string {
  if (ch === "meta") return "[Meta Ads] ";
  if (ch === "google") return "[Google Ads] ";
  return "";
}

function alertCh(ch?: ChannelKey): Pick<InsightAlert, "channel"> | Record<string, never> {
  return ch ? { channel: ch } : {};
}

/**
 * Núcleo de CPA/ROAS e alertas do painel — metas numéricas vêm de `goals`; liga/desliga de tipos em `panel`.
 */
export function computePerformanceAlerts(
  panel: PanelAlertToggles,
  goals: ResolvedChannelGoals,
  input: {
    period: string;
    periodLabel?: string | null;
    totalSpendBrl: number;
    totalResults: number;
    totalAttributedValueBrl: number;
  },
  periodLabel: string,
  opts?: { channel?: ChannelKey; settingsRow?: MarketingSettings }
): { kpis: { cpa: number | null; roas: number | null }; alerts: InsightAlert[] } {
  const cpa = input.totalResults > 0 ? input.totalSpendBrl / input.totalResults : null;
  const roas =
    input.totalSpendBrl > 0 && input.totalAttributedValueBrl > 0
      ? input.totalAttributedValueBrl / input.totalSpendBrl
      : null;

  const kpis = { cpa, roas };
  const alerts: InsightAlert[] = [];
  const pfx = channelTitlePrefix(opts?.channel);
  const ch = opts?.channel;

  if (!panel.alertsEnabled) {
    return { kpis, alerts };
  }

  const minR = goals.minResultsForCpa;
  const minSpend = goals.minSpendForAlertsBrl;

  const spendOk = minSpend == null || input.totalSpendBrl >= minSpend;
  const resultsOkForCpa = input.totalResults >= minR;

  const hasCpaRules =
    (goals.maxCpaBrl != null && panel.alertCpaAboveMax) ||
    (goals.targetCpaBrl != null && panel.alertCpaAboveTarget);

  if (hasCpaRules && !resultsOkForCpa && (goals.targetCpaBrl != null || goals.maxCpaBrl != null)) {
    alerts.push({
      severity: "info",
      code: "CPA_INSUFFICIENT_DATA",
      title: `${pfx}Poucos resultados para CPA`,
      message: `Há ${input.totalResults} resultado(s) no período; mínimo de ${minR} para avaliar o CPA (${periodLabel}).`,
      ...alertCh(ch),
    });
  }

  if (hasCpaRules && minSpend != null && !spendOk) {
    alerts.push({
      severity: "info",
      code: "SPEND_BELOW_ALERT_THRESHOLD",
      title: `${pfx}Gasto abaixo do mínimo para alertas`,
      message: `Investimento ${formatMoney(input.totalSpendBrl)} abaixo do mínimo ${formatMoney(minSpend)} (${periodLabel}).`,
      ...alertCh(ch),
    });
  }

  const canEvaluateCpa = resultsOkForCpa && spendOk && cpa != null;
  const canEvaluateRoas = spendOk && roas != null && input.totalAttributedValueBrl > 0;

  if (canEvaluateCpa && goals.maxCpaBrl != null && panel.alertCpaAboveMax && cpa > goals.maxCpaBrl) {
    alerts.push({
      severity: "critical",
      code: "CPA_ABOVE_MAX",
      title: `${pfx}CPA acima do máximo`,
      message: `CPA ${formatMoney(cpa)} acima do teto ${formatMoney(goals.maxCpaBrl)} (${periodLabel}).`,
      ...alertCh(ch),
    });
  }

  if (
    canEvaluateCpa &&
    goals.targetCpaBrl != null &&
    panel.alertCpaAboveTarget &&
    cpa > goals.targetCpaBrl &&
    !(goals.maxCpaBrl != null && cpa > goals.maxCpaBrl && panel.alertCpaAboveMax)
  ) {
    alerts.push({
      severity: "warning",
      code: "CPA_ABOVE_TARGET",
      title: `${pfx}CPA acima da meta`,
      message: `CPA ${formatMoney(cpa)} acima da meta ${formatMoney(goals.targetCpaBrl)} (${periodLabel}).`,
      ...alertCh(ch),
    });
  }

  if (
    canEvaluateCpa &&
    goals.targetCpaBrl != null &&
    goals.maxCpaBrl != null &&
    goals.targetCpaBrl > goals.maxCpaBrl
  ) {
    alerts.push({
      severity: "info",
      code: "CPA_CONFIG_INCONSISTENT",
      title: `${pfx}Ajuste as metas de CPA`,
      message: "O CPA alvo está acima do CPA máximo configurado.",
      ...alertCh(ch),
    });
  }

  if (canEvaluateRoas && goals.targetRoas != null && panel.alertRoasBelowTarget && roas < goals.targetRoas) {
    alerts.push({
      severity: "warning",
      code: "ROAS_BELOW_TARGET",
      title: `${pfx}ROAS abaixo da meta`,
      message: `ROAS ${roas.toFixed(2)}x abaixo da meta ${Number(goals.targetRoas).toFixed(2)}x (${periodLabel}).`,
      ...alertCh(ch),
    });
  }

  if (
    opts?.channel &&
    opts.settingsRow &&
    canEvaluateCpa &&
    cpa != null &&
    goals.targetCpaBrl != null &&
    cpa < goals.targetCpaBrl * 0.85 &&
    resolveWhatsappAlerts(opts.settingsRow, opts.channel).scaleOpportunity
  ) {
    alerts.push({
      severity: "info",
      code: "READY_TO_SCALE",
      title: `${pfx}Oportunidade de escala`,
      message: `CPA ${formatMoney(cpa)} bem abaixo da meta ${formatMoney(goals.targetCpaBrl)} (${periodLabel}).`,
      ...alertCh(ch),
    });
  }

  const hasBad = alerts.some((a) => a.severity === "critical" || a.severity === "warning");
  const hasAnyTarget =
    goals.targetCpaBrl != null || goals.maxCpaBrl != null || goals.targetRoas != null;

  if (!hasBad && hasAnyTarget && input.totalSpendBrl > 0) {
    let cpaOk = true;
    if (goals.targetCpaBrl != null || goals.maxCpaBrl != null) {
      cpaOk =
        canEvaluateCpa &&
        cpa != null &&
        (goals.maxCpaBrl == null || cpa <= goals.maxCpaBrl) &&
        (goals.targetCpaBrl == null || cpa <= goals.targetCpaBrl);
    }
    let roasOk = true;
    if (goals.targetRoas != null) {
      roasOk = canEvaluateRoas && roas != null && roas >= goals.targetRoas;
    }
    if (cpaOk && roasOk) {
      alerts.push({
        severity: "success",
        code: "PERFORMANCE_ON_TRACK",
        title: `${pfx}Dentro das metas`,
        message:
          cpa != null && canEvaluateCpa
            ? `CPA ${formatMoney(cpa)}${roas != null ? ` · ROAS ${roas.toFixed(2)}x` : ""} (${periodLabel}).`
            : roas != null
              ? `ROAS ${roas.toFixed(2)}x (${periodLabel}).`
              : `Indicadores conferem com suas metas (${periodLabel}).`,
        ...alertCh(ch),
      });
    }
  }

  return { kpis, alerts };
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
  const { kpis, alerts } = computePerformanceAlerts(
    panelFromDto(settings),
    goalsFromDto(settings),
    input,
    periodLabel
  );
  return { kpis, alerts, periodLabel };
}

export type ChannelTotalsInput = {
  totalSpendBrl: number;
  totalResults: number;
  totalAttributedValueBrl: number;
  totalImpressions?: number;
  totalClicks?: number;
};

export async function evaluateInsightsForOrganization(
  organizationId: string,
  input: {
    period: string;
    periodLabel?: string | null;
    totalSpendBrl: number;
    totalResults: number;
    totalAttributedValueBrl: number;
    totalImpressions?: number;
    totalClicks?: number;
    persistOccurrences?: boolean;
    channels?: Partial<Record<ChannelKey, ChannelTotalsInput>>;
  }
) {
  const row = await prisma.marketingSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
  const settings = toDto(row);
  const custom = input.periodLabel?.trim();
  const periodLabel =
    custom && custom.length > 0 ? custom : (periodLabels[input.period] ?? "período selecionado");
  const persist = input.persistOccurrences !== false;
  const chIn = input.channels;
  const hasChannelSlice = Boolean(chIn?.meta !== undefined || chIn?.google !== undefined);

  if (!hasChannelSlice) {
    const { kpis, alerts, periodLabel: pl } = evaluatePerformanceInsights(settings, input);
    await appendCustomRuleAlerts(
      organizationId,
      {
        periodLabel: pl,
        totalSpendBrl: input.totalSpendBrl,
        totalResults: input.totalResults,
        totalAttributedValueBrl: input.totalAttributedValueBrl,
        totalImpressions: input.totalImpressions,
        totalClicks: input.totalClicks,
        cpa: kpis.cpa,
        roas: kpis.roas,
      },
      alerts,
      { persistOccurrences: persist, evaluatingChannel: "blended" }
    );
    return { kpis, alerts, periodLabel: pl };
  }

  const panel = panelFromDto(settings);
  const alerts: InsightAlert[] = [];
  const kpisByChannel: Partial<Record<ChannelKey, { cpa: number | null; roas: number | null }>> = {};

  for (const channel of ["meta", "google"] as const) {
    const slice = chIn?.[channel];
    if (!slice) continue;
    const { kpis: k, alerts: part } = computePerformanceAlerts(
      panel,
      resolveChannelGoals(row, channel),
      {
        period: input.period,
        periodLabel: input.periodLabel,
        totalSpendBrl: slice.totalSpendBrl,
        totalResults: slice.totalResults,
        totalAttributedValueBrl: slice.totalAttributedValueBrl,
      },
      periodLabel,
      { channel, settingsRow: row }
    );
    alerts.push(...part);
    kpisByChannel[channel] = k;
    await appendCustomRuleAlerts(
      organizationId,
      {
        periodLabel,
        totalSpendBrl: slice.totalSpendBrl,
        totalResults: slice.totalResults,
        totalAttributedValueBrl: slice.totalAttributedValueBrl,
        totalImpressions: slice.totalImpressions,
        totalClicks: slice.totalClicks,
        cpa: k.cpa,
        roas: k.roas,
      },
      alerts,
      { persistOccurrences: persist, evaluatingChannel: channel }
    );
  }

  const blendedCpa =
    input.totalResults > 0 ? input.totalSpendBrl / input.totalResults : null;
  const blendedRoas =
    input.totalSpendBrl > 0 && input.totalAttributedValueBrl > 0
      ? input.totalAttributedValueBrl / input.totalSpendBrl
      : null;
  const kpis = { cpa: blendedCpa, roas: blendedRoas };

  return {
    kpis,
    kpisByChannel,
    alerts,
    periodLabel,
  };
}

function whatsappAllowsAlert(
  row: MarketingSettings,
  alert: InsightAlert,
  ruleNotifyMap: Map<string, boolean>
): boolean {
  if (alert.severity !== "critical" && alert.severity !== "warning") return false;
  if (alert.code.startsWith("CUSTOM_RULE:")) {
    const id = alert.code.slice("CUSTOM_RULE:".length);
    if (ruleNotifyMap.has(id)) return ruleNotifyMap.get(id) === true;
    return true;
  }

  if (!alert.channel) {
    if (alert.code === "CPA_ABOVE_MAX") return row.alertCpaAboveMax;
    if (alert.code === "CPA_ABOVE_TARGET") return row.alertCpaAboveTarget;
    if (alert.code === "ROAS_BELOW_TARGET") return row.alertRoasBelowTarget;
    return false;
  }

  const w = resolveWhatsappAlerts(row, alert.channel);
  if (alert.code === "CPA_ABOVE_MAX") return w.cplAboveMax;
  if (alert.code === "CPA_ABOVE_TARGET") return w.cplAboveTarget;
  if (alert.code === "ROAS_BELOW_TARGET") return w.roasBelowMin;
  if (alert.code === "CPA_INSUFFICIENT_DATA" || alert.code === "SPEND_BELOW_ALERT_THRESHOLD") {
    return w.minSpendNoResults;
  }
  return false;
}

function whatsappMuted(row: MarketingSettings, alert: InsightAlert): boolean {
  if (!alert.channel) return false;
  const w = resolveWhatsappAlerts(row, alert.channel);
  return isUtcHourMuted(w.muteStartHourUtc, w.muteEndHourUtc);
}

function alertDestinationPhone(row: MarketingSettings, alert: InsightAlert): string | null {
  if (!alert.channel) {
    return normalizeAtivaCrmPhone(row.ativaCrmNotifyPhone);
  }
  const w = resolveWhatsappAlerts(row, alert.channel);
  const raw = w.useIntegrationPhone ? row.ativaCrmNotifyPhone : w.overridePhone;
  return normalizeAtivaCrmPhone(raw);
}

/**
 * Envia alertas críticos/aviso por WhatsApp (Ativa CRM).
 * Usa transação + dedupe por código de alerta para evitar rajadas e corridas paralelas.
 */
export async function maybeSendAtivaCrmAlerts(
  organizationId: string,
  result: { alerts: InsightAlert[]; periodLabel: string }
): Promise<void> {
  type TxOut = {
    row: MarketingSettings;
    passed: InsightAlert[];
    token: string;
    templates: Record<string, string>;
  };

  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT 1 FROM "MarketingSettings"
      WHERE "organizationId" = ${organizationId}
      FOR UPDATE
    `;

    const row = await tx.marketingSettings.findUnique({ where: { organizationId } });
    if (!row?.ativaCrmAlertsEnabled) return null;
    const token = row.ativaCrmApiToken?.trim();
    if (!token) return null;

    const ruleNotifyMap = await loadRuleNotifyWhatsappMapTx(tx, organizationId);

    const cooldownMs =
      (row.whatsappAlertCooldownMinutes != null && row.whatsappAlertCooldownMinutes > 0
        ? row.whatsappAlertCooldownMinutes
        : 360) *
      60 *
      1000;

    const candidates = result.alerts.filter(
      (a) =>
        (a.severity === "critical" || a.severity === "warning") &&
        whatsappAllowsAlert(row, a, ruleNotifyMap) &&
        !whatsappMuted(row, a)
    );
    if (candidates.length === 0) return null;

    const lastMap = parseLastOutboundByCodeJson(row.whatsappLastOutboundByCode);
    const now = Date.now();
    const passed = candidates.filter((a) => {
      const key = alertWhatsappDedupeKey(a);
      const lastIso = lastMap[key];
      if (!lastIso) return true;
      const t = new Date(lastIso).getTime();
      return Number.isFinite(t) && now - t >= cooldownMs;
    });
    if (passed.length === 0) return null;

    const nextMap = { ...lastMap };
    for (const a of passed) {
      nextMap[alertWhatsappDedupeKey(a)] = new Date().toISOString();
    }

    await tx.marketingSettings.update({
      where: { organizationId },
      data: {
        whatsappLastOutboundByCode: nextMap,
        lastAtivaCrmAlertSentAt: new Date(),
      },
    });

    const templates = parseMessageTemplatesJson(row.whatsappMessageTemplates);
    return { row, passed, token, templates } satisfies TxOut;
  });

  if (!outcome) return;

  const byPhone = new Map<string, InsightAlert[]>();
  for (const a of outcome.passed) {
    const phone = alertDestinationPhone(outcome.row, a);
    if (!phone) continue;
    const list = byPhone.get(phone) ?? [];
    list.push(a);
    byPhone.set(phone, list);
  }
  if (byPhone.size === 0) return;

  for (const [phone, list] of byPhone) {
    const header = `*Ativa Dash* — Alertas (${result.periodLabel})\n\n`;
    const body =
      header +
      list.map((a) => formatWhatsappAlertLine(outcome.templates, a, result.periodLabel)).join("\n\n");
    const sent = await sendAtivaCrmTextMessage(outcome.token, phone, body);
    if (!sent.ok) {
      console.error("[Ativa CRM] Falha ao enviar alerta:", sent.error);
    }
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
  if (sent.ok) {
    await prisma.marketingSettings.update({
      where: { organizationId },
      data: { lastAtivaCrmTestSentAt: new Date() },
    });
    return { ok: true };
  }
  return { ok: false, message: sent.error };
}
