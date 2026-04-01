import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  ChevronRight,
  Loader2,
  MessageCircle,
  PauseCircle,
  Plus,
  Save,
  ScrollText,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeaderPremium } from "@/components/premium";
import {
  dispatchMarketingSettingsRefresh,
  fetchMarketingSettings,
  saveMarketingSettings,
} from "@/lib/marketing-settings-api";
import {
  createAlertRule,
  deleteAlertRule,
  fetchAlertRules,
  fetchAutomationExecutionLogs,
  patchAlertRule,
  type AlertRuleActionType,
  type AlertRuleCheckFrequency,
  type AlertRuleDto,
  type AlertRuleEvaluationLevel,
  type AlertRuleMetric,
  type AlertRuleOperator,
  type AlertRuleRoutingDto,
  type AlertRuleSeverity,
  type AlertRuleThresholdRef,
  type AutomationExecutionLogDto,
} from "@/lib/alert-rules-api";
import { fetchMembers, type MemberRow } from "@/lib/workspace-api";
import { canUserEditMarketingSettings } from "@/lib/marketing-ads-permissions";
import { useAuthStore } from "@/stores/auth-store";
import { TEAM_JOB_TITLE_OPTIONS, jobTitleLabelPt } from "@/lib/team-access-ui";
import { cn } from "@/lib/utils";

const METRIC_OPTIONS: { value: AlertRuleMetric; label: string }[] = [
  { value: "cpa", label: "CPL" },
  { value: "roas", label: "ROAS" },
  { value: "spend", label: "Gasto (período)" },
  { value: "daily_spend", label: "Gasto diário (estimado)" },
  { value: "ctr", label: "CTR" },
];

const THRESHOLD_REF_LABEL: Record<AlertRuleThresholdRef, string> = {
  VAR_CHANNEL_MAX_CPA: "Variável: teto de CPA do canal (metas globais)",
  VAR_CHANNEL_TARGET_ROAS: "Variável: meta de ROAS do canal",
  VAR_BLENDED_DAILY_BUDGET_MAX: "Variável: orçamento máx. diário (Meta + Google)",
};

const OPERATOR_OPTIONS: { value: AlertRuleOperator; label: string }[] = [
  { value: "gt", label: "Maior que" },
  { value: "lt", label: "Menor que" },
  { value: "outside_target", label: "Fora da meta" },
];

const LEVEL_OPTIONS: { value: AlertRuleEvaluationLevel; label: string }[] = [
  { value: "campaign", label: "Campanha" },
  { value: "ad_set", label: "Conjunto" },
  { value: "ad", label: "Anúncio" },
];

const FREQUENCY_OPTIONS: { value: AlertRuleCheckFrequency; label: string }[] = [
  { value: "1h", label: "A cada 1 hora" },
  { value: "3h", label: "A cada 3 horas" },
  { value: "12h", label: "A cada 12 horas" },
  { value: "daily", label: "Diariamente" },
];

/** Valores antigos da API — normalizados para `AutomationActionType`. */
const LEGACY_ACTION_TYPE_MAP: Record<string, AlertRuleActionType> = {
  whatsapp_alert: "NOTIFY_ONLY",
  pause_campaign: "PAUSE_ASSET",
  pause_entity_whatsapp: "PAUSE_ASSET",
  reduce_budget_20_whatsapp: "DECREASE_BUDGET_20",
};

const VALID_ACTION_TYPES: AlertRuleActionType[] = [
  "NOTIFY_ONLY",
  "PAUSE_ASSET",
  "INCREASE_BUDGET_20",
  "DECREASE_BUDGET_20",
];

function normalizeActionType(raw: string): AlertRuleActionType {
  const u = String(raw ?? "").trim();
  const mapped = LEGACY_ACTION_TYPE_MAP[u] ?? u;
  return VALID_ACTION_TYPES.includes(mapped as AlertRuleActionType) ? (mapped as AlertRuleActionType) : "NOTIFY_ONLY";
}

const ACTION_OPTIONS: { value: AlertRuleActionType; label: string; hint?: string }[] = [
  { value: "NOTIFY_ONLY", label: "Apenas notificar", hint: "Alertas sem alterar campanhas na mídia" },
  { value: "PAUSE_ASSET", label: "Pausar", hint: "Execução na API em integração; WhatsApp opcional" },
  { value: "INCREASE_BUDGET_20", label: "Aumentar orçamento (20%)", hint: "Take-profit / escala" },
  { value: "DECREASE_BUDGET_20", label: "Reduzir orçamento (20%)", hint: "Desmame gradual" },
];

const MESSAGE_CHIPS: { label: string; insert: string }[] = [
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

type RuleDraft = {
  clientKey: string;
  serverId?: string;
  name: string;
  /** Nível do SE (campanha / conjunto / anúncio). */
  evaluationLevel: AlertRuleEvaluationLevel;
  metric: AlertRuleMetric;
  operator: AlertRuleOperator;
  thresholdStr: string;
  /** Limiar dinâmico (metas); quando definido, o valor fixo é ignorado na API (usa 0). */
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
};

function clientTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
}

