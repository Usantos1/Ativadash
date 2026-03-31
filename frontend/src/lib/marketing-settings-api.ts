import { api } from "./api";

/** Dispare após salvar/testar Ativa CRM para atualizar Metas e alertas (outras abas / mesma sessão). */
export const MARKETING_SETTINGS_REFRESH_EVENT = "ativadash:marketing-settings-refresh";

export function dispatchMarketingSettingsRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MARKETING_SETTINGS_REFRESH_EVENT));
}

export type BusinessGoalMode = "LEADS" | "SALES" | "HYBRID";

export type AdsChannelKey = "meta" | "google";

export type ChannelGoalsDto = {
  targetCpaBrl: number | null;
  maxCpaBrl: number | null;
  targetRoas: number | null;
  minSpendForAlertsBrl: number | null;
  minResultsForCpa: number;
};

export type ChannelAutomationsDto = {
  pauseIfCplAboveMax: boolean;
  pauseIfCplAboveMaxMinResults: number | null;
  reduceBudgetIfCplAboveTarget: boolean;
  reduceBudgetPercent: number | null;
  increaseBudgetIfCplBelowTarget: boolean;
  increaseBudgetPercent: number | null;
  flagScaleIfCplGood: boolean;
  flagReviewSpendUpConvDown: boolean;
};

export type ChannelWhatsappAlertsDto = {
  cplAboveMax: boolean;
  cplAboveTarget: boolean;
  roasBelowMin: boolean;
  minSpendNoResults: boolean;
  scaleOpportunity: boolean;
  sharpPerformanceDrop: boolean;
  clearAdjustmentOpportunity: boolean;
  useIntegrationPhone: boolean;
  overridePhone: string | null;
  muteStartHourUtc: number | null;
  muteEndHourUtc: number | null;
};

export type MarketingSettingsDto = {
  businessGoalMode: BusinessGoalMode;
  primaryConversionLabel: string | null;
  showRevenueBlocksInLeadMode: boolean;
  targetCpaBrl: number | null;
  maxCpaBrl: number | null;
  targetRoas: number | null;
  minResultsForCpa: number;
  minSpendForAlertsBrl: number | null;
  dailyBudgetExpectedBrl: number | null;
  alertsEnabled: boolean;
  alertCpaAboveMax: boolean;
  alertCpaAboveTarget: boolean;
  alertRoasBelowTarget: boolean;
  ativaCrmTokenConfigured: boolean;
  ativaCrmNotifyPhone: string | null;
  ativaCrmAlertsEnabled: boolean;
  /** Mesma regra que `ativaCrmHub.connected` em GET /integrations */
  ativaCrmHubConnected: boolean;
  /** ISO — último alerta automático WhatsApp enviado com sucesso */
  ativaCrmLastAlertSentAt: string | null;
  /** ISO — último teste de mensagem com sucesso */
  ativaCrmLastTestSentAt: string | null;
  goalsMeta: ChannelGoalsDto;
  goalsGoogle: ChannelGoalsDto;
  automationsMeta: ChannelAutomationsDto;
  automationsGoogle: ChannelAutomationsDto;
  whatsappAlertsMeta: ChannelWhatsappAlertsDto;
  whatsappAlertsGoogle: ChannelWhatsappAlertsDto;
  whatsappAlertCooldownMinutes: number | null;
  whatsappMessageTemplates: Record<string, string>;
  whatsappDigestSchedule: {
    enabled: boolean;
    hourUtc: number;
    minuteUtc: number;
    hourLocal: number;
    minuteLocal: number;
    timezone: string;
    extraPhones: string[];
  };
};

export type InsightAlert = {
  severity: "critical" | "warning" | "info" | "success";
  code: string;
  title: string;
  message: string;
  channel?: AdsChannelKey;
};

export type EvaluateInsightsResponse = {
  kpis: { cpa: number | null; roas: number | null };
  kpisByChannel?: Partial<Record<AdsChannelKey, { cpa: number | null; roas: number | null }>>;
  alerts: InsightAlert[];
  periodLabel: string;
};

function defaultAutomationsDto(): ChannelAutomationsDto {
  return {
    pauseIfCplAboveMax: false,
    pauseIfCplAboveMaxMinResults: null,
    reduceBudgetIfCplAboveTarget: false,
    reduceBudgetPercent: null,
    increaseBudgetIfCplBelowTarget: false,
    increaseBudgetPercent: null,
    flagScaleIfCplGood: false,
    flagReviewSpendUpConvDown: false,
  };
}

