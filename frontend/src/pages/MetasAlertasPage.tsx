import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { canUserEditMarketingSettings } from "@/lib/marketing-ads-permissions";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { AutomationExecutionTimeline } from "@/components/metas-automation/AutomationExecutionTimeline";
import { AutomationRuleSummaryCard } from "@/components/metas-automation/AutomationRuleSummaryCard";
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

export function MetasAlertasPage() {
  usePageTitle(formatPageTitle(["Automação e Metas"]));
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
    void fetchAutomationExecutionLogs(150)
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
      setOk("Automações salvas.");
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
        subtitle="Metas globais, regras compactas com editor lateral e histórico de execuções do motor."
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
        <TabsList className="grid h-auto w-full max-w-4xl grid-cols-3 rounded-xl border border-border/40 bg-muted/30 p-1">
          <TabsTrigger value="metas" className="rounded-lg text-xs sm:text-sm">
            Metas globais
          </TabsTrigger>
          <TabsTrigger value="regras" className="rounded-lg text-xs sm:text-sm">
            Motor de automações
          </TabsTrigger>
          <TabsTrigger value="historico" className="rounded-lg text-xs sm:text-sm">
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metas" className="mt-6">
          <form onSubmit={handleSaveMetas} className="space-y-4">
            <Card className="border-border/50 bg-card shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Configurações gerais</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Define como o painel interpreta conversões e exibe métricas.
                </p>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Modo de negócio
                  </Label>
                  <Select
                    value={businessGoalMode}
                    disabled={!canEdit}
                    onValueChange={(v) => setBusinessGoalMode(v as BusinessGoalMode)}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEADS">Leads (geração de contatos)</SelectItem>
                      <SelectItem value="SALES">Vendas (e-commerce / ROAS)</SelectItem>
                      <SelectItem value="HYBRID">Híbrido (leads + vendas)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Altera os indicadores em destaque no cockpit e nas automações.
                  </p>
                </div>
              </CardContent>
            </Card>
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
              <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent px-4 py-3 text-sm">
                <strong className="text-foreground">Cérebro autónomo:</strong>{" "}
                <span className="text-muted-foreground">
                  cartões resumidos à esquerda; <span className="font-medium text-foreground">Editar</span> abre o
                  construtor (QUANDO / SE / ENTÃO / ONDE). Salve todas as alterações no fim da página.
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Templates (1 clique → editor pré-preenchido)
                </div>
                <p className="text-xs text-muted-foreground">
                  Canal atual:{" "}
                  <strong className="text-foreground">{automationChannel === "meta" ? "Meta Ads" : "Google Ads"}</strong>.
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <Card className="border-border/50 bg-card shadow-sm">
                    <CardHeader className="space-y-1 pb-2">
                      <CardTitle className="text-sm font-semibold">Stop-Loss</CardTitle>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        CPL acima do teto → pausar anúncio + notificar.
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full rounded-xl"
                        disabled={!canEdit}
                        onClick={() => applyTemplate(() => optimizationProfileDraftStopLoss(automationChannel))}
                      >
                        Abrir no editor
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 bg-card shadow-sm">
                    <CardHeader className="space-y-1 pb-2">
                      <CardTitle className="text-sm font-semibold">Take-Profit</CardTitle>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        ROAS acima da meta → escalar orçamento (% configurável).
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full rounded-xl"
                        disabled={!canEdit}
                        onClick={() => applyTemplate(() => optimizationProfileDraftTakeProfit(automationChannel))}
                      >
                        Abrir no editor
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 bg-card shadow-sm">
                    <CardHeader className="space-y-1 pb-2">
                      <CardTitle className="text-sm font-semibold">Desmame</CardTitle>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        CPL na faixa entre alvo e teto → reduzir orçamento.
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full rounded-xl"
                        disabled={!canEdit}
                        onClick={() => applyTemplate(() => optimizationProfileDraftDesmame(automationChannel))}
                      >
                        Abrir no editor
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
                    Meta Ads
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
                    Google Ads
                  </button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
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

              {filteredAutomationRules.length === 0 ? (
                <Card className="border-dashed border-border/60 bg-muted/10">
                  <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <Zap className="h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma regra para este canal (regras “todos os canais” aparecem nas duas abas).
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => {
                          const d = newDraft(automationChannel);
                          setRules((p) => [...p, d]);
                          openEditor(d.clientKey);
                        }}
                      >
                        Criar regra
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

              <div className="flex justify-end pt-2">
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
              <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/15 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 flex-1">
                  <ScrollText className="mr-2 inline h-4 w-4 align-text-bottom text-primary" />
                  <strong className="text-foreground">Transparência:</strong> leitura segura dos registos do motor
                  (pausa, ativar, escala, notificação). O canal é inferido pela regra quando possível.
                </p>
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
