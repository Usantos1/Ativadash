import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  History,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Shuffle,
  Sparkles,
  Sliders,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeaderPremium } from "@/components/premium";
import {
  dispatchMarketingSettingsRefresh,
  fetchMarketingSettings,
  saveMarketingSettings,
  type BusinessGoalMode,
} from "@/lib/marketing-settings-api";
import {
  createAlertRule,
  deleteAlertRule,
  fetchAlertRules,
  fetchAutomationExecutionLogs,
  patchAlertRule,
  type AlertRuleDto,
  type AlertRuleThresholdRef,
  type AutomationExecutionLogDto,
} from "@/lib/alert-rules-api";
import { fetchMembers, type MemberRow } from "@/lib/workspace-api";
import { canUserEditMarketingSettingsEffective } from "@/lib/marketing-ads-permissions";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { AutomationExecutionTimeline } from "@/components/metas-automation/AutomationExecutionTimeline";
import { AutomationOverviewCards } from "@/components/metas-automation/AutomationOverviewCards";
import { AutomationRuleSummaryCard } from "@/components/metas-automation/AutomationRuleSummaryCard";
import { AutomationTemplateCard } from "@/components/metas-automation/AutomationTemplateCard";
import { RuleBuilderSheet } from "@/components/metas-automation/RuleBuilderSheet";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";
import {
  THRESHOLD_REF_LABEL,
  buildDefaultAutomationDrafts,
  clientTz,
  draftToPayload,
  dtoToDraft,
  newDraft,
  optimizationProfileDraftDesmame,
  optimizationProfileDraftStopLoss,
  optimizationProfileDraftTakeProfit,
  type RuleDraft,
} from "@/components/metas-automation/rule-draft";

function parseMoney(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n === 0 ? null : n;
}

type ChannelKey = "meta" | "google";

const CHANNEL_META: Record<ChannelKey, { label: string; dot: string; accent: string; soft: string }> = {
  meta: {
    label: "Meta Ads",
    dot: "bg-[#1877F2]",
    accent: "text-[#1877F2]",
    soft: "bg-[#1877F2]/10 border-[#1877F2]/25",
  },
  google: {
    label: "Google Ads",
    dot: "bg-[#34A853]",
    accent: "text-[#34A853]",
    soft: "bg-[#34A853]/10 border-[#34A853]/25",
  },
};