function defaultWhatsappFromLegacy(r: {
  alertCpaAboveMax?: boolean;
  alertCpaAboveTarget?: boolean;
  alertRoasBelowTarget?: boolean;
}): ChannelWhatsappAlertsDto {
  return {
    cplAboveMax: r.alertCpaAboveMax !== false,
    cplAboveTarget: r.alertCpaAboveTarget !== false,
    roasBelowMin: r.alertRoasBelowTarget !== false,
    minSpendNoResults: true,
    scaleOpportunity: false,
    sharpPerformanceDrop: false,
    clearAdjustmentOpportunity: false,
    useIntegrationPhone: true,
    overridePhone: null,
    muteStartHourUtc: null,
    muteEndHourUtc: null,
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseChannelGoalsJson(input: unknown, legacy: ChannelGoalsDto): ChannelGoalsDto {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ...legacy };
  const o = input as Record<string, unknown>;
  const minRaw = o.minResultsForCpa;
  let minResults = legacy.minResultsForCpa;
  if (typeof minRaw === "number" && Number.isFinite(minRaw)) {
    minResults = Math.min(500, Math.max(1, Math.trunc(minRaw)));
  }
  return {
    targetCpaBrl: "targetCpaBrl" in o ? numOrNull(o.targetCpaBrl) : legacy.targetCpaBrl,
    maxCpaBrl: "maxCpaBrl" in o ? numOrNull(o.maxCpaBrl) : legacy.maxCpaBrl,
    targetRoas: "targetRoas" in o ? numOrNull(o.targetRoas) : legacy.targetRoas,
    minSpendForAlertsBrl:
      "minSpendForAlertsBrl" in o ? numOrNull(o.minSpendForAlertsBrl) : legacy.minSpendForAlertsBrl,
    minResultsForCpa: minResults,
  };
}

function parseAutomationsJson(input: unknown): ChannelAutomationsDto {
  const d = defaultAutomationsDto();
  if (!input || typeof input !== "object" || Array.isArray(input)) return d;
  const o = input as Record<string, unknown>;
  return {
    pauseIfCplAboveMax: Boolean(o.pauseIfCplAboveMax),
    pauseIfCplAboveMaxMinResults:
      o.pauseIfCplAboveMaxMinResults == null
        ? null
        : (() => {
            const n = Math.trunc(Number(o.pauseIfCplAboveMaxMinResults));
            return Number.isFinite(n) && n >= 1 ? Math.min(5000, n) : null;
          })(),
    reduceBudgetIfCplAboveTarget: Boolean(o.reduceBudgetIfCplAboveTarget),
    reduceBudgetPercent: numOrNull(o.reduceBudgetPercent),
    increaseBudgetIfCplBelowTarget: Boolean(o.increaseBudgetIfCplBelowTarget),
    increaseBudgetPercent: numOrNull(o.increaseBudgetPercent),
    flagScaleIfCplGood: Boolean(o.flagScaleIfCplGood),
    flagReviewSpendUpConvDown: Boolean(o.flagReviewSpendUpConvDown),
  };
}

function parseOptionalUtcHour(v: unknown, fb: number | null): number | null {
  if (v === undefined) return fb;
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return fb;
  return Math.min(23, Math.max(0, Math.trunc(n)));
}

function parseTemplatesRecordClient(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k === "string" && k.length <= 80 && typeof v === "string" && v.length <= 2000) {
      out[k] = v;
    }
  }
  return out;
}

function parseDigestScheduleClient(json: unknown): MarketingSettingsDto["whatsappDigestSchedule"] {
  const fb = {
    enabled: false,
    hourUtc: 9,
    minuteUtc: 0,
    hourLocal: 9,
    minuteLocal: 0,
    timezone: "America/Sao_Paulo",
    extraPhones: [] as string[],
  };
  if (json == null || typeof json !== "object" || Array.isArray(json)) return fb;
  const o = json as Record<string, unknown>;
  const phones = o.extraPhones;
  const tz =
    typeof o.timezone === "string" && o.timezone.trim() ? String(o.timezone).trim() : fb.timezone;
  const hourUtc = Math.min(23, Math.max(0, Math.trunc(Number(o.hourUtc)) || 9));
  const minuteUtc = Math.min(59, Math.max(0, Math.trunc(Number(o.minuteUtc)) || 0));
  const hl = o.hourLocal;
  const ml = o.minuteLocal;
  const hourLocal =
    typeof hl === "number" && Number.isFinite(hl) ? Math.min(23, Math.max(0, Math.trunc(hl))) : hourUtc;
  const minuteLocal =
    typeof ml === "number" && Number.isFinite(ml) ? Math.min(59, Math.max(0, Math.trunc(ml))) : minuteUtc;
  return {
    enabled: Boolean(o.enabled),
    hourUtc,
    minuteUtc,
    hourLocal,
    minuteLocal,
    timezone: tz,
    extraPhones: Array.isArray(phones)
      ? phones.map((p) => String(p).trim()).filter(Boolean).slice(0, 5)
      : [],
  };
}