function dtoToDraft(d: AlertRuleDto): RuleDraft {
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
  return {
    clientKey: d.id,
    serverId: d.id,
    name: d.name,
    evaluationLevel,
    metric: (METRIC_OPTIONS.some((m) => m.value === d.metric) ? d.metric : "cpa") as AlertRuleMetric,
    operator: (OPERATOR_OPTIONS.some((o) => o.value === d.operator)
      ? d.operator
      : "gt") as AlertRuleOperator,
    thresholdStr: d.operator === "outside_target" ? "" : String(d.threshold),
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
  };
}

function newDraft(channel: "meta" | "google"): RuleDraft {
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
    checkFrequency: "1h",
    actionWindowStartLocal: "09:00",
    actionWindowEndLocal: "18:00",
  };
}

const DEFAULT_SCHEDULE = {
  checkFrequency: "1h" as AlertRuleCheckFrequency,
  actionWindowStartLocal: "09:00",
  actionWindowEndLocal: "18:00",
};

/** Modelos iniciais quando não há regras salvas (editáveis / removíveis). */
function buildDefaultAutomationDrafts(): RuleDraft[] {
  return [
    {
      clientKey: crypto.randomUUID(),
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
      ...DEFAULT_SCHEDULE,
    },
    {
      clientKey: crypto.randomUUID(),
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
      ...DEFAULT_SCHEDULE,
    },
    {
      clientKey: crypto.randomUUID(),
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
      ...DEFAULT_SCHEDULE,
    },
  ];
}

/** Perfis prontos — alinhados ao canal selecionado na aba Motor. */
function optimizationProfileDraftStopLoss(channel: "meta" | "google"): RuleDraft {
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
    ...DEFAULT_SCHEDULE,
  };
}

function optimizationProfileDraftTakeProfit(channel: "meta" | "google"): RuleDraft {
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
      "🟢 *ESCALA — Ativa Dash*\nCampanha *{{campaign_name}}* — ROAS {{metric_value}} acima da meta {{goal_value}}. Orçamento +20%.\n{{period}} · {{rule_name}}",
    routingJobSlugs: [],
    routingUserIds: [],
    routingCustomPhonesStr: "",
    ...DEFAULT_SCHEDULE,
  };
}

/**
 * CPL > alvo (valor das metas globais ou ajuste manual). A faixa “entre meta e teto” será refinada no worker;
 * use metas globais (CPL alvo × teto) como referência operacional.
 */
function optimizationProfileDraftDesmame(channel: "meta" | "google", cplAlvoStr: string): RuleDraft {
  const thresholdStr = cplAlvoStr.trim() !== "" ? cplAlvoStr.trim() : "0";
  return {
    clientKey: crypto.randomUUID(),
    name: "Desmame de verba",
    evaluationLevel: "campaign",
    metric: "cpa",
    operator: "gt",
    thresholdStr,
    thresholdRef: null,
    severity: "warning",
    active: true,
    appliesToChannel: channel,
    notifyWhatsapp: true,
    actionType: "DECREASE_BUDGET_20",
    messageTemplate:
      "🟠 *DESNAME — Ativa Dash*\nCampanha *{{campaign_name}}* — CPL {{metric_value}} acima do alvo. Orçamento −20%.\n{{period}} · {{rule_name}}",
    routingJobSlugs: [],
    routingUserIds: [],
    routingCustomPhonesStr: "",
    ...DEFAULT_SCHEDULE,
  };
}

function formatExecutionFeedLine(row: AutomationExecutionLogDto): {
  tone: "risk" | "gain" | "neutral";
  line: string;
} {
  const ts = format(new Date(row.executedAt), "dd/MM HH:mm", { locale: ptBR });
  const name = row.assetLabel?.trim() || row.assetId;
  const act = row.actionTaken.trim().toUpperCase();
  const rule = row.ruleName || "Regra";

  if (act === "PAUSE_ASSET") {
    const prev = row.previousValue ?? "—";
    const ceiling = row.newValue ?? "—";
    return {
      tone: "risk",
      line: `[${ts}] 🔴 STOP-LOSS: "${name}" pausado. CPA/ref.: ${prev} (teto/meta: ${ceiling}). · ${rule}`,
    };
  }
  if (act === "INCREASE_BUDGET_20") {
    const a = row.previousValue ?? "—";
    const b = row.newValue ?? "—";
    return {
      tone: "gain",
      line: `[${ts}] 🟢 ESCALA: "${name}" — orçamento ${a} → ${b}. · ${rule}`,
    };
  }
  if (act === "DECREASE_BUDGET_20") {
    const a = row.previousValue ?? "—";
    const b = row.newValue ?? "—";
    return {
      tone: "neutral",
      line: `[${ts}] 🟠 DESNAME: "${name}" — orçamento ${a} → ${b}. · ${rule}`,
    };
  }
  return {
    tone: "neutral",
    line: `[${ts}] ${row.actionTaken} · "${name}" · ${rule}`,
  };
}