export function MetasAlertasPage() {
  usePageTitle(formatPageTitle(["Automação e Metas"]));
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const canEdit = useMemo(() => {
    if (!user?.organizationId) return false;
    const directRole = memberships?.find((m) => m.organizationId === user.organizationId)?.role;
    /**
     * Modo suporte (impersonação) vira um agency_owner em contexto do cliente filho —
     * não há Membership direta, mas o backend permite via `effectiveWorkspaceRole`.
     * Usamos a versão efetiva para que a UI não bloqueie edição indevidamente.
     */
    return canUserEditMarketingSettingsEffective({
      directRole,
      isImpersonating: user?.isImpersonating === true,
      memberships: memberships ?? null,
    });
  }, [user?.organizationId, user?.isImpersonating, memberships]);

  const [tab, setTab] = useState("metas");
  const [automationChannel, setAutomationChannel] = useState<ChannelKey>("meta");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [performanceAlerts, setPerformanceAlerts] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [businessGoalMode, setBusinessGoalMode] = useState<BusinessGoalMode>("HYBRID");

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

  const [execLogs, setExecLogs] = useState<AutomationExecutionLogDto[]>([]);
  const [execLogsLoading, setExecLogsLoading] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const tz = useMemo(() => clientTz(), []);

  const filteredAutomationRules = useMemo(
    () => rules.filter((r) => r.appliesToChannel === "all" || r.appliesToChannel === automationChannel),
    [rules, automationChannel]
  );

  const editingDraft = useMemo(
    () => (editingKey ? rules.find((r) => r.clientKey === editingKey) ?? null : null),
    [rules, editingKey]
  );

  const ruleChannelById = useMemo(() => {
    const m = new Map<string, "meta" | "google" | "all">();
    for (const r of rules) {
      if (r.serverId) m.set(r.serverId, r.appliesToChannel);
    }
    return m;
  }, [rules]);

  const activeCount = useMemo(
    () => filteredAutomationRules.filter((r) => r.active).length,
    [filteredAutomationRules]
  );
  const pausedCount = useMemo(
    () => filteredAutomationRules.filter((r) => !r.active).length,
    [filteredAutomationRules]
  );

  const templateInstanceCounts = useMemo(() => {
    const counts = { stopLoss: 0, takeProfit: 0, desmame: 0 };
    for (const r of rules) {
      if (r.actionType === "PAUSE_ASSET" && r.metric === "cpa") counts.stopLoss++;
      else if (r.actionType === "INCREASE_BUDGET_20" && r.metric === "roas") counts.takeProfit++;
      else if (r.actionType === "DECREASE_BUDGET_20" && r.operator === "cpa_band") counts.desmame++;
    }
    return counts;
  }, [rules]);

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
      setBusinessGoalMode(settings.businessGoalMode);
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

      // Carrega logs recentes para alimentar os KPIs de overview.
      if (pack.performanceAlerts) {
        setExecLogsLoading(true);
        fetchAutomationExecutionLogs(150)
          .then((res) => setExecLogs(res.items))
          .catch(() => setExecLogs([]))
          .finally(() => setExecLogsLoading(false));
      }
    } catch {
      setError("Não foi possível carregar metas e regras.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function refreshExecLogs() {
    setExecLogsLoading(true);
    void fetchAutomationExecutionLogs(150)
      .then((res) => setExecLogs(res.items))
      .catch(() => setExecLogs([]))
      .finally(() => setExecLogsLoading(false));
  }

  function updateRule(clientKey: string, patch: Partial<RuleDraft>) {
    setRules((prev) => prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r)));
  }

  function removeRule(clientKey: string) {
    if (editingKey === clientKey) {
      setEditingKey(null);
      setSheetOpen(false);
    }
    setRules((prev) => prev.filter((r) => r.clientKey !== clientKey));
  }

  function openEditor(key: string) {
    setEditingKey(key);
    setSheetOpen(true);
  }

  async function handleToggleRuleActive(r: RuleDraft, active: boolean) {
    updateRule(r.clientKey, { active });
    if (!r.serverId || !canEdit) return;
    setTogglingKey(r.clientKey);
    setError(null);
    try {
      const updated = await patchAlertRule(r.serverId, { active });
      updateRule(r.clientKey, dtoToDraft(updated));
    } catch {
      updateRule(r.clientKey, { active: !active });
      setError("Não foi possível alterar o estado da regra.");
    } finally {
      setTogglingKey(null);
    }
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
        businessGoalMode,
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
      setOk("Metas globais salvas com sucesso.");
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
      if (r.operator === "cpa_band" && r.metric !== "cpa") {
        setError(`A regra "${r.name}" usa "Entre meta e teto" — altere a métrica para CPL.`);
        return;
      }
      if (r.operator !== "outside_target" && r.operator !== "cpa_band" && !r.thresholdRef) {
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
          const updated = await patchAlertRule(r.serverId, payload);
          next.push(dtoToDraft(updated));
        }
      }
      setRules(next);
      loadedRuleIdsRef.current = next.map((x) => x.serverId!).filter(Boolean);
      if (editingKey && !next.some((x) => x.clientKey === editingKey)) {
        setEditingKey(null);
        setSheetOpen(false);
      }
      setOk("Automações salvas com sucesso.");
      dispatchMarketingSettingsRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar regras.");
    } finally {
      setSaving(false);
    }
  }

  function applyTemplate(getDraft: () => RuleDraft) {
    const d = getDraft();
    setRules((p) => [...p, d]);
    setEditingKey(d.clientKey);
    setSheetOpen(true);
    setOk(null);
  }

  if (loading) {
    return (
      <div className="w-full space-y-6 pb-12">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-28">
      <PageHeaderPremium
        eyebrow="Automação"
        breadcrumbs={[{ label: "Painel ADS", href: "/marketing" }, { label: "Automação e Metas" }]}
        title="Automação e Metas"
        subtitle="Defina metas por canal e crie regras que o motor executa automaticamente: pausar, escalar, notificar."
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" aria-hidden />
              Fuso: <strong className="font-semibold text-foreground">{tz}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              Integração:{" "}
              <Link className="font-semibold text-primary underline-offset-4 hover:underline" to="/marketing/integracoes">
                Ativa CRM
              </Link>
            </span>
          </>
        }
        className="border-b border-border/45 pb-5"
      />

      <AutomationOverviewCards rules={rules} execLogs={execLogs} performanceAlerts={performanceAlerts} />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/35 bg-destructive/[0.08] px-4 py-3 text-sm text-destructive shadow-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1 font-medium">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 rounded-md px-1.5 text-destructive/60 hover:bg-destructive/10 hover:text-destructive"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
      )}
      {ok && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3 text-sm font-medium text-emerald-900 shadow-sm dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <span className="flex-1">{ok}</span>
          <button
            type="button"
            onClick={() => setOk(null)}
            className="shrink-0 rounded-md px-1.5 text-emerald-700/60 hover:bg-emerald-500/10 hover:text-emerald-900 dark:text-emerald-400/60 dark:hover:text-emerald-200"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
      )}

      <RuleBuilderSheet
        open={sheetOpen && editingDraft != null}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setEditingKey(null);
        }}
        draft={editingDraft}
        onChange={(patch) => editingKey && updateRule(editingKey, patch)}
        canEdit={canEdit}
        tz={tz}
        members={members}
        automationChannel={automationChannel}
        thresholdRefOptions={thresholdRefSelectOptions}
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="inline-flex h-11 w-full max-w-2xl items-center gap-1 rounded-xl border border-border/50 bg-muted/30 p-1 sm:w-auto">
          <TabsTrigger
            value="metas"
            className="flex-1 gap-2 rounded-lg px-4 text-xs font-semibold data-[state=active]:shadow-sm sm:flex-initial sm:text-sm"
          >
            <Target className="h-4 w-4" aria-hidden />
            Metas globais
          </TabsTrigger>
          <TabsTrigger
            value="regras"
            className="flex-1 gap-2 rounded-lg px-4 text-xs font-semibold data-[state=active]:shadow-sm sm:flex-initial sm:text-sm"
          >
            <Sliders className="h-4 w-4" aria-hidden />
            Regras
            {rules.length > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                {rules.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="historico"
            className="flex-1 gap-2 rounded-lg px-4 text-xs font-semibold data-[state=active]:shadow-sm sm:flex-initial sm:text-sm"
          >
            <History className="h-4 w-4" aria-hidden />
            Histórico
            {execLogs.length > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                {execLogs.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Metas globais ── */}
        <TabsContent value="metas" className="mt-6 space-y-5 outline-none">
          <form onSubmit={handleSaveMetas} className="space-y-5">
            <section className="space-y-3">
              <header className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold tracking-tight text-foreground">Modo de negócio</h2>
                  <p className="text-xs text-muted-foreground">
                    Define quais indicadores guiam o cockpit e as automações.
                  </p>
                </div>
              </header>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    { value: "LEADS", label: "Leads", desc: "Geração de contatos", Icon: Users },
                    { value: "SALES", label: "Vendas", desc: "E-commerce / ROAS", Icon: DollarSign },
                    { value: "HYBRID", label: "Híbrido", desc: "Leads + Vendas", Icon: Shuffle },
                  ] as const
                ).map((opt) => {
                  const active = businessGoalMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setBusinessGoalMode(opt.value)}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                        active
                          ? "border-primary bg-primary/[0.06] shadow-[0_1px_0_rgba(0,0,0,0.04),0_0_0_3px_hsl(var(--primary)/0.08)]"
                          : "border-border/50 bg-card hover:border-border hover:bg-muted/30",
                        !canEdit && "cursor-not-allowed opacity-60"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                          active
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                        )}
                      >
                        <opt.Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-semibold", active ? "text-foreground" : "text-foreground/90")}>
                          {opt.label}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">{opt.desc}</p>
                      </div>
                      {active ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <header className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold tracking-tight text-foreground">Metas por canal</h2>
                  <p className="text-xs text-muted-foreground">
                    Valores usados pelo motor como referência para regras dinâmicas (CPL, ROAS, orçamento).
                  </p>
                </div>
              </header>

              <div className="grid gap-4 lg:grid-cols-2">
                {(
                  [
                    {
                      key: "meta" as const,
                      desc: "CPL, ROAS e orçamentos usados nas regras e no painel deste canal.",
                      state: metaGoals,
                      setState: setMetaGoals,
                    },
                    {
                      key: "google" as const,
                      desc: "Metas independentes para busca, PMax e demais contas Google vinculadas.",
                      state: googleGoals,
                      setState: setGoogleGoals,
                    },
                  ] as const
                ).map((col) => {
                  const meta = CHANNEL_META[col.key];
                  return (
                    <Card
                      key={col.key}
                      className={cn("overflow-hidden border shadow-[var(--shadow-surface-sm)]", meta.soft)}
                    >
                      <div className="flex items-center gap-2.5 border-b border-border/40 bg-background/70 px-4 py-3 dark:bg-background/40">
                        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <h3 className={cn("text-sm font-bold tracking-tight", meta.accent)}>{meta.label}</h3>
                          <p className="truncate text-[11px] text-muted-foreground">{col.desc}</p>
                        </div>
                      </div>
                      <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            CPL alvo <span className="font-mono normal-case">(R$)</span>
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
                        <div className="space-y-1.5">
                          <Label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Teto de CPA <span className="font-mono normal-case">(R$)</span>
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
                        <div className="space-y-1.5">
                          <Label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Meta de ROAS <span className="font-mono normal-case">(×)</span>
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
                        <div className="space-y-1.5">
                          <Label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Orçamento esperado/dia <span className="font-mono normal-case">(R$)</span>
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
                          <Label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Orçamento máximo/dia <span className="font-mono normal-case">(R$)</span>
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Teto duro para alertas de sangria · regras &quot;todos os canais&quot; somam Meta + Google.
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
                  );
                })}
              </div>
            </section>

            <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-4">
              <p className="mr-auto text-xs text-muted-foreground">
                Alterações afetam todas as regras que usam variáveis globais.
              </p>
              <Button type="submit" disabled={saving || !canEdit} className="rounded-xl">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar metas
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* ── Motor de automações ── */}
        <TabsContent value="regras" className="mt-6 space-y-5 outline-none">
          {!performanceAlerts ? (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
                <Sparkles className="h-10 w-10 text-muted-foreground/40" aria-hidden />
                <p className="max-w-md">
                  Regras customizadas não estão disponíveis no plano atual. Fale com seu representante para habilitar o
                  motor de automação.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <section className="space-y-3">
                <header className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                      <Zap className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="space-y-0.5">
                      <h2 className="text-sm font-bold tracking-tight text-foreground">Templates rápidos</h2>
                      <p className="text-xs text-muted-foreground">
                        Um clique cria uma regra pré-configurada para o canal selecionado abaixo. Edite no construtor
                        antes de salvar.
                      </p>
                    </div>
                  </div>
                </header>

                <div className="grid gap-3 md:grid-cols-3">
                  <AutomationTemplateCard
                    id="stop-loss"
                    tone="risk"
                    title="Proteção de orçamento"
                    subtitle="Corta automaticamente anúncios com CPL acima do teto."
                    trigger="CPL > teto do canal"
                    action="Pausar anúncio + WhatsApp crítico"
                    instances={templateInstanceCounts.stopLoss}
                    canEdit={canEdit}
                    onApply={() => applyTemplate(() => optimizationProfileDraftStopLoss(automationChannel))}
                  />
                  <AutomationTemplateCard
                    id="take-profit"
                    tone="gain"
                    title="Escala agressiva"
                    subtitle="Sobe orçamento quando o ROAS supera a meta."
                    trigger="ROAS > meta do canal"
                    action="Aumentar orçamento +20%"
                    instances={templateInstanceCounts.takeProfit}
                    canEdit={canEdit}
                    onApply={() => applyTemplate(() => optimizationProfileDraftTakeProfit(automationChannel))}
                  />
                  <AutomationTemplateCard
                    id="desmame"
                    tone="neutral"
                    title="Desmame de verba"
                    subtitle="Reduz orçamento quando o CPL fica na faixa entre alvo e teto."
                    trigger="CPL entre alvo e teto"
                    action="Reduzir orçamento −20%"
                    instances={templateInstanceCounts.desmame}
                    canEdit={canEdit}
                    onApply={() => applyTemplate(() => optimizationProfileDraftDesmame(automationChannel))}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <h2 className="text-sm font-bold tracking-tight text-foreground">Regras ativas</h2>
                    <p className="text-xs text-muted-foreground">
                      Mostra regras do canal selecionado + regras &quot;todos os canais&quot;.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex h-10 rounded-xl border border-border/50 bg-muted/30 p-1">
                      {(["meta", "google"] as const).map((ch) => {
                        const meta = CHANNEL_META[ch];
                        const active = automationChannel === ch;
                        return (
                          <button
                            key={ch}
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-2 rounded-lg px-3 text-xs font-semibold transition sm:text-sm",
                              active
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setAutomationChannel(ch)}
                          >
                            <span className={cn("h-2 w-2 rounded-full", meta.dot)} aria-hidden />
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-10 rounded-xl"
                      disabled={!canEdit}
                      onClick={() => {
                        const d = newDraft(automationChannel);
                        setRules((p) => [...p, d]);
                        openEditor(d.clientKey);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Nova regra
                    </Button>
                  </div>
                </header>

                {filteredAutomationRules.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-300">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60" aria-hidden />
                        <span className="relative rounded-full bg-emerald-500" aria-hidden />
                      </span>
                      {activeCount} ativa{activeCount === 1 ? "" : "s"}
                    </span>
                    {pausedCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 font-medium text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" aria-hidden />
                        {pausedCount} pausada{pausedCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                )}

                {filteredAutomationRules.length === 0 ? (
                  <Card className="border-dashed border-border/60 bg-muted/10">
                    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
                        <Sliders className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">Nenhuma regra neste canal</p>
                        <p className="max-w-md text-xs text-muted-foreground">
                          Crie uma regra do zero, use um dos templates acima, ou carregue modelos sugeridos.
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          disabled={!canEdit}
                          onClick={() => {
                            const d = newDraft(automationChannel);
                            setRules((p) => [...p, d]);
                            openEditor(d.clientKey);
                          }}
                        >
                          <Plus className="mr-2 h-3.5 w-3.5" />
                          Criar regra
                        </Button>
                        {rules.length === 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            disabled={!canEdit}
                            onClick={() => setRules(buildDefaultAutomationDrafts())}
                          >
                            <Sparkles className="mr-2 h-3.5 w-3.5" />
                            Carregar modelos sugeridos
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filteredAutomationRules.map((r) => (
                      <AutomationRuleSummaryCard
                        key={r.clientKey}
                        rule={r}
                        canEdit={canEdit}
                        savingToggle={togglingKey === r.clientKey}
                        onToggleActive={(v) => void handleToggleRuleActive(r, v)}
                        onEdit={() => openEditor(r.clientKey)}
                        onDelete={() => {
                          if (window.confirm("Remover esta automação?")) removeRule(r.clientKey);
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>

              <div className="sticky bottom-0 z-10 -mx-1 border-t border-border/40 bg-background/95 px-1 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {rules.length} regra{rules.length === 1 ? "" : "s"} no total · salve para aplicar alterações
                  </p>
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
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Histórico ── */}
        <TabsContent value="historico" className="mt-6 space-y-4 outline-none">
          {!performanceAlerts ? (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
                <History className="h-10 w-10 text-muted-foreground/40" aria-hidden />
                <p className="max-w-md">
                  O histórico de execuções é liberado quando o motor de automação está habilitado no plano.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/15 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <History className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">Transparência total</p>
                    <p className="text-xs text-muted-foreground">
                      Registros completos de pausas, ativações, ajustes de orçamento e notificações executadas pelo
                      motor.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-xl"
                  disabled={execLogsLoading}
                  onClick={() => refreshExecLogs()}
                >
                  {execLogsLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Atualizar
                </Button>
              </div>
              <AutomationExecutionTimeline
                items={execLogs}
                loading={execLogsLoading}
                ruleChannelById={ruleChannelById}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
