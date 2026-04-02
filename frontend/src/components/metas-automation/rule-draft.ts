import type {
  AlertRuleActionType,
  AlertRuleCheckFrequency,
  AlertRuleDto,
  AlertRuleEvaluationLevel,
  AlertRuleMetric,
  AlertRuleOperator,
  AlertRuleRoutingDto,
  AlertRuleSeverity,
  AlertRuleThresholdRef,
} from "@/lib/alert-rules-api";

export const METRIC_OPTIONS: { value: AlertRuleMetric; label: string }[] = [
  { value: "cpa", label: "CPL" },
  { value: "roas", label: "ROAS" },
  { value: "spend", label: "Gasto (período)" },
  { value: "daily_spend", label: "Gasto diário (estimado)" },
  { value: "ctr", label: "CTR" },
];

export const THRESHOLD_REF_LABEL: Record<AlertRuleThresholdRef, string> = {
  VAR_CHANNEL_MAX_CPA: "Variável: teto de CPA do canal (metas globais)",
  VAR_CHANNEL_TARGET_ROAS: "Variável: meta de ROAS do canal",
  VAR_BLENDED_DAILY_BUDGET_MAX: "Variável: orçamento máx. diário (Meta + Google)",
};

export const OPERATOR_OPTIONS: { value: AlertRuleOperator; label: string; hint?: string }[] = [
  { value: "gt", label: "Maior que" },
  { value: "lt", label: "Menor que" },
  { value: "outside_target", label: "Fora da meta" },
  {
    value: "cpa_band",
    label: "Entre meta e teto (CPL)",
    hint: "Só métrica CPL: alvo < CPA < teto nas metas do canal",
  },
];

export const LEVEL_OPTIONS: { value: AlertRuleEvaluationLevel; label: string }[] = [
  { value: "campaign", label: "Campanha" },
  { value: "ad_set", label: "Conjunto" },
  { value: "ad", label: "Anúncio" },
];

export const FREQUENCY_OPTIONS: { value: AlertRuleCheckFrequency; label: string }[] = [
  { value: "1h", label: "A cada 1 hora" },
  { value: "3h", label: "A cada 3 horas" },
  { value: "12h", label: "A cada 12 horas" },
  { value: "daily", label: "Diariamente" },
];

const LEGACY_ACTION_TYPE_MAP: Record<string, AlertRuleActionType> = {
  whatsapp_alert: "NOTIFY_ONLY",
  pause_campaign: "PAUSE_ASSET",
  pause_entity_whatsapp: "PAUSE_ASSET",
  reduce_budget_20_whatsapp: "DECREASE_BUDGET_20",
};

export const VALID_ACTION_TYPES: AlertRuleActionType[] = [
  "NOTIFY_ONLY",
  "PAUSE_ASSET",
  "ACTIVATE_ASSET",
  "INCREASE_BUDGET_20",
  "DECREASE_BUDGET_20",
];

export function normalizeActionType(raw: string): AlertRuleActionType {
  const u = String(raw ?? "").trim();
  const mapped = LEGACY_ACTION_TYPE_MAP[u] ?? u;
  return VALID_ACTION_TYPES.includes(mapped as AlertRuleActionType)
    ? (mapped as AlertRuleActionType)
    : "NOTIFY_ONLY";
}

export const ACTION_OPTIONS: { value: AlertRuleActionType; label: string; hint?: string }[] = [
  { value: "NOTIFY_ONLY", label: "Apenas notificar", hint: "Sem alterar campanhas na mídia" },
  { value: "PAUSE_ASSET", label: "Pausar", hint: "API Meta/Google" },
  { value: "ACTIVATE_ASSET", label: "Ativar", hint: "Reativa entidade em pausa" },
  { value: "INCREASE_BUDGET_20", label: "Aumentar orçamento", hint: "Percentual configurável abaixo" },
  { value: "DECREASE_BUDGET_20", label: "Reduzir orçamento", hint: "Percentual configurável abaixo" },
];

export const MESSAGE_CHIPS: { label: string; insert: string }[] = [
  { label: "[Nome da Campanha]", insert: "{{campaign_name}}" },
  { label: "[Nome do Conjunto]", insert: "{{ad_set_name}}" },
  { label: "[Nome do Anúncio]", insert: "{{ad_name}}" },
  { label: "[Métrica Atual]", insert: "{{metric_value}}" },
  { label: "[Valor da Meta]", insert: "{{goal_value}}" },
  { label: "[Gasto Atual]", insert: "{{spend_current}}" },
  { label: "[ROAS Atual]", insert: "{{roas_current}}" },
  { label: "[Nome da regra]", insert: "{{rule_name}}" },
  { label: "[Período]", insert: "{{period}}" },
];

