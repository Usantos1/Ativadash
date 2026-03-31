import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  Loader2,
  MessageCircle,
  PauseCircle,
  Plus,
  Save,
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
  patchAlertRule,
  type AlertRuleActionType,
  type AlertRuleDto,
  type AlertRuleMetric,
  type AlertRuleOperator,
  type AlertRuleRoutingDto,
  type AlertRuleSeverity,
} from "@/lib/alert-rules-api";
import { fetchMembers, type MemberRow } from "@/lib/workspace-api";
import { canUserEditMarketingSettings } from "@/lib/marketing-ads-permissions";
import { useAuthStore } from "@/stores/auth-store";
import { TEAM_JOB_TITLE_OPTIONS, jobTitleLabelPt } from "@/lib/team-access-ui";
import { cn } from "@/lib/utils";

const METRIC_OPTIONS: { value: AlertRuleMetric; label: string }[] = [
  { value: "cpa", label: "CPL" },
  { value: "roas", label: "ROAS" },
  { value: "spend", label: "Gasto" },
  { value: "ctr", label: "CTR" },
];

const OPERATOR_OPTIONS: { value: AlertRuleOperator; label: string }[] = [
  { value: "gt", label: "Maior que" },
  { value: "lt", label: "Menor que" },
  { value: "outside_target", label: "Fora da meta" },
];

const ACTION_OPTIONS: { value: AlertRuleActionType; label: string; disabled?: boolean }[] = [
  { value: "whatsapp_alert", label: "Enviar alerta WhatsApp" },
  { value: "pause_campaign", label: "Pausar campanha (em breve)", disabled: true },
];

const CHANNEL_OPTIONS: { value: "all" | "meta" | "google"; label: string }[] = [
  { value: "all", label: "Todos os canais" },
  { value: "meta", label: "Meta Ads" },
  { value: "google", label: "Google Ads" },
];

const MESSAGE_CHIPS: { label: string; insert: string }[] = [
  { label: "[Nome da Campanha]", insert: "{{campaign_name}}" },
  { label: "[Métrica atual]", insert: "{{metric_value}}" },
  { label: "[Valor da meta]", insert: "{{goal_value}}" },
  { label: "[Nome da regra]", insert: "{{rule_name}}" },
  { label: "[Período]", insert: "{{period}}" },
];

type RuleDraft = {
  clientKey: string;
  serverId?: string;
  name: string;
  metric: AlertRuleMetric;
  operator: AlertRuleOperator;
  thresholdStr: string;
  severity: AlertRuleSeverity;
  active: boolean;
  appliesToChannel: "all" | "meta" | "google";
  notifyWhatsapp: boolean;
  actionType: AlertRuleActionType;
  messageTemplate: string;
  routingJobSlugs: string[];
  routingUserIds: string[];
  routingCustomPhonesStr: string;
  evaluationTimeLocal: string;
};

function clientTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
}

function dtoToDraft(d: AlertRuleDto): RuleDraft {
  return {
    clientKey: d.id,
    serverId: d.id,
    name: d.name,
    metric: (METRIC_OPTIONS.some((m) => m.value === d.metric) ? d.metric : "cpa") as AlertRuleMetric,
    operator: (OPERATOR_OPTIONS.some((o) => o.value === d.operator)
      ? d.operator
      : "gt") as AlertRuleOperator,
    thresholdStr: d.operator === "outside_target" ? "" : String(d.threshold),
    severity: d.severity === "critical" ? "critical" : "warning",
    active: d.active,
    appliesToChannel:
      d.appliesToChannel === "meta" || d.appliesToChannel === "google" ? d.appliesToChannel : "all",
    notifyWhatsapp: d.notifyWhatsapp !== false,
    actionType: d.actionType === "pause_campaign" ? "pause_campaign" : "whatsapp_alert",
    messageTemplate: d.messageTemplate ?? "",
    routingJobSlugs: [...(d.routing?.jobTitleSlugs ?? [])],
    routingUserIds: [...(d.routing?.userIds ?? [])],
    routingCustomPhonesStr: (d.routing?.customPhones ?? []).join(", "),
    evaluationTimeLocal: d.evaluationTimeLocal?.trim() ?? "",
  };
}