function parseWhatsappJson(input: unknown, fb: ChannelWhatsappAlertsDto): ChannelWhatsappAlertsDto {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ...fb };
  const o = input as Record<string, unknown>;
  const b = (k: keyof ChannelWhatsappAlertsDto, def: boolean) =>
    o[k] !== undefined ? Boolean(o[k]) : def;
  return {
    cplAboveMax: b("cplAboveMax", fb.cplAboveMax),
    cplAboveTarget: b("cplAboveTarget", fb.cplAboveTarget),
    roasBelowMin: b("roasBelowMin", fb.roasBelowMin),
    minSpendNoResults: b("minSpendNoResults", fb.minSpendNoResults),
    scaleOpportunity: b("scaleOpportunity", fb.scaleOpportunity),
    sharpPerformanceDrop: b("sharpPerformanceDrop", fb.sharpPerformanceDrop),
    clearAdjustmentOpportunity: b("clearAdjustmentOpportunity", fb.clearAdjustmentOpportunity),
    useIntegrationPhone: b("useIntegrationPhone", fb.useIntegrationPhone),
    overridePhone:
      o.overridePhone === undefined
        ? fb.overridePhone
        : o.overridePhone === null
          ? null
          : String(o.overridePhone).trim() || null,
    muteStartHourUtc: parseOptionalUtcHour(o.muteStartHourUtc, fb.muteStartHourUtc),
    muteEndHourUtc: parseOptionalUtcHour(o.muteEndHourUtc, fb.muteEndHourUtc),
  };
}

/**
 * Garante DTO completo quando o backend é mais antigo ou a migração ainda não rodou
 * (evita tela branca ao acessar Metas / alertas).
 */