function buildRouting(d: RuleDraft): AlertRuleRoutingDto | null {
  const jobTitleSlugs = d.routingJobSlugs.filter(Boolean);
  const userIds = d.routingUserIds.filter(Boolean);
  const customPhones = d.routingCustomPhonesStr
    .split(/[;,]/)
    .map((x) => x.replace(/\D/g, ""))
    .filter((x) => x.length >= 8);
  if (!jobTitleSlugs.length && !userIds.length && !customPhones.length) return null;
  return { jobTitleSlugs, userIds, customPhones };
}

function draftToPayload(d: RuleDraft, tz: string) {
  const threshold =
    d.operator === "outside_target"
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
  };
}

function insertIntoTextarea(
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

function parseMoney(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n === 0 ? null : n;
}

export function MetasAlertasPage() {
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const canEdit = useMemo(() => {
    if (!user?.organizationId) return false;
    const r = memberships?.find((m) => m.organizationId === user.organizationId)?.role;
    return canUserEditMarketingSettings(r);
  }, [user?.organizationId, memberships]);

  const [tab, setTab] = useState("metas");
  const [automationChannel, setAutomationChannel] = useState<"meta" | "google">("meta");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [performanceAlerts, setPerformanceAlerts] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);

  const emptyChannelFields = () => ({
    cplAlvo: "",
    tetoCpa: "",
    metaRoas: "",
    orcamentoDiario: "",
    orcamentoMaxDiario: "",
  });
  const [metaGoals, setMetaGoals] = useState(emptyChannelFields);
  const [googleGoals, setGoogleGoals] = useState(emptyChannelFields);

  const [rules, setRules] = useState<RuleDraft[]>([]);
  const loadedRuleIdsRef = useRef<string[]>([]);
  const tplRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const [execLogs, setExecLogs] = useState<AutomationExecutionLogDto[]>([]);
  const [execLogsLoading, setExecLogsLoading] = useState(false);

  const tz = useMemo(() => clientTz(), []);

  const filteredAutomationRules = useMemo(
    () => rules.filter((r) => r.appliesToChannel === "all" || r.appliesToChannel === automationChannel),
    [rules, automationChannel]
  );

  function thresholdRefSelectOptions(r: RuleDraft): { value: AlertRuleThresholdRef | "fixed"; label: string }[] {
    const opts: { value: AlertRuleThresholdRef | "fixed"; label: string }[] = [
      { value: "fixed", label: "Valor fixo (R$ / × / %)" },
      { value: "VAR_CHANNEL_MAX_CPA", label: THRESHOLD_REF_LABEL.VAR_CHANNEL_MAX_CPA },
      { value: "VAR_CHANNEL_TARGET_ROAS", label: THRESHOLD_REF_LABEL.VAR_CHANNEL_TARGET_ROAS },
    ];
    if (r.appliesToChannel === "all") {
      opts.push({
        value: "VAR_BLENDED_DAILY_BUDGET_MAX",
        label: THRESHOLD_REF_LABEL.VAR_BLENDED_DAILY_BUDGET_MAX,
      });
    }
    return opts;
  }

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [settings, pack, team] = await Promise.all([
        fetchMarketingSettings(),
        fetchAlertRules().catch(() => ({ items: [] as AlertRuleDto[], performanceAlerts: false })),
        fetchMembers().catch(() => [] as MemberRow[]),
      ]);
      setPerformanceAlerts(pack.performanceAlerts);
      setMembers(team);
      const gm = settings.goalsMeta;
      const gg = settings.goalsGoogle;
      const fill = (g: typeof gm) => ({
        cplAlvo: g.targetCpaBrl != null ? String(g.targetCpaBrl) : "",
        tetoCpa: g.maxCpaBrl != null ? String(g.maxCpaBrl) : "",
        metaRoas: g.targetRoas != null ? String(g.targetRoas) : "",
        orcamentoDiario: g.dailyBudgetExpectedBrl != null ? String(g.dailyBudgetExpectedBrl) : "",
        orcamentoMaxDiario: g.dailyBudgetMaxBrl != null ? String(g.dailyBudgetMaxBrl) : "",
      });
      setMetaGoals(fill(gm));
      setGoogleGoals(fill(gg));
      const drafts =
        pack.items.length > 0
          ? pack.items.map(dtoToDraft)
          : pack.performanceAlerts
            ? buildDefaultAutomationDrafts()
            : [];
      setRules(drafts);
      loadedRuleIdsRef.current = pack.items.map((x) => x.id);
    } catch {
      setError("Não foi possível carregar metas e regras.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab !== "historico" || !performanceAlerts) return;
    let cancelled = false;
    setExecLogsLoading(true);
    void fetchAutomationExecutionLogs(100)
      .then((res) => {
        if (!cancelled) setExecLogs(res.items);
      })
      .catch(() => {
        if (!cancelled) setExecLogs([]);
      })
      .finally(() => {
        if (!cancelled) setExecLogsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, performanceAlerts]);

  function updateRule(clientKey: string, patch: Partial<RuleDraft>) {
    setRules((prev) => prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r)));
  }

  function removeRule(clientKey: string) {
    setRules((prev) => prev.filter((r) => r.clientKey !== clientKey));
  }

  async function handleSaveMetas(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    setError(null);
    const meta = {
      t: parseMoney(metaGoals.cplAlvo),
      m: parseMoney(metaGoals.tetoCpa),
      ro: parseMoney(metaGoals.metaRoas),
      daily: parseMoney(metaGoals.orcamentoDiario),
      dmax: parseMoney(metaGoals.orcamentoMaxDiario),
    };
    const goog = {
      t: parseMoney(googleGoals.cplAlvo),
      m: parseMoney(googleGoals.tetoCpa),
      ro: parseMoney(googleGoals.metaRoas),
      daily: parseMoney(googleGoals.orcamentoDiario),
      dmax: parseMoney(googleGoals.orcamentoMaxDiario),
    };
    if (meta.t != null && meta.m != null && meta.t > meta.m) {
      setError("Meta Ads: CPL alvo não pode ser maior que o teto de CPA.");
      return;
    }
    if (goog.t != null && goog.m != null && goog.t > goog.m) {
      setError("Google Ads: CPL alvo não pode ser maior que o teto de CPA.");
      return;
    }
    setSaving(true);
    try {
      await saveMarketingSettings({
        targetCpaBrl: meta.t,
        maxCpaBrl: meta.m,
        targetRoas: meta.ro,
        dailyBudgetExpectedBrl: meta.daily,
        goalsByChannel: {
          meta: {
            targetCpaBrl: meta.t,
            maxCpaBrl: meta.m,
            targetRoas: meta.ro,
            dailyBudgetExpectedBrl: meta.daily,
            dailyBudgetMaxBrl: meta.dmax,
          },
          google: {
            targetCpaBrl: goog.t,
            maxCpaBrl: goog.m,
            targetRoas: goog.ro,
            dailyBudgetExpectedBrl: goog.daily,
            dailyBudgetMaxBrl: goog.dmax,
          },
        },
      });
      setOk("Metas globais salvas.");
      dispatchMarketingSettingsRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRules() {
    setOk(null);
    setError(null);
    if (!performanceAlerts) {
      setError("Regras avançadas não estão disponíveis no plano atual.");
      return;
    }
    for (const r of rules) {
      if (r.operator !== "outside_target" && !r.thresholdRef) {
        const n = Number(String(r.thresholdStr).replace(",", "."));
        if (!Number.isFinite(n)) {
          setError(`Defina um valor numérico para a regra "${r.name}".`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const currentIds = new Set(rules.map((r) => r.serverId).filter(Boolean) as string[]);
      const removed = loadedRuleIdsRef.current.filter((id) => !currentIds.has(id));
      for (const id of removed) {
        await deleteAlertRule(id);
      }
      const next: RuleDraft[] = [];
      for (const r of rules) {
        const payload = draftToPayload(r, tz);
        if (!r.serverId) {
          const created = await createAlertRule(payload);
          next.push(dtoToDraft(created));
        } else {
          await patchAlertRule(r.serverId, payload);
          next.push({ ...r, serverId: r.serverId });
        }
      }
      setRules(next);
      loadedRuleIdsRef.current = next.map((x) => x.serverId!).filter(Boolean);
      setOk("Automações salvas.");
      dispatchMarketingSettingsRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar regras.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full space-y-6 pb-12">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-28">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" asChild>
          <Link to="/marketing">
            <ChevronRight className="h-4 w-4 rotate-180" />
            Painel ADS
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" asChild>
          <Link to="/ads/metas-operacao">Operação por canal</Link>
        </Button>
        <Button variant="outline" size="sm" className="h-9 text-xs sm:text-sm" asChild>
          <Link to="/marketing/configuracoes">Metas por canal (automações)</Link>
        </Button>
      </div>

      <PageHeaderPremium
        eyebrow="Automação"
        breadcrumbs={[{ label: "Painel ADS", href: "/marketing" }, { label: "Metas e alertas" }]}
        title="Metas e alertas"
        subtitle="Metas globais, motor de regras e roteamento WhatsApp alinhado à equipe."
        meta={
          <span className="inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md border border-border/50 bg-muted/30 px-2 py-1">Fuso: {tz}</span>
            <span className="rounded-md border border-border/50 bg-muted/30 px-2 py-1">
              <MessageCircle className="mr-1 inline h-3.5 w-3.5" />
              Integração:{" "}
              <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/marketing/integracoes">
                Ativa CRM
              </Link>
            </span>
          </span>
        }
        className="border-b border-border/45 pb-5"
      />

      {error ? (
        <div className="rounded-xl border border-destructive/35 bg-destructive/[0.08] px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {ok ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3 text-sm font-medium text-emerald-900 dark:text-emerald-200">
          {ok}
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid h-auto w-full max-w-4xl grid-cols-3 rounded-xl border border-border/40 bg-muted/30 p-1">
          <TabsTrigger value="metas" className="rounded-lg text-xs sm:text-sm">
            Metas globais
          </TabsTrigger>
          <TabsTrigger value="regras" className="rounded-lg text-xs sm:text-sm">
            Motor de automações
          </TabsTrigger>
          <TabsTrigger value="historico" className="rounded-lg px-2 text-[10px] leading-tight sm:text-sm sm:leading-normal">
            <span className="block sm:inline">Histórico de execuções</span>
            <span className="block text-[9px] font-normal text-muted-foreground sm:ml-1 sm:inline sm:text-sm">
              (transparência)
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metas" className="mt-6">
          <form onSubmit={handleSaveMetas} className="space-y-4">
            <div className="rounded-xl border border-border/45 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
              Metas separadas por canal. As colunas legadas do workspace (portfolio) usam os valores de{" "}
              <strong className="text-foreground">Meta Ads</strong> como referência principal ao salvar.
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {(
                [
                  {
                    key: "meta" as const,
                    title: "Meta Ads",
                    desc: "CPL, ROAS e orçamentos usados nas regras e no painel deste canal.",
                    state: metaGoals,
                    setState: setMetaGoals,
                  },
                  {
                    key: "google" as const,
                    title: "Google Ads",
                    desc: "Metas independentes para busca, PMax e demais contas Google vinculadas.",
                    state: googleGoals,
                    setState: setGoogleGoals,
                  },
                ] as const
              ).map((col) => (
                <Card key={col.key} className="border-border/50 bg-card shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">{col.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">{col.desc}</p>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        CPL alvo (R$)
                      </Label>
                      <Input
                        inputMode="decimal"
                        value={col.state.cplAlvo}
                        disabled={!canEdit}
                        onChange={(e) => col.setState((s) => ({ ...s, cplAlvo: e.target.value }))}
                        className="h-10 rounded-xl"
                        placeholder="ex: 35"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Teto de CPA (R$)
                      </Label>
                      <Input
                        inputMode="decimal"
                        value={col.state.tetoCpa}
                        disabled={!canEdit}
                        onChange={(e) => col.setState((s) => ({ ...s, tetoCpa: e.target.value }))}
                        className="h-10 rounded-xl"
                        placeholder="ex: 55"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Meta de ROAS (×)
                      </Label>
                      <Input
                        inputMode="decimal"
                        value={col.state.metaRoas}
                        disabled={!canEdit}
                        onChange={(e) => col.setState((s) => ({ ...s, metaRoas: e.target.value }))}
                        className="h-10 rounded-xl"
                        placeholder="ex: 2.5"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Orçamento esperado diário (R$)
                      </Label>
                      <Input
                        inputMode="decimal"
                        value={col.state.orcamentoDiario}
                        disabled={!canEdit}
                        onChange={(e) => col.setState((s) => ({ ...s, orcamentoDiario: e.target.value }))}
                        className="h-10 rounded-xl"
                        placeholder="ex: 500"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Orçamento máximo diário (R$)
                      </Label>
                      <p className="text-[10px] text-muted-foreground">
                        Teto duro para alertas de sangria (regra “todos os canais” soma Meta + Google).
                      </p>
                      <Input
                        inputMode="decimal"
                        value={col.state.orcamentoMaxDiario}
                        disabled={!canEdit}
                        onChange={(e) => col.setState((s) => ({ ...s, orcamentoMaxDiario: e.target.value }))}
                        className="h-10 rounded-xl"
                        placeholder="ex: 800"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button type="submit" disabled={saving || !canEdit} className="rounded-xl">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar metas
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="regras" className="mt-6 space-y-4">
          {!performanceAlerts ? (
            <Card className="border-border/50">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Regras customizadas não estão disponíveis no plano atual.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="rounded-xl border border-border/40 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                <strong className="text-foreground">Motor de automação:</strong> regras separadas por canal. O fluxo é{" "}
                <span className="font-medium text-foreground">
                  SE [nível] tiver [métrica] [condição] [valor] → ENTÃO [ação]
                </span>
                . Pausa e orçamento guardam o tipo de ação; integração com APIs de mídia em evolução.
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Templates prontos (perfis de otimização)
                </div>
                <p className="text-xs text-muted-foreground">
                  Um clique adiciona uma regra ao rascunho para o canal{" "}
                  <strong className="text-foreground">{automationChannel === "meta" ? "Meta Ads" : "Google Ads"}</strong>.
                  Revise destinatários e salve.
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <Card className="border-border/50 bg-card shadow-sm">
                    <CardHeader className="space-y-1 pb-2">
                      <CardTitle className="text-sm font-semibold">Stop-Loss</CardTitle>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        SE CPL &gt; teto de CPA → pausar anúncio e notificar (WhatsApp opcional).
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full rounded-xl"
                        disabled={!canEdit}
                        onClick={() =>
                          setRules((p) => [...p, optimizationProfileDraftStopLoss(automationChannel)])
                        }
                      >
                        Aplicar perfil
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 bg-card shadow-sm">
                    <CardHeader className="space-y-1 pb-2">
                      <CardTitle className="text-sm font-semibold">Take-Profit</CardTitle>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        SE ROAS &gt; meta de ROAS → aumentar orçamento 20% e notificar.
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full rounded-xl"
                        disabled={!canEdit}
                        onClick={() =>
                          setRules((p) => [...p, optimizationProfileDraftTakeProfit(automationChannel)])
                        }
                      >
                        Aplicar perfil
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 bg-card shadow-sm">
                    <CardHeader className="space-y-1 pb-2">
                      <CardTitle className="text-sm font-semibold">Desmame de verba</CardTitle>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        SE CPL &gt; meta (CPL alvo das metas globais) → reduzir orçamento 20%. Ajuste o valor se o alvo
                        estiver vazio.
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full rounded-xl"
                        disabled={!canEdit}
                        onClick={() => {
                          const alvo =
                            automationChannel === "meta" ? metaGoals.cplAlvo : googleGoals.cplAlvo;
                          setRules((p) => [...p, optimizationProfileDraftDesmame(automationChannel, alvo)]);
                          if (alvo.trim()) {
                            setOk(null);
                          } else {
                            setOk(
                              "Perfil Desmame aplicado: o limiar ficou em 0 — edite o valor fixo na regra ou preencha CPL alvo em Metas globais."
                            );
                          }
                        }}
                      >
                        Aplicar perfil
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid h-auto w-full max-w-md grid-cols-2 rounded-xl border border-border/40 bg-muted/30 p-1">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm",
                      automationChannel === "meta"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setAutomationChannel("meta")}
                  >
                    Regras Meta Ads
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm",
                      automationChannel === "google"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setAutomationChannel("google")}
                  >
                    Regras Google Ads
                  </button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
                  disabled={!canEdit}
                  onClick={() => setRules((p) => [...p, newDraft(automationChannel)])}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nova regra ({automationChannel === "meta" ? "Meta" : "Google"})
                </Button>
              </div>

              {filteredAutomationRules.length === 0 ? (
                <Card className="border-dashed border-border/60 bg-muted/10">
                  <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <Zap className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma regra para{" "}
                      {automationChannel === "meta"
                        ? "Meta Ads (inclui regras “todos os canais”)"
                        : "Google Ads (inclui regras “todos os canais”)"}
                      .
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => setRules((p) => [...p, newDraft(automationChannel)])}
                      >
                        Criar primeira regra
                      </Button>
                      {rules.length === 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => setRules(buildDefaultAutomationDrafts())}
                        >
                          Carregar modelos sugeridos
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {filteredAutomationRules.map((r) => (
                <Card
                  key={r.clientKey}
                  className={cn(
                    "border-border/50 bg-card shadow-sm transition-shadow",
                    r.active ? "ring-1 ring-primary/15" : "opacity-95"
                  )}
                >
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "relative flex h-2.5 w-2.5 shrink-0 rounded-full",
                          r.active ? "bg-emerald-500" : "bg-muted-foreground/40"
                        )}
                        title={r.active ? "Ativa" : "Pausada"}
                      >
                        {r.active ? (
                          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
                        ) : null}
                      </span>
                      <Input
                        value={r.name}
                        disabled={!canEdit}
                        onChange={(e) => updateRule(r.clientKey, { name: e.target.value })}
                        className="h-9 max-w-xs rounded-lg border-border/60 font-semibold"
                      />
                      <div className="flex items-center gap-2 rounded-lg border border-border/50 px-2 py-1">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">Ativa</span>
                        <Switch
                          checked={r.active}
                          disabled={!canEdit}
                          onCheckedChange={(v) => updateRule(r.clientKey, { active: v })}
                        />
                      </div>
                    </div>
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive"
                        onClick={() => {
                          if (window.confirm("Remover esta automação?")) removeRule(r.clientKey);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 font-medium",
                          r.appliesToChannel === "all"
                            ? "border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                            : "border-border/50 bg-muted/40"
                        )}
                      >
                        {r.appliesToChannel === "all"
                          ? "Escopo: todos os canais"
                          : r.appliesToChannel === "meta"
                            ? "Escopo: Meta Ads"
                            : "Escopo: Google Ads"}
                      </span>
                      <span className="hidden sm:inline">·</span>
                      <span>
                        Novas regras nesta aba são{" "}
                        <strong className="text-foreground">{automationChannel === "meta" ? "Meta" : "Google"}</strong>
                        ; “todos os canais” aparece nas duas listas.
                      </span>
                    </div>

                    <div className="space-y-3 rounded-xl border border-border/40 bg-muted/20 p-4 text-sm">
                      <p className="flex flex-wrap items-center gap-x-1 gap-y-2 text-[11px] leading-relaxed text-muted-foreground">
                        <span className="font-bold text-foreground">SE</span>
                        <Select
                          value={r.evaluationLevel}
                          disabled={!canEdit}
                          onValueChange={(v) =>
                            updateRule(r.clientKey, { evaluationLevel: v as AlertRuleEvaluationLevel })
                          }
                        >
                          <SelectTrigger className="h-8 w-[9.5rem] rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEVEL_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span>tiver</span>
                        <Select
                          value={r.metric}
                          disabled={!canEdit}
                          onValueChange={(v) => updateRule(r.clientKey, { metric: v as AlertRuleMetric })}
                        >
                          <SelectTrigger className="h-8 w-[11rem] rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {METRIC_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </p>
                      <p className="flex flex-wrap items-center gap-x-1 gap-y-2 text-[11px] leading-relaxed text-muted-foreground">
                        <Select
                          value={r.operator}
                          disabled={!canEdit}
                          onValueChange={(v) => updateRule(r.clientKey, { operator: v as AlertRuleOperator })}
                        >
                          <SelectTrigger className="h-8 w-[10.5rem] rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERATOR_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {r.operator !== "outside_target" ? (
                          <>
                            <Select
                              value={r.thresholdRef ?? "fixed"}
                              disabled={!canEdit}
                              onValueChange={(v) =>
                                updateRule(r.clientKey, {
                                  thresholdRef: v === "fixed" ? null : (v as AlertRuleThresholdRef),
                                  thresholdStr: v === "fixed" ? (r.thresholdStr || "50") : "0",
                                })
                              }
                            >
                              <SelectTrigger className="h-8 min-w-[11rem] max-w-[22rem] rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {thresholdRefSelectOptions(r).map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!r.thresholdRef ? (
                              <Input
                                inputMode="decimal"
                                className="h-8 w-[6.5rem] rounded-lg"
                                disabled={!canEdit}
                                value={r.thresholdStr}
                                onChange={(e) => updateRule(r.clientKey, { thresholdStr: e.target.value })}
                              />
                            ) : (
                              <span className="text-[11px]">(variável das metas)</span>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px]">(fora da meta global)</span>
                        )}
                      </p>

                      <div className="flex flex-col gap-3 border-t border-border/35 pt-3">
                        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Então</div>
                        <div className="grid gap-3 lg:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Ação</Label>
                            <Select
                              value={r.actionType}
                              disabled={!canEdit}
                              onValueChange={(v) =>
                                updateRule(r.clientKey, { actionType: v as AlertRuleActionType })
                              }
                            >
                              <SelectTrigger className="h-9 rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACTION_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    <span className="flex flex-col text-left">
                                      <span>{o.label}</span>
                                      {o.hint ? (
                                        <span className="text-[10px] font-normal text-muted-foreground">{o.hint}</span>
                                      ) : null}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Frequência de checagem</Label>
                            <Select
                              value={r.checkFrequency}
                              disabled={!canEdit}
                              onValueChange={(v) =>
                                updateRule(r.clientKey, { checkFrequency: v as AlertRuleCheckFrequency })
                              }
                            >
                              <SelectTrigger className="h-9 rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FREQUENCY_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1 lg:col-span-2">
                            <Label className="text-[10px] text-muted-foreground">
                              Janela de atuação (horário de expediente)
                            </Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-muted-foreground">Das</span>
                              <Input
                                type="time"
                                disabled={!canEdit}
                                value={r.actionWindowStartLocal || ""}
                                onChange={(e) =>
                                  updateRule(r.clientKey, { actionWindowStartLocal: e.target.value })
                                }
                                className="h-9 w-[7rem] rounded-lg"
                              />
                              <span className="text-xs text-muted-foreground">às</span>
                              <Input
                                type="time"
                                disabled={!canEdit}
                                value={r.actionWindowEndLocal || ""}
                                onChange={(e) =>
                                  updateRule(r.clientKey, { actionWindowEndLocal: e.target.value })
                                }
                                className="h-9 w-[7rem] rounded-lg"
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              Fuso: {tz}. Vazio = sem janela local (24/7; mute UTC legado ainda pode aplicar).
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-muted-foreground" />
                          <Label className="text-sm font-medium">Destinatários</Label>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Por cargo (todos com aquele papel), por pessoa ou números extras. Requer WhatsApp cadastrado na
                          equipe para rotear por usuário.
                        </p>
                        <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border/50 bg-background/80 p-3">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">Cargos</p>
                          {TEAM_JOB_TITLE_OPTIONS.map((jt) => (
                            <label key={jt.value} className="flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                className="rounded border-border"
                                disabled={!canEdit}
                                checked={r.routingJobSlugs.includes(jt.value)}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  updateRule(r.clientKey, {
                                    routingJobSlugs: on
                                      ? [...r.routingJobSlugs, jt.value]
                                      : r.routingJobSlugs.filter((x) => x !== jt.value),
                                  });
                                }}
                              />
                              <span>Todos: {jt.label}</span>
                            </label>
                          ))}
                        </div>
                        <div className="max-h-36 space-y-2 overflow-y-auto rounded-lg border border-border/50 bg-background/80 p-3">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">Pessoas</p>
                          {members.map((m) => (
                            <label key={m.userId} className="flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                className="rounded border-border"
                                disabled={!canEdit}
                                checked={r.routingUserIds.includes(m.userId)}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  updateRule(r.clientKey, {
                                    routingUserIds: on
                                      ? [...r.routingUserIds, m.userId]
                                      : r.routingUserIds.filter((x) => x !== m.userId),
                                  });
                                }}
                              />
                              <span className="min-w-0 truncate">
                                {m.name}{" "}
                                <span className="text-muted-foreground">
                                  ({jobTitleLabelPt(m.jobTitle ?? null)})
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Números customizados (fallback)</Label>
                          <Input
                            placeholder="5511999999999, 5511888888888"
                            disabled={!canEdit}
                            value={r.routingCustomPhonesStr}
                            onChange={(e) => updateRule(r.clientKey, { routingCustomPhonesStr: e.target.value })}
                            className="h-9 rounded-lg font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-muted-foreground" />
                          <Label className="text-sm font-medium">Modelo de mensagem</Label>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {MESSAGE_CHIPS.map((c) => (
                            <button
                              key={c.label}
                              type="button"
                              disabled={!canEdit}
                              onClick={() =>
                                insertIntoTextarea(
                                  tplRefs.current[r.clientKey] ?? null,
                                  r.messageTemplate,
                                  c.insert,
                                  (v) => updateRule(r.clientKey, { messageTemplate: v })
                                )
                              }
                              className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                        <textarea
                          ref={(el) => {
                            tplRefs.current[r.clientKey] = el;
                          }}
                          disabled={!canEdit}
                          value={r.messageTemplate}
                          onChange={(e) => updateRule(r.clientKey, { messageTemplate: e.target.value })}
                          className="min-h-[120px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">WhatsApp</span>
                        <Switch
                          checked={r.notifyWhatsapp}
                          disabled={!canEdit}
                          onCheckedChange={(v) => updateRule(r.clientKey, { notifyWhatsapp: v })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="rounded-xl"
                  disabled={saving || !canEdit || rules.length === 0}
                  onClick={() => void handleSaveRules()}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar automações
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-6 space-y-4">
          {!performanceAlerts ? (
            <Card className="border-border/50">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Histórico de execuções não está disponível no plano atual.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="rounded-xl border border-border/40 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                <ScrollText className="mr-2 inline h-4 w-4 align-text-bottom text-primary" />
                <strong className="text-foreground">Transparência:</strong> registo das ações autónomas (pausa, escala,
                desmame) executadas pelo motor. Entradas aparecem quando o worker gravar cada execução na API.
              </div>
              {execLogsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : execLogs.length === 0 ? (
                <Card className="border-dashed border-border/60 bg-muted/10">
                  <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                    <ScrollText className="h-10 w-10 opacity-40" />
                    <p>Ainda não há execuções registadas.</p>
                    <p className="max-w-md text-xs">
                      Quando o cron executar pausas ou ajustes de orçamento, cada ação ficará listada aqui com horário,
                      ativo e valores antes/depois.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-border/50 bg-card shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Últimas execuções</CardTitle>
                    <p className="text-xs text-muted-foreground">Ordenado do mais recente para o mais antigo.</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {execLogs.map((row) => {
                      const { tone, line } = formatExecutionFeedLine(row);
                      return (
                        <div
                          key={row.id}
                          className={cn(
                            "rounded-lg border px-3 py-2.5 text-sm leading-relaxed",
                            tone === "risk" && "border-destructive/25 bg-destructive/[0.06]",
                            tone === "gain" && "border-emerald-500/25 bg-emerald-500/[0.06]",
                            tone === "neutral" && "border-border/50 bg-muted/20"
                          )}
                        >
                          {line}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <div className="rounded-xl border border-border/40 bg-muted/15 px-4 py-3 text-xs text-muted-foreground">
        <PauseCircle className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
        Ajustes finos por canal (Meta/Google), automações de orçamento e silêncio por horário legado continuam em{" "}
        <Link to="/marketing/configuracoes" className="font-medium text-primary underline-offset-4 hover:underline">
          Configurações de marketing
        </Link>{" "}
        e no fluxo operacional completo.
      </div>
    </div>
  );
}