function newDraft(): RuleDraft {
  return {
    clientKey: crypto.randomUUID(),
    name: "Nova automação",
    metric: "cpa",
    operator: "gt",
    thresholdStr: "50",
    severity: "warning",
    active: true,
    appliesToChannel: "all",
    notifyWhatsapp: true,
    actionType: "whatsapp_alert",
    messageTemplate:
      "⚠️ {{rule_name}}\n{{metric_value}} no período {{period}}. Meta: {{goal_value}}.\nCampanha: {{campaign_name}}",
    routingJobSlugs: [],
    routingUserIds: [],
    routingCustomPhonesStr: "",
    evaluationTimeLocal: "",
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
      : (() => {
          const n = Number(String(d.thresholdStr).replace(",", "."));
          return Number.isFinite(n) ? n : 0;
        })();
  return {
    name: d.name.trim() || "Automação",
    metric: d.metric,
    operator: d.operator,
    threshold,
    severity: d.severity,
    active: d.active,
    appliesToChannel: d.appliesToChannel,
    notifyWhatsapp: d.notifyWhatsapp,
    actionType: d.actionType === "pause_campaign" ? ("whatsapp_alert" as const) : d.actionType,
    messageTemplate: d.messageTemplate.trim() || null,
    routing: buildRouting(d),
    evaluationTimeLocal: d.evaluationTimeLocal.trim() ? d.evaluationTimeLocal.trim() : null,
    evaluationTimezone: d.evaluationTimeLocal.trim() ? tz : null,
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [performanceAlerts, setPerformanceAlerts] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);

  const [cplAlvo, setCplAlvo] = useState("");
  const [tetoCpa, setTetoCpa] = useState("");
  const [metaRoas, setMetaRoas] = useState("");
  const [orcamentoDiario, setOrcamentoDiario] = useState("");

  const [rules, setRules] = useState<RuleDraft[]>([]);
  const loadedRuleIdsRef = useRef<string[]>([]);
  const tplRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const tz = useMemo(() => clientTz(), []);

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
      const g = settings.goalsMeta;
      setCplAlvo(g.targetCpaBrl != null ? String(g.targetCpaBrl) : "");
      setTetoCpa(g.maxCpaBrl != null ? String(g.maxCpaBrl) : "");
      setMetaRoas(g.targetRoas != null ? String(g.targetRoas) : "");
      setOrcamentoDiario(
        settings.dailyBudgetExpectedBrl != null ? String(settings.dailyBudgetExpectedBrl) : ""
      );
      const drafts = pack.items.map(dtoToDraft);
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
    const t = parseMoney(cplAlvo);
    const m = parseMoney(tetoCpa);
    const ro = parseMoney(metaRoas);
    const daily = parseMoney(orcamentoDiario);
    if (t != null && m != null && t > m) {
      setError("CPL alvo não pode ser maior que o teto de CPA.");
      return;
    }
    setSaving(true);
    try {
      await saveMarketingSettings({
        targetCpaBrl: t,
        maxCpaBrl: m,
        targetRoas: ro,
        dailyBudgetExpectedBrl: daily,
        goalsByChannel: {
          meta: {
            targetCpaBrl: t,
            maxCpaBrl: m,
            targetRoas: ro,
          },
          google: {
            targetCpaBrl: t,
            maxCpaBrl: m,
            targetRoas: ro,
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
      if (r.operator !== "outside_target") {
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
        <TabsList className="grid h-auto w-full max-w-lg grid-cols-2 rounded-xl border border-border/40 bg-muted/30 p-1">
          <TabsTrigger value="metas" className="rounded-lg text-xs sm:text-sm">
            Metas globais
          </TabsTrigger>
          <TabsTrigger value="regras" className="rounded-lg text-xs sm:text-sm">
            Motor de automações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metas" className="mt-6">
          <form onSubmit={handleSaveMetas}>
            <Card className="border-border/50 bg-card shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Metas globais (baseline)</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Referência principal para alertas e condição &quot;Fora da meta&quot;. Sincronizamos com as metas Meta/Google
                  ao salvar.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    CPL alvo (R$)
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={cplAlvo}
                    disabled={!canEdit}
                    onChange={(e) => setCplAlvo(e.target.value)}
                    className="h-10 rounded-xl"
                    placeholder="ex: 35"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Teto de CPA (R$)
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={tetoCpa}
                    disabled={!canEdit}
                    onChange={(e) => setTetoCpa(e.target.value)}
                    className="h-10 rounded-xl"
                    placeholder="ex: 55"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Meta de ROAS (×)
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={metaRoas}
                    disabled={!canEdit}
                    onChange={(e) => setMetaRoas(e.target.value)}
                    className="h-10 rounded-xl"
                    placeholder="ex: 2.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Orçamento diário esperado (R$)
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={orcamentoDiario}
                    disabled={!canEdit}
                    onChange={(e) => setOrcamentoDiario(e.target.value)}
                    className="h-10 rounded-xl"
                    placeholder="ex: 500"
                  />
                </div>
              </CardContent>
              <CardContent className="pt-0">
                <Button type="submit" disabled={saving || !canEdit} className="rounded-xl">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar metas
                </Button>
              </CardContent>
            </Card>
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Monte frases do tipo: <span className="font-medium text-foreground">SE métrica ENTÃO ação</span>, com
                  destinatários e modelo de mensagem.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
                  disabled={!canEdit}
                  onClick={() => setRules((p) => [...p, newDraft()])}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar nova automação
                </Button>
              </div>

              {rules.length === 0 ? (
                <Card className="border-dashed border-border/60 bg-muted/10">
                  <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <Zap className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Nenhuma automação ainda.</p>
                    <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setRules([newDraft()])}>
                      Começar com um modelo
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {rules.map((r) => (
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
                    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/40 bg-muted/20 p-4 text-sm">
                      <span className="self-center text-xs font-bold uppercase tracking-wide text-muted-foreground">SE</span>
                      <div className="w-[8.5rem] space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Métrica</Label>
                        <Select
                          value={r.metric}
                          disabled={!canEdit}
                          onValueChange={(v) => updateRule(r.clientKey, { metric: v as AlertRuleMetric })}
                        >
                          <SelectTrigger className="h-9 rounded-lg">
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
                      </div>
                      <div className="w-[10.5rem] space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Estiver</Label>
                        <Select
                          value={r.operator}
                          disabled={!canEdit}
                          onValueChange={(v) => updateRule(r.clientKey, { operator: v as AlertRuleOperator })}
                        >
                          <SelectTrigger className="h-9 rounded-lg">
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
                      </div>
                      {r.operator !== "outside_target" ? (
                        <div className="min-w-[6rem] flex-1 space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Valor (R$ ou %)</Label>
                          <Input
                            inputMode="decimal"
                            className="h-9 rounded-lg"
                            disabled={!canEdit}
                            value={r.thresholdStr}
                            onChange={(e) => updateRule(r.clientKey, { thresholdStr: e.target.value })}
                          />
                        </div>
                      ) : (
                        <p className="self-center text-xs text-muted-foreground">Usa CPL/ROAS das metas globais.</p>
                      )}
                      <span className="self-center text-xs font-bold uppercase text-muted-foreground">ENTÃO</span>
                      <div className="min-w-[12rem] flex-1 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Ação</Label>
                        <Select
                          value={r.actionType === "pause_campaign" ? "whatsapp_alert" : r.actionType}
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
                              <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                        <div className="space-y-1">
                          <Label className="text-xs">Horário preferencial de checagem (opcional)</Label>
                          <p className="text-[11px] text-muted-foreground">
                            Vazio = avalia quando o painel rodar, sem janela fixa. Usa o fuso do navegador ({tz}).
                          </p>
                          <Input
                            type="time"
                            disabled={!canEdit}
                            value={r.evaluationTimeLocal || ""}
                            onChange={(e) => updateRule(r.clientKey, { evaluationTimeLocal: e.target.value })}
                            className="h-9 max-w-[9rem] rounded-lg"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Canal</Label>
                        <Select
                          value={r.appliesToChannel}
                          disabled={!canEdit}
                          onValueChange={(v) =>
                            updateRule(r.clientKey, { appliesToChannel: v as RuleDraft["appliesToChannel"] })
                          }
                        >
                          <SelectTrigger className="h-9 w-[11rem] rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CHANNEL_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