export function normalizeMarketingSettingsDto(raw: unknown): MarketingSettingsDto {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const modeRaw = r.businessGoalMode;
  const businessGoalMode: BusinessGoalMode =
    modeRaw === "LEADS" || modeRaw === "SALES" || modeRaw === "HYBRID" ? modeRaw : "HYBRID";

  const minResultsForCpa =
    typeof r.minResultsForCpa === "number" && Number.isFinite(r.minResultsForCpa)
      ? Math.min(500, Math.max(1, Math.trunc(r.minResultsForCpa)))
      : 5;

  const legacyGoals: ChannelGoalsDto = {
    targetCpaBrl: numOrNull(r.targetCpaBrl),
    maxCpaBrl: numOrNull(r.maxCpaBrl),
    targetRoas: numOrNull(r.targetRoas),
    minSpendForAlertsBrl: numOrNull(r.minSpendForAlertsBrl),
    minResultsForCpa: minResultsForCpa,
  };

  const goalsBy = r.goalsByChannel;
  const goalsMeta =
    goalsBy && typeof goalsBy === "object" && !Array.isArray(goalsBy) && (goalsBy as Record<string, unknown>).meta
      ? parseChannelGoalsJson((goalsBy as Record<string, unknown>).meta, legacyGoals)
      : (r.goalsMeta as ChannelGoalsDto | undefined) && typeof r.goalsMeta === "object"
        ? parseChannelGoalsJson(r.goalsMeta, legacyGoals)
        : { ...legacyGoals };

  const goalsGoogle =
    goalsBy && typeof goalsBy === "object" && !Array.isArray(goalsBy) && (goalsBy as Record<string, unknown>).google
      ? parseChannelGoalsJson((goalsBy as Record<string, unknown>).google, legacyGoals)
      : (r.goalsGoogle as ChannelGoalsDto | undefined) && typeof r.goalsGoogle === "object"
        ? parseChannelGoalsJson(r.goalsGoogle, legacyGoals)
        : { ...legacyGoals };

  const waFb = defaultWhatsappFromLegacy({
    alertCpaAboveMax: r.alertCpaAboveMax !== false,
    alertCpaAboveTarget: r.alertCpaAboveTarget !== false,
    alertRoasBelowTarget: r.alertRoasBelowTarget !== false,
  });

  const autoBy = r.automationsByChannel;
  const automationsMeta =
    autoBy && typeof autoBy === "object" && !Array.isArray(autoBy) && (autoBy as Record<string, unknown>).meta
      ? parseAutomationsJson((autoBy as Record<string, unknown>).meta)
      : r.automationsMeta && typeof r.automationsMeta === "object"
        ? parseAutomationsJson(r.automationsMeta)
        : defaultAutomationsDto();

  const automationsGoogle =
    autoBy && typeof autoBy === "object" && !Array.isArray(autoBy) && (autoBy as Record<string, unknown>).google
      ? parseAutomationsJson((autoBy as Record<string, unknown>).google)
      : r.automationsGoogle && typeof r.automationsGoogle === "object"
        ? parseAutomationsJson(r.automationsGoogle)
        : defaultAutomationsDto();

  const whatsBy = r.whatsappAlertsByChannel;
  const whatsappAlertsMeta =
    whatsBy && typeof whatsBy === "object" && !Array.isArray(whatsBy) && (whatsBy as Record<string, unknown>).meta
      ? parseWhatsappJson((whatsBy as Record<string, unknown>).meta, waFb)
      : r.whatsappAlertsMeta && typeof r.whatsappAlertsMeta === "object"
        ? parseWhatsappJson(r.whatsappAlertsMeta, waFb)
        : { ...waFb };

  const whatsappAlertsGoogle =
    whatsBy && typeof whatsBy === "object" && !Array.isArray(whatsBy) && (whatsBy as Record<string, unknown>).google
      ? parseWhatsappJson((whatsBy as Record<string, unknown>).google, waFb)
      : r.whatsappAlertsGoogle && typeof r.whatsappAlertsGoogle === "object"
        ? parseWhatsappJson(r.whatsappAlertsGoogle, waFb)
        : { ...waFb };

  const tokenConfigured = Boolean(r.ativaCrmTokenConfigured);
  const notifyPhone =
    r.ativaCrmNotifyPhone == null ? null : String(r.ativaCrmNotifyPhone).trim() || null;
  const alertsEnabledCrm = r.ativaCrmAlertsEnabled !== false;
  const hubConnected =
    typeof r.ativaCrmHubConnected === "boolean"
      ? r.ativaCrmHubConnected
      : tokenConfigured && Boolean(notifyPhone?.trim()) && alertsEnabledCrm;

  return {
    businessGoalMode,
    primaryConversionLabel:
      r.primaryConversionLabel == null ? null : String(r.primaryConversionLabel).trim() || null,
    showRevenueBlocksInLeadMode: Boolean(r.showRevenueBlocksInLeadMode),
    targetCpaBrl: legacyGoals.targetCpaBrl,
    maxCpaBrl: legacyGoals.maxCpaBrl,
    targetRoas: legacyGoals.targetRoas,
    minResultsForCpa: minResultsForCpa,
    minSpendForAlertsBrl: legacyGoals.minSpendForAlertsBrl,
    dailyBudgetExpectedBrl: numOrNull(r.dailyBudgetExpectedBrl),
    alertsEnabled: r.alertsEnabled !== false,
    alertCpaAboveMax: r.alertCpaAboveMax !== false,
    alertCpaAboveTarget: r.alertCpaAboveTarget !== false,
    alertRoasBelowTarget: r.alertRoasBelowTarget !== false,
    ativaCrmTokenConfigured: tokenConfigured,
    ativaCrmNotifyPhone: notifyPhone,
    ativaCrmAlertsEnabled: alertsEnabledCrm,
    ativaCrmHubConnected: hubConnected,
    ativaCrmLastAlertSentAt:
      r.ativaCrmLastAlertSentAt == null ? null : String(r.ativaCrmLastAlertSentAt),
    ativaCrmLastTestSentAt:
      r.ativaCrmLastTestSentAt == null ? null : String(r.ativaCrmLastTestSentAt),
    goalsMeta,
    goalsGoogle,
    automationsMeta,
    automationsGoogle,
    whatsappAlertsMeta,
    whatsappAlertsGoogle,
    whatsappAlertCooldownMinutes: (() => {
      if (r.whatsappAlertCooldownMinutes == null) return null;
      const n = Number(r.whatsappAlertCooldownMinutes);
      return Number.isFinite(n) ? n : null;
    })(),
    whatsappMessageTemplates: parseTemplatesRecordClient(r.whatsappMessageTemplates),
    whatsappDigestSchedule: parseDigestScheduleClient(r.whatsappDigestSchedule),
  };
}