export type RuleDraft = {
  clientKey: string;
  serverId?: string;
  name: string;
  evaluationLevel: AlertRuleEvaluationLevel;
  metric: AlertRuleMetric;
  operator: AlertRuleOperator;
  thresholdStr: string;
  thresholdRef: AlertRuleThresholdRef | null;
  severity: AlertRuleSeverity;
  active: boolean;
  appliesToChannel: "all" | "meta" | "google";
  notifyWhatsapp: boolean;
  actionType: AlertRuleActionType;
  messageTemplate: string;
  routingJobSlugs: string[];
  routingUserIds: string[];
  routingCustomPhonesStr: string;
  checkFrequency: AlertRuleCheckFrequency;
  actionWindowStartLocal: string;
  actionWindowEndLocal: string;
  /** Percentual 1–90 para escala (string para input). */
  actionValueStr: string;
  /** Cooldown por ativo em minutos. */
  cooldownMinutesStr: string;
  /** Intervalo mínimo do worker em minutos; vazio = herdar só janela legada. */
  checkFrequencyMinutesStr: string;
  /** Silêncio UTC (0–23), vazio = sem mute UTC. */
  muteStartHourStr: string;
  muteEndHourStr: string;
};

const DEFAULT_SCHEDULE = {
  checkFrequency: "1h" as AlertRuleCheckFrequency,
  actionWindowStartLocal: "09:00",
  actionWindowEndLocal: "18:00",
};

/** Defaults para rascunhos gerados por templates (exceto `clientKey` e `name`). */
const ROW_DEFAULTS: Omit<RuleDraft, "clientKey" | "name"> = {
  evaluationLevel: "campaign",
  metric: "cpa",
  operator: "gt",
  thresholdStr: "0",
  thresholdRef: null,
  severity: "warning",
  active: true,
  appliesToChannel: "all",
  notifyWhatsapp: true,
  actionType: "NOTIFY_ONLY",
  messageTemplate: "",
  routingJobSlugs: [],
  routingUserIds: [],
  routingCustomPhonesStr: "",
  actionValueStr: "20",
  cooldownMinutesStr: "1440",
  checkFrequencyMinutesStr: "",
  muteStartHourStr: "",
  muteEndHourStr: "",
  ...DEFAULT_SCHEDULE,
};

export function clientTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
}

function hourToStr(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return "";
  if (h < 0 || h > 23) return "";
  return String(h);
}