export async function fetchMarketingSettings(): Promise<MarketingSettingsDto> {
  const res = await api.get<{ settings: MarketingSettingsDto }>("/marketing/settings");
  return normalizeMarketingSettingsDto(res.settings);
}

export type ChannelGoalsPatch = Partial<{
  targetCpaBrl: number | null;
  maxCpaBrl: number | null;
  targetRoas: number | null;
  minSpendForAlertsBrl: number | null;
  minResultsForCpa: number;
}>;

export type UpdateMarketingSettingsPayload = Partial<{
  businessGoalMode: BusinessGoalMode;
  /** string vazio ou null limpa o rótulo customizado */
  primaryConversionLabel: string | null;
  showRevenueBlocksInLeadMode: boolean;
  targetCpaBrl: number | null;
  maxCpaBrl: number | null;
  targetRoas: number | null;
  minResultsForCpa: number;
  minSpendForAlertsBrl: number | null;
  dailyBudgetExpectedBrl: number | null;
  alertsEnabled: boolean;
  alertCpaAboveMax: boolean;
  alertCpaAboveTarget: boolean;
  alertRoasBelowTarget: boolean;
  /** string = gravar; null = apagar token */
  ativaCrmApiToken: string | null;
  ativaCrmNotifyPhone: string | null;
  ativaCrmAlertsEnabled: boolean;
  goalsByChannel: Partial<Record<AdsChannelKey, ChannelGoalsPatch | null | undefined>>;
  automationsByChannel: Partial<
    Record<AdsChannelKey, Partial<ChannelAutomationsDto> | null | undefined>
  >;
  whatsappAlertsByChannel: Partial<
    Record<AdsChannelKey, Partial<ChannelWhatsappAlertsDto> | null | undefined>
  >;
  whatsappAlertCooldownMinutes: number | null;
  whatsappMessageTemplates: Record<string, string>;
  whatsappDigestSchedule: {
    enabled: boolean;
    hourUtc?: number;
    minuteUtc?: number;
    hourLocal?: number;
    minuteLocal?: number;
    timezone?: string;
    extraPhones: string[];
  };
}>;

export async function saveMarketingSettings(
  payload: UpdateMarketingSettingsPayload
): Promise<MarketingSettingsDto> {
  const res = await api.put<{ settings: MarketingSettingsDto }>("/marketing/settings", payload);
  return normalizeMarketingSettingsDto(res.settings);
}

export async function sendAtivaCrmTestMessage(message?: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await api.post<{ ok: boolean; message: string }>("/marketing/ativacrm/test-message", {
      message: message?.trim() || undefined,
    });
    return { ok: true, message: res.message };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Não foi possível enviar o teste.",
    };
  }
}

export type InsightTotalsPayload = {
  totalSpendBrl: number;
  totalResults: number;
  totalAttributedValueBrl: number;
  totalImpressions?: number;
  totalClicks?: number;
};

export async function evaluateMarketingInsights(
  period: "7d" | "30d" | "90d",
  totals: InsightTotalsPayload,
  periodLabel?: string,
  opts?: {
    persistOccurrences?: boolean;
    channels?: Partial<Record<AdsChannelKey, InsightTotalsPayload>>;
    /** Só use true em ação explícita ou cron — não ao carregar o painel. */
    sendWhatsappAlerts?: boolean;
  }
): Promise<EvaluateInsightsResponse> {
  return api.post<EvaluateInsightsResponse>("/marketing/insights/evaluate", {
    period,
    ...totals,
    ...(periodLabel?.trim() ? { periodLabel: periodLabel.trim() } : {}),
    ...(opts?.persistOccurrences === false ? { persistOccurrences: false } : {}),
    ...(opts?.channels ? { channels: opts.channels } : {}),
    ...(opts?.sendWhatsappAlerts === true ? { sendWhatsappAlerts: true } : {}),
  });
}