function parseOptionalInt(s: string, min: number, max: number): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = parseInt(t, 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function dtoToDraft(d: AlertRuleDto): RuleDraft {
  const refRaw = d.thresholdRef?.trim() ?? "";
  const validRefs: AlertRuleThresholdRef[] = [
    "VAR_CHANNEL_MAX_CPA",
    "VAR_CHANNEL_TARGET_ROAS",
    "VAR_BLENDED_DAILY_BUDGET_MAX",
  ];
  const thresholdRef = validRefs.includes(refRaw as AlertRuleThresholdRef)
    ? (refRaw as AlertRuleThresholdRef)
    : null;
  const validLevels: AlertRuleEvaluationLevel[] = ["campaign", "ad_set", "ad"];
  const evaluationLevel = validLevels.includes(d.evaluationLevel as AlertRuleEvaluationLevel)
    ? (d.evaluationLevel as AlertRuleEvaluationLevel)
    : "campaign";
  const validFreq: AlertRuleCheckFrequency[] = ["1h", "3h", "12h", "daily"];
  const checkFrequency = validFreq.includes(d.checkFrequency as AlertRuleCheckFrequency)
    ? (d.checkFrequency as AlertRuleCheckFrequency)
    : "1h";
  const rawStart = d.actionWindowStartLocal?.trim() ?? "";
  const rawEnd = d.actionWindowEndLocal?.trim() ?? "";
  const legacyEval = d.evaluationTimeLocal?.trim() ?? "";
  let actionWindowStartLocal = rawStart;
  let actionWindowEndLocal = rawEnd;
  if (!rawStart && !rawEnd && legacyEval) {
    actionWindowStartLocal = legacyEval;
    actionWindowEndLocal = "18:00";
  }
  const av =
    d.actionValue != null && Number.isFinite(Number(d.actionValue)) ? String(Number(d.actionValue)) : "20";
  const cd =
    d.cooldownMinutes != null && Number.isFinite(d.cooldownMinutes) ? String(d.cooldownMinutes) : "1440";
  const cfm =
    d.checkFrequencyMinutes != null && Number.isFinite(d.checkFrequencyMinutes)
      ? String(d.checkFrequencyMinutes)
      : "";
  return {
    clientKey: d.id,
    serverId: d.id,
    name: d.name,
    evaluationLevel,
    metric: (METRIC_OPTIONS.some((m) => m.value === d.metric) ? d.metric : "cpa") as AlertRuleMetric,
    operator: (OPERATOR_OPTIONS.some((o) => o.value === d.operator)
      ? d.operator
      : "gt") as AlertRuleOperator,
    thresholdStr:
      d.operator === "outside_target" || d.operator === "cpa_band" ? "" : String(d.threshold),
    thresholdRef,
    severity: d.severity === "critical" ? "critical" : "warning",
    active: d.active,
    appliesToChannel:
      d.appliesToChannel === "meta" || d.appliesToChannel === "google" ? d.appliesToChannel : "all",
    notifyWhatsapp: d.notifyWhatsapp !== false,
    actionType: normalizeActionType(d.actionType ?? "NOTIFY_ONLY"),
    messageTemplate: d.messageTemplate ?? "",
    routingJobSlugs: [...(d.routing?.jobTitleSlugs ?? [])],
    routingUserIds: [...(d.routing?.userIds ?? [])],
    routingCustomPhonesStr: (d.routing?.customPhones ?? []).join(", "),
    checkFrequency,
    actionWindowStartLocal,
    actionWindowEndLocal,
    actionValueStr: av,
    cooldownMinutesStr: cd,
    checkFrequencyMinutesStr: cfm,
    muteStartHourStr: hourToStr(d.muteStartHour),
    muteEndHourStr: hourToStr(d.muteEndHour),
  };
}

export function newDraft(channel: "meta" | "google"): RuleDraft {
  return {
    clientKey: crypto.randomUUID(),
    name: channel === "meta" ? "Nova regra Meta Ads" : "Nova regra Google Ads",
    evaluationLevel: "campaign",
    metric: channel === "meta" ? "cpa" : "roas",
    operator: channel === "meta" ? "gt" : "lt",
    thresholdStr: "50",
    thresholdRef: null,
    severity: "warning",
    active: true,
    appliesToChannel: channel,
    notifyWhatsapp: true,
    actionType: "NOTIFY_ONLY",
    messageTemplate:
      "⚠️ {{rule_name}}\nSE [{{campaign_name}}] — {{metric_value}} no período {{period}}. Meta: {{goal_value}}.\nGasto: {{spend_current}} · ROAS: {{roas_current}}",
    routingJobSlugs: [],
    routingUserIds: [],
    routingCustomPhonesStr: "",
    actionValueStr: "20",
    cooldownMinutesStr: "1440",
    checkFrequencyMinutesStr: "",
    muteStartHourStr: "",
    muteEndHourStr: "",
    ...DEFAULT_SCHEDULE,
  };
}

export function buildDefaultAutomationDrafts(): RuleDraft[] {
  const base = (partial: Partial<Omit<RuleDraft, "clientKey">> & { name: string }): RuleDraft => ({
    clientKey: crypto.randomUUID(),
    ...ROW_DEFAULTS,
    ...partial,
  });
  return [
    base({
      name: "Alerta de Teto de CPL (Meta Ads)",
      evaluationLevel: "campaign",
      metric: "cpa",
      operator: "gt",
      thresholdStr: "0",
      thresholdRef: "VAR_CHANNEL_MAX_CPA",
      severity: "critical",
      active: true,
      appliesToChannel: "meta",
      notifyWhatsapp: true,
      actionType: "NOTIFY_ONLY",
      messageTemplate:
        "🚨 *ALERTA ATIVA DASH*\nSE [Campanha] *{{campaign_name}}* — CPL acima do teto Meta.\n• CPL atual: {{metric_value}}\n• Referência: {{goal_value}}\n• {{period}}",
      routingJobSlugs: [],
      routingUserIds: [],
      routingCustomPhonesStr: "",
    }),
    base({
      name: "Alerta de Sangria (Orçamento diário)",
      evaluationLevel: "campaign",
      metric: "daily_spend",
      operator: "gt",
      thresholdStr: "0",
      thresholdRef: "VAR_BLENDED_DAILY_BUDGET_MAX",
      severity: "critical",
      active: true,
      appliesToChannel: "all",
      notifyWhatsapp: true,
      actionType: "NOTIFY_ONLY",
      messageTemplate:
        "🚨 *ALERTA ATIVA DASH — Sangria*\nGasto diário acima do teto *{{goal_value}}*.\n• Gasto hoje: {{metric_value}} ({{spend_current}})\n• {{period}}",
      routingJobSlugs: [],
      routingUserIds: [],
      routingCustomPhonesStr: "",
    }),
    base({
      name: "Alerta de ROAS crítico (Google Ads)",
      evaluationLevel: "campaign",
      metric: "roas",
      operator: "lt",
      thresholdStr: "0",
      thresholdRef: "VAR_CHANNEL_TARGET_ROAS",
      severity: "warning",
      active: true,
      appliesToChannel: "google",
      notifyWhatsapp: true,
      actionType: "NOTIFY_ONLY",
      messageTemplate:
        "🚨 *ALERTA ATIVA DASH*\nSE [Campanha] *{{campaign_name}}* — ROAS abaixo da meta Google.\n• ROAS atual: {{metric_value}} ({{roas_current}})\n• Meta: {{goal_value}}\n• {{period}}",
      routingJobSlugs: [],
      routingUserIds: [],
      routingCustomPhonesStr: "",
    }),
  ];
}

export function optimizationProfileDraftStopLoss(channel: "meta" | "google"): RuleDraft {
  return {
    clientKey: crypto.randomUUID(),
    name: "Proteção de orçamento (Stop-Loss)",
    evaluationLevel: "ad",
    metric: "cpa",
    operator: "gt",
    thresholdStr: "0",
    thresholdRef: "VAR_CHANNEL_MAX_CPA",
    severity: "critical",
    active: true,
    appliesToChannel: channel,
    notifyWhatsapp: true,
    actionType: "PAUSE_ASSET",
    messageTemplate:
      "🔴 *STOP-LOSS — Ativa Dash*\nAnúncio *{{ad_name}}* — CPL {{metric_value}} acima do teto {{goal_value}}.\n{{period}} · {{rule_name}}",
    routingJobSlugs: [],
    routingUserIds: [],
    routingCustomPhonesStr: "",
    actionValueStr: "20",
    cooldownMinutesStr: "1440",
    checkFrequencyMinutesStr: "30",
    muteStartHourStr: "",
    muteEndHourStr: "",
    ...DEFAULT_SCHEDULE,
  };
}

export function optimizationProfileDraftTakeProfit(channel: "meta" | "google"): RuleDraft {
  return {
    clientKey: crypto.randomUUID(),
    name: "Escala agressiva (Take-Profit)",
    evaluationLevel: "campaign",
    metric: "roas",
    operator: "gt",
    thresholdStr: "0",
    thresholdRef: "VAR_CHANNEL_TARGET_ROAS",
    severity: "warning",
    active: true,
    appliesToChannel: channel,
    notifyWhatsapp: true,
    actionType: "INCREASE_BUDGET_20",
    messageTemplate:
      "🟢 *ESCALA — Ativa Dash*\nCampanha *{{campaign_name}}* — ROAS {{metric_value}} acima da meta {{goal_value}}.\n{{period}} · {{rule_name}}",
    routingJobSlugs: [],
    routingUserIds: [],
    routingCustomPhonesStr: "",
    actionValueStr: "20",
    cooldownMinutesStr: "1440",
    checkFrequencyMinutesStr: "60",
    muteStartHourStr: "",
    muteEndHourStr: "",
    ...DEFAULT_SCHEDULE,
  };
}

export function optimizationProfileDraftDesmame(channel: "meta" | "google"): RuleDraft {
  return {
    clientKey: crypto.randomUUID(),
    name: "Desmame de verba",
    evaluationLevel: "campaign",
    metric: "cpa",
    operator: "cpa_band",
    thresholdStr: "",
    thresholdRef: null,
    severity: "warning",
    active: true,
    appliesToChannel: channel,
    notifyWhatsapp: true,
    actionType: "DECREASE_BUDGET_20",
    messageTemplate:
      "🟠 *DESNAME — Ativa Dash*\nCampanha *{{campaign_name}}* — CPL {{metric_value}} acima do alvo.\n{{period}} · {{rule_name}}",
    routingJobSlugs: [],
    routingUserIds: [],
    routingCustomPhonesStr: "",
    actionValueStr: "20",
    cooldownMinutesStr: "1440",
    checkFrequencyMinutesStr: "60",
    muteStartHourStr: "",
    muteEndHourStr: "",
    ...DEFAULT_SCHEDULE,
  };
}

export function buildRouting(d: RuleDraft): AlertRuleRoutingDto | null {
  const jobTitleSlugs = d.routingJobSlugs.filter(Boolean);
  const userIds = d.routingUserIds.filter(Boolean);
  const customPhones = d.routingCustomPhonesStr
    .split(/[;,]/)
    .map((x) => x.replace(/\D/g, ""))
    .filter((x) => x.length >= 8);
  if (!jobTitleSlugs.length && !userIds.length && !customPhones.length) return null;
  return { jobTitleSlugs, userIds, customPhones };
}

export function draftToPayload(d: RuleDraft, tz: string) {
  const threshold =
    d.operator === "outside_target" || d.operator === "cpa_band"
      ? 0
      : d.thresholdRef
        ? 0
        : (() => {
            const n = Number(String(d.thresholdStr).replace(",", "."));
            return Number.isFinite(n) ? n : 0;
          })();
  const winStart = d.actionWindowStartLocal.trim();
  const winEnd = d.actionWindowEndLocal.trim();
  const hasWindow = Boolean(winStart && winEnd);
  const actionPct = Math.min(90, Math.max(1, Number(d.actionValueStr.replace(",", ".")) || 20));
  const cooldownMin = Math.min(10080, Math.max(5, parseInt(d.cooldownMinutesStr, 10) || 1440));
  const cfmRaw = d.checkFrequencyMinutesStr.trim();
  const checkFrequencyMinutes =
    cfmRaw === "" ? null : Math.min(10080, Math.max(5, parseInt(cfmRaw, 10) || 0)) || null;
  const ms = parseOptionalInt(d.muteStartHourStr, 0, 23);
  const me = parseOptionalInt(d.muteEndHourStr, 0, 23);
  return {
    name: d.name.trim() || "Automação",
    metric: d.metric,
    operator: d.operator,
    threshold,
    thresholdRef: d.thresholdRef,
    severity: d.severity,
    active: d.active,
    appliesToChannel: d.appliesToChannel,
    notifyWhatsapp: d.notifyWhatsapp,
    actionType: d.actionType,
    evaluationLevel: d.evaluationLevel,
    checkFrequency: d.checkFrequency,
    actionWindowStartLocal: winStart || null,
    actionWindowEndLocal: winEnd || null,
    messageTemplate: d.messageTemplate.trim() || null,
    routing: buildRouting(d),
    evaluationTimeLocal: null,
    evaluationTimezone: hasWindow ? tz : null,
    muteStartHour: ms,
    muteEndHour: me,
    actionValue: actionPct,
    cooldownMinutes: cooldownMin,
    checkFrequencyMinutes,
  };
}

export function insertIntoTextarea(
  el: HTMLTextAreaElement | null,
  value: string,
  chunk: string,
  onChange: (v: string) => void
) {
  if (!el) {
    onChange(value + chunk);
    return;
  }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const next = value.slice(0, start) + chunk + value.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + chunk.length;
    el.setSelectionRange(pos, pos);
  });
}

export function formatRuleCardSummary(r: RuleDraft): string {
  const ch =
    r.appliesToChannel === "meta" ? "Meta" : r.appliesToChannel === "google" ? "Google" : "Todos";
  const metric = METRIC_OPTIONS.find((m) => m.value === r.metric)?.label ?? r.metric;
  const opLab = OPERATOR_OPTIONS.find((o) => o.value === r.operator)?.label ?? r.operator;
  const thr =
    r.operator === "outside_target"
      ? "(fora da meta)"
      : r.operator === "cpa_band"
        ? "(faixa CPL)"
        : r.thresholdRef
          ? "var. metas"
          : r.metric === "roas"
            ? `${r.thresholdStr || "—"} (ROAS)`
            : r.metric === "ctr"
              ? `${r.thresholdStr || "—"}%`
              : `R$ ${r.thresholdStr || "—"}`;
  const act = ACTION_OPTIONS.find((a) => a.value === r.actionType)?.label ?? r.actionType;
  const cdH = Math.max(1, Math.round((parseInt(r.cooldownMinutesStr, 10) || 1440) / 60));
  return `[${ch}] SE ${metric} ${opLab} ${thr} → ${act} · Cooldown ${cdH}h`;
}
