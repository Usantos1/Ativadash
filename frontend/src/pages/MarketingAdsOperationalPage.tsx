import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  Plus,
  Save,
  Trash2,
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
import { StatusBadge } from "@/components/premium/status-badge";
import {
  dispatchMarketingSettingsRefresh,
  fetchMarketingSettings,
  MARKETING_SETTINGS_REFRESH_EVENT,
  saveMarketingSettings,
  sendAtivaCrmTestMessage,
  evaluateMarketingInsights,
  type AdsChannelKey,
  type BusinessGoalMode,
  type ChannelAutomationsDto,
  type ChannelGoalsDto,
  type ChannelWhatsappAlertsDto,
  type MarketingSettingsDto,
} from "@/lib/marketing-settings-api";
import {
  createAlertRule,
  deleteAlertRule,
  fetchAlertRules,
  patchAlertRule,
  type AlertRuleDto,
  type AlertRuleMetric,
  type AlertRuleOperator,
  type AlertRuleSeverity,
} from "@/lib/alert-rules-api";
import { canUserEditMarketingSettings } from "@/lib/marketing-ads-permissions";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import {
  buildGoogleChannelTotals,
  buildInsightTotals,
  buildMetaChannelTotals,
} from "@/lib/marketing-totals";

const GOAL_LABEL: Record<BusinessGoalMode, string> = {
  LEADS: "Leads",
  SALES: "Vendas",
  HYBRID: "Híbrido",
};

const CH_LABEL: Record<AdsChannelKey, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
};

function formatBrl(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function formatRoas(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}×`;
}

function formatDistanceSafe(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
  } catch {
    return null;
  }
}

function parseOptionalMoney(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) throw new Error("Valor monetário inválido");
  if (n === 0) return null;
  return n;
}

function parseRequiredInt(raw: string, label: string): number {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 500) throw new Error(`${label}: use 1–500`);
  return n;
}

function goalsToStrings(g: Partial<ChannelGoalsDto> | null | undefined) {
  const min =
    typeof g?.minResultsForCpa === "number" && Number.isFinite(g.minResultsForCpa)
      ? Math.min(500, Math.max(1, Math.trunc(g.minResultsForCpa)))
      : 5;
  return {
    targetCpaBrl: g?.targetCpaBrl != null ? String(g.targetCpaBrl) : "",
    maxCpaBrl: g?.maxCpaBrl != null ? String(g.maxCpaBrl) : "",
    targetRoas: g?.targetRoas != null ? String(g.targetRoas) : "",
    minSpendForAlertsBrl: g?.minSpendForAlertsBrl != null ? String(g.minSpendForAlertsBrl) : "",
    minResultsForCpa: String(min),
  };
}

function parseGoalsForm(strings: ReturnType<typeof goalsToStrings>, label: string): ChannelGoalsDto {
  return {
    targetCpaBrl: parseOptionalMoney(strings.targetCpaBrl),
    maxCpaBrl: parseOptionalMoney(strings.maxCpaBrl),
    targetRoas: parseOptionalMoney(strings.targetRoas),
    minSpendForAlertsBrl: parseOptionalMoney(strings.minSpendForAlertsBrl),
    minResultsForCpa: parseRequiredInt(strings.minResultsForCpa, `${label}: mín. resultados`),
  };
}

function MoneyField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          R$
        </span>
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 rounded-xl border-border/60 bg-background/80 pl-10"
        />
      </div>
    </div>
  );
}

function AutomationCard({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  children,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-muted/15 px-4 py-3",
        disabled && "opacity-50"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      </div>
      {checked && children ? <div className="mt-3 border-t border-border/40 pt-3">{children}</div> : null}
    </div>
  );
}

const METRIC_LABEL: Record<AlertRuleMetric, string> = {
  cpa: "CPA (R$)",
  roas: "ROAS (×)",
  spend: "Gasto (R$)",
  ctr: "CTR (%)",
};

const OP_LABEL: Record<AlertRuleOperator, string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  outside_target: "fora da meta",
};

function OperationalAlertRulesCard({
  channel,
  canEdit,
}: {
  channel: AdsChannelKey;
  canEdit: boolean;
}) {
  const [pack, setPack] = useState<{ items: AlertRuleDto[]; performanceAlerts: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [nName, setNName] = useState("");
  const [nMetric, setNMetric] = useState<AlertRuleMetric>("cpa");
  const [nOp, setNOp] = useState<AlertRuleOperator>("gt");
  const [nThreshold, setNThreshold] = useState("");
  const [nSeverity, setNSeverity] = useState<AlertRuleSeverity>("warning");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    fetchAlertRules()
      .then((r) => setPack({ items: r.items, performanceAlerts: r.performanceAlerts }))
      .catch(() => setPack({ items: [], performanceAlerts: false }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!pack) return [];
    return pack.items.filter((r) => {
      const c = (r.appliesToChannel ?? "").toLowerCase();
      if (!c || c === "all") return true;
      return c === channel;
    });
  }, [pack, channel]);

  if (!pack?.performanceAlerts) {
    return (
      <Card className="border-border/50 bg-card/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Regras avançadas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Indisponível no plano atual.</p>
        </CardContent>
      </Card>
    );
  }

  async function handleCreate() {
    setErr(null);
    setOk(null);
    const name = nName.trim();
    const t = parseFloat(nThreshold.replace(",", "."));
    if (!name) {
      setErr("Nome da regra.");
      return;
    }
    if (!Number.isFinite(t)) {
      setErr("Limite inválido.");
      return;
    }
    setCreating(true);
    try {
      await createAlertRule({
        name,
        metric: nMetric,
        operator: nOp,
        threshold: t,
        severity: nSeverity,
        active: true,
        appliesToChannel: channel,
        notifyWhatsapp: true,
      });
      setNName("");
      setNThreshold("");
      setOk("Regra criada.");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="border-border/50 bg-card/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold">Regras avançadas</CardTitle>
        <p className="text-xs text-muted-foreground">
          Condições extras · disparo no painel e WhatsApp (conforme integração). Canal: {CH_LABEL[channel]}.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        {ok ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{ok}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="text-xs"
            disabled={!canEdit}
            onClick={() => {
              setNName("CPL crítico");
              setNMetric("cpa");
              setNOp("gt");
              setNThreshold("50");
              setNSeverity("critical");
            }}
          >
            CPL crítico
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="text-xs"
            disabled={!canEdit}
            onClick={() => {
              setNName("ROAS baixo");
              setNMetric("roas");
              setNOp("lt");
              setNThreshold("2");
              setNSeverity("warning");
            }}
          >
            ROAS baixo
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="text-xs"
            disabled={!canEdit}
            onClick={() => {
              setNName("Gasto alto");
              setNMetric("spend");
              setNOp("gt");
              setNThreshold("5000");
              setNSeverity("warning");
            }}
          >
            Gasto alto
          </Button>
        </div>
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma regra neste canal.</p>
          ) : (
            filtered.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <span className="font-medium">{rule.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {METRIC_LABEL[rule.metric as AlertRuleMetric]} {OP_LABEL[rule.operator as AlertRuleOperator]}{" "}
                    {rule.threshold} · {rule.severity}
                    {rule.appliesToChannel ? ` · ${rule.appliesToChannel}` : ""}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canEdit ? (
                    <>
                      <div className="flex items-center gap-1.5 rounded-md border border-border/40 px-2 py-1">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">WhatsApp</span>
                        <Switch
                          checked={rule.notifyWhatsapp !== false}
                          disabled={busy === rule.id}
                          onCheckedChange={() => {
                            setBusy(rule.id);
                            patchAlertRule(rule.id, {
                              notifyWhatsapp: !(rule.notifyWhatsapp !== false),
                            })
                              .then(() => load())
                              .finally(() => setBusy(null));
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 rounded-md border border-border/40 px-2 py-1">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">Ativa</span>
                        <Switch
                          checked={rule.active}
                          disabled={busy === rule.id}
                          onCheckedChange={() => {
                            setBusy(rule.id);
                            patchAlertRule(rule.id, { active: !rule.active })
                              .then(() => load())
                              .finally(() => setBusy(null));
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        disabled={busy === rule.id}
                        onClick={() => {
                          if (!window.confirm("Excluir regra?")) return;
                          setBusy(rule.id);
                          deleteAlertRule(rule.id)
                            .then(() => load())
                            .finally(() => setBusy(null));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
        {canEdit ? (
          <>
            <Separator />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Nome</Label>
                <Input value={nName} onChange={(e) => setNName(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Métrica</Label>
                <Select value={nMetric} onValueChange={(v) => setNMetric(v as AlertRuleMetric)}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(METRIC_LABEL) as AlertRuleMetric[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {METRIC_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Condição</Label>
                <Select value={nOp} onValueChange={(v) => setNOp(v as AlertRuleOperator)}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(OP_LABEL) as AlertRuleOperator[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {OP_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Limite</Label>
                <Input value={nThreshold} onChange={(e) => setNThreshold(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Severidade</Label>
                <Select value={nSeverity} onValueChange={(v) => setNSeverity(v as AlertRuleSeverity)}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warning">Aviso</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="button" size="sm" className="rounded-xl" disabled={creating} onClick={() => void handleCreate()}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Adicionar regra
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Somente leitura.</p>
        )}
      </CardContent>
    </Card>
  );
}

function channelKpis(
  totals: { totalSpendBrl: number; totalResults: number; totalAttributedValueBrl: number } | null
) {
  if (!totals) return { cpl: null as number | null, roas: null as number | null, spend: 0 };
  const cpl = totals.totalResults > 0 ? totals.totalSpendBrl / totals.totalResults : null;
  const roas =
    totals.totalSpendBrl > 0 && totals.totalAttributedValueBrl > 0
      ? totals.totalAttributedValueBrl / totals.totalSpendBrl
      : null;
  return { cpl, roas, spend: totals.totalSpendBrl };
}

function countAutomationOn(a: ChannelAutomationsDto): number {
  let n = 0;
  if (a.pauseIfCplAboveMax) n++;
  if (a.reduceBudgetIfCplAboveTarget) n++;
  if (a.increaseBudgetIfCplBelowTarget) n++;
  if (a.flagScaleIfCplGood) n++;
  if (a.flagReviewSpendUpConvDown) n++;
  return n;
}

function countWhatsappOn(w: ChannelWhatsappAlertsDto): number {
  let n = 0;
  if (w.cplAboveMax) n++;
  if (w.cplAboveTarget) n++;
  if (w.roasBelowMin) n++;
  if (w.minSpendNoResults) n++;
  if (w.scaleOpportunity) n++;
  if (w.sharpPerformanceDrop) n++;
  if (w.clearAdjustmentOpportunity) n++;
  return n;
}

export function MarketingAdsOperationalPage() {
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const canEdit = useMemo(() => {
    if (!user?.organizationId) return false;
    const r = memberships?.find((m) => m.organizationId === user.organizationId)?.role;
    return canUserEditMarketingSettings(r);
  }, [user?.organizationId, memberships]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("geral");

  const [businessGoalMode, setBusinessGoalMode] = useState<BusinessGoalMode>("HYBRID");
  const [primaryConversionLabel, setPrimaryConversionLabel] = useState("");
  const [showRevenueBlocksInLeadMode, setShowRevenueBlocksInLeadMode] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertCpaAboveMax, setAlertCpaAboveMax] = useState(true);
  const [alertCpaAboveTarget, setAlertCpaAboveTarget] = useState(true);
  const [alertRoasBelowTarget, setAlertRoasBelowTarget] = useState(true);

  const emptyGoalForm = (): ReturnType<typeof goalsToStrings> => ({
    targetCpaBrl: "",
    maxCpaBrl: "",
    targetRoas: "",
    minSpendForAlertsBrl: "",
    minResultsForCpa: "5",
  });
  const [metaGoals, setMetaGoals] = useState(emptyGoalForm);
  const [googleGoals, setGoogleGoals] = useState(emptyGoalForm);

  const [automationsMeta, setAutomationsMeta] = useState<ChannelAutomationsDto | null>(null);
  const [automationsGoogle, setAutomationsGoogle] = useState<ChannelAutomationsDto | null>(null);
  const [whatsappMeta, setWhatsappMeta] = useState<ChannelWhatsappAlertsDto | null>(null);
  const [whatsappGoogle, setWhatsappGoogle] = useState<ChannelWhatsappAlertsDto | null>(null);
  const [whatsappCooldownMin, setWhatsappCooldownMin] = useState("");
  const [tplDefault, setTplDefault] = useState("• *{title}*\n{message}");
  const [tplCustomRule, setTplCustomRule] = useState("");
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestHourLocal, setDigestHourLocal] = useState("9");
  const [digestMinuteLocal, setDigestMinuteLocal] = useState("0");
  const [digestTimezone, setDigestTimezone] = useState("America/Sao_Paulo");
  const [digestExtraPhones, setDigestExtraPhones] = useState("");
  const [sendWaBusy, setSendWaBusy] = useState(false);

  const [crmToken, setCrmToken] = useState(false);
  const [crmPhone, setCrmPhone] = useState<string | null>(null);
  const [, setCrmAlerts] = useState(false);
  const [crmHub, setCrmHub] = useState(false);
  const [crmLastAlertAt, setCrmLastAlertAt] = useState<string | null>(null);
  const [crmLastTestAt, setCrmLastTestAt] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);

  const { metricsLoading, hasGoogle, hasMeta, metrics, metaMetrics } = useMarketingMetrics();

  const metaSlice = useMemo(() => buildMetaChannelTotals(metaMetrics), [metaMetrics]);
  const googleSlice = useMemo(() => buildGoogleChannelTotals(metrics), [metrics]);
  const blended = useMemo(() => buildInsightTotals(metrics, metaMetrics), [metrics, metaMetrics]);

  const metaLive = useMemo(() => channelKpis(metaSlice), [metaSlice]);
  const googleLive = useMemo(() => channelKpis(googleSlice), [googleSlice]);

  const [evalLoading, setEvalLoading] = useState(false);
  const [critCount, setCritCount] = useState(0);
  const [warnCount, setWarnCount] = useState(0);

  useEffect(() => {
    if (!blended) {
      setCritCount(0);
      setWarnCount(0);
      return;
    }
    let cancelled = false;
    setEvalLoading(true);
    const channels: Partial<Record<AdsChannelKey, typeof blended>> = {};
    if (metaSlice) channels.meta = metaSlice;
    if (googleSlice) channels.google = googleSlice;
    evaluateMarketingInsights("30d", blended, undefined, {
      persistOccurrences: false,
      ...(Object.keys(channels).length ? { channels } : {}),
    })
      .then((res) => {
        if (cancelled) return;
        const c = res.alerts.filter((a) => a.severity === "critical").length;
        const w = res.alerts.filter((a) => a.severity === "warning").length;
        setCritCount(c);
        setWarnCount(w);
      })
      .catch(() => {
        if (!cancelled) {
          setCritCount(0);
          setWarnCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setEvalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [blended, metaSlice, googleSlice]);

  const applyDto = useCallback((s: MarketingSettingsDto) => {
    setBusinessGoalMode(s.businessGoalMode);
    setPrimaryConversionLabel(s.primaryConversionLabel?.trim() ?? "");
    setShowRevenueBlocksInLeadMode(s.showRevenueBlocksInLeadMode);
    setAlertsEnabled(s.alertsEnabled);
    setAlertCpaAboveMax(s.alertCpaAboveMax);
    setAlertCpaAboveTarget(s.alertCpaAboveTarget);
    setAlertRoasBelowTarget(s.alertRoasBelowTarget);
    setMetaGoals(goalsToStrings(s.goalsMeta));
    setGoogleGoals(goalsToStrings(s.goalsGoogle));
    setAutomationsMeta(s.automationsMeta);
    setAutomationsGoogle(s.automationsGoogle);
    setWhatsappMeta(s.whatsappAlertsMeta);
    setWhatsappGoogle(s.whatsappAlertsGoogle);
    setWhatsappCooldownMin(
      s.whatsappAlertCooldownMinutes != null ? String(s.whatsappAlertCooldownMinutes) : ""
    );
    setCrmToken(s.ativaCrmTokenConfigured);
    setCrmPhone(s.ativaCrmNotifyPhone);
    setCrmAlerts(s.ativaCrmAlertsEnabled);
    setCrmHub(s.ativaCrmHubConnected);
    setCrmLastAlertAt(s.ativaCrmLastAlertSentAt ?? null);
    setCrmLastTestAt(s.ativaCrmLastTestSentAt ?? null);
    const tm = s.whatsappMessageTemplates ?? {};
    setTplDefault(tm.default ?? "• *{title}*\n{message}");
    setTplCustomRule(tm.CUSTOM_RULE ?? "");
    const dg = s.whatsappDigestSchedule;
    setDigestEnabled(dg.enabled);
    setDigestHourLocal(String(dg.hourLocal ?? dg.hourUtc));
    setDigestMinuteLocal(String(dg.minuteLocal ?? dg.minuteUtc));
    setDigestTimezone(dg.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo");
    setDigestExtraPhones(dg.extraPhones?.length ? dg.extraPhones.join(", ") : "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMarketingSettings()
      .then((s) => {
        if (!cancelled) applyDto(s);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar as configurações.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyDto]);

  useEffect(() => {
    const onRefresh = () => {
      fetchMarketingSettings().then(applyDto).catch(() => {});
    };
    window.addEventListener(MARKETING_SETTINGS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(MARKETING_SETTINGS_REFRESH_EVENT, onRefresh);
  }, [applyDto]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSavedMsg(null);
    setError(null);
    if (!automationsMeta || !automationsGoogle || !whatsappMeta || !whatsappGoogle) {
      setError("Dados incompletos — recarregue a página.");
      return;
    }
    let metaParsed: ChannelGoalsDto;
    let googleParsed: ChannelGoalsDto;
    let cd: number | null = null;
    try {
      metaParsed = parseGoalsForm(metaGoals, "Meta");
      googleParsed = parseGoalsForm(googleGoals, "Google");
      if (metaParsed.targetCpaBrl != null && metaParsed.maxCpaBrl != null && metaParsed.targetCpaBrl > metaParsed.maxCpaBrl) {
        setError("Meta: CPL alvo não pode ser maior que o máximo.");
        return;
      }
      if (
        googleParsed.targetCpaBrl != null &&
        googleParsed.maxCpaBrl != null &&
        googleParsed.targetCpaBrl > googleParsed.maxCpaBrl
      ) {
        setError("Google: CPL alvo não pode ser maior que o máximo.");
        return;
      }
      if (whatsappCooldownMin.trim()) {
        const n = Number.parseInt(whatsappCooldownMin.trim(), 10);
        if (!Number.isFinite(n) || n < 5 || n > 1440) throw new Error("Cooldown: 5–1440 minutos.");
        cd = n;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Valores inválidos.");
      return;
    }

    setSaving(true);
    try {
      await saveMarketingSettings({
        businessGoalMode,
        primaryConversionLabel: primaryConversionLabel.trim() ? primaryConversionLabel.trim() : null,
        showRevenueBlocksInLeadMode,
        alertsEnabled,
        alertCpaAboveMax,
        alertCpaAboveTarget,
        alertRoasBelowTarget,
        targetCpaBrl: metaParsed.targetCpaBrl,
        maxCpaBrl: metaParsed.maxCpaBrl,
        targetRoas: metaParsed.targetRoas,
        minResultsForCpa: metaParsed.minResultsForCpa,
        minSpendForAlertsBrl: metaParsed.minSpendForAlertsBrl,
        goalsByChannel: {
          meta: {
            targetCpaBrl: metaParsed.targetCpaBrl,
            maxCpaBrl: metaParsed.maxCpaBrl,
            targetRoas: metaParsed.targetRoas,
            minSpendForAlertsBrl: metaParsed.minSpendForAlertsBrl,
            minResultsForCpa: metaParsed.minResultsForCpa,
          },
          google: {
            targetCpaBrl: googleParsed.targetCpaBrl,
            maxCpaBrl: googleParsed.maxCpaBrl,
            targetRoas: googleParsed.targetRoas,
            minSpendForAlertsBrl: googleParsed.minSpendForAlertsBrl,
            minResultsForCpa: googleParsed.minResultsForCpa,
          },
        },
        automationsByChannel: { meta: automationsMeta, google: automationsGoogle },
        whatsappAlertsByChannel: { meta: whatsappMeta, google: whatsappGoogle },
        whatsappAlertCooldownMinutes: cd,
        whatsappMessageTemplates: (() => {
          const o: Record<string, string> = {};
          if (tplDefault.trim()) o.default = tplDefault.trim();
          if (tplCustomRule.trim()) o.CUSTOM_RULE = tplCustomRule.trim();
          return o;
        })(),
        whatsappDigestSchedule: {
          enabled: digestEnabled,
          hourLocal: Math.min(23, Math.max(0, Number.parseInt(digestHourLocal, 10) || 9)),
          minuteLocal: Math.min(59, Math.max(0, Number.parseInt(digestMinuteLocal, 10) || 0)),
          timezone: digestTimezone.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone,
          extraPhones: digestExtraPhones
            .split(/[;,]/)
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 5),
        },
      });
      setSavedMsg("Configurações salvas.");
      dispatchMarketingSettingsRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestWhatsapp() {
    setTestBusy(true);
    setError(null);
    try {
      const r = await sendAtivaCrmTestMessage("Teste Ativa Dash — metas e alertas.");
      if (!r.ok) setError(r.message);
      else setSavedMsg("Teste enviado.");
      fetchMarketingSettings().then(applyDto).catch(() => {});
    } finally {
      setTestBusy(false);
    }
  }

  async function handleSendWhatsappNow() {
    if (!blended) {
      setError("Sem métricas agregadas para avaliar. Conecte Meta/Google e aguarde a sincronização.");
      return;
    }
    setSendWaBusy(true);
    setError(null);
    setSavedMsg(null);
    try {
      const channels: Partial<Record<AdsChannelKey, typeof blended>> = {};
      if (metaSlice) channels.meta = metaSlice;
      if (googleSlice) channels.google = googleSlice;
      await evaluateMarketingInsights("30d", blended, undefined, {
        persistOccurrences: false,
        ...(Object.keys(channels).length ? { channels } : {}),
        sendWhatsappAlerts: true,
      });
      setSavedMsg(
        "Avaliação enviada. Se houver alertas acionáveis e o intervalo por tipo de alerta permitir, o WhatsApp recebe a mensagem."
      );
      fetchMarketingSettings().then(applyDto).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível disparar o envio.");
    } finally {
      setSendWaBusy(false);
    }
  }

  const autoMetaOn = automationsMeta ? countAutomationOn(automationsMeta) : 0;
  const autoGoogleOn = automationsGoogle ? countAutomationOn(automationsGoogle) : 0;
  const waMetaOn = whatsappMeta ? countWhatsappOn(whatsappMeta) : 0;
  const waGoogleOn = whatsappGoogle ? countWhatsappOn(whatsappGoogle) : 0;

  if (loading || !automationsMeta || !automationsGoogle || !whatsappMeta || !whatsappGoogle) {
    return (
      <div className="w-full space-y-6 pb-12">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  function patchAuto(ch: AdsChannelKey, patch: Partial<ChannelAutomationsDto>) {
    if (ch === "meta") {
      setAutomationsMeta((prev) => ({ ...(prev as ChannelAutomationsDto), ...patch }));
    } else {
      setAutomationsGoogle((prev) => ({ ...(prev as ChannelAutomationsDto), ...patch }));
    }
  }

  function patchWa(ch: AdsChannelKey, patch: Partial<ChannelWhatsappAlertsDto>) {
    if (ch === "meta") {
      setWhatsappMeta((prev) => ({ ...(prev as ChannelWhatsappAlertsDto), ...patch }));
    } else {
      setWhatsappGoogle((prev) => ({ ...(prev as ChannelWhatsappAlertsDto), ...patch }));
    }
  }

  function ChannelPanel({ ch }: { ch: AdsChannelKey }) {
    const goals = ch === "meta" ? metaGoals : googleGoals;
    const setGoals = ch === "meta" ? setMetaGoals : setGoogleGoals;
    const auto = (ch === "meta" ? automationsMeta : automationsGoogle) as ChannelAutomationsDto;
    const wa = (ch === "meta" ? whatsappMeta : whatsappGoogle) as ChannelWhatsappAlertsDto;
    const live = ch === "meta" ? metaLive : googleLive;
    const connected = ch === "meta" ? hasMeta : hasGoogle;
    const lastAlertRel = formatDistanceSafe(crmLastAlertAt);
    const lastTestRel = formatDistanceSafe(crmLastTestAt);

    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">CPL atual</p>
            <p className="text-lg font-bold tabular-nums">{formatBrl(live.cpl)}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">ROAS atual</p>
            <p className="text-lg font-bold tabular-nums">{formatRoas(live.roas)}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Gasto</p>
            <p className="text-lg font-bold tabular-nums">{formatBrl(live.spend)}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Integração</p>
            <p className="text-sm font-semibold">{connected ? "Conectada" : "Não conectada"}</p>
          </div>
        </div>

        <Card className="border-border/50 bg-card/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Metas do canal</CardTitle>
            <p className="text-xs text-muted-foreground">Somente {CH_LABEL[ch]} — não mistura com o outro canal.</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MoneyField
              id={`${ch}-target`}
              label="CPL alvo"
              value={goals.targetCpaBrl}
              disabled={!canEdit}
              onChange={(v) => setGoals((g) => ({ ...g, targetCpaBrl: v }))}
            />
            <MoneyField
              id={`${ch}-max`}
              label="CPL máximo"
              value={goals.maxCpaBrl}
              disabled={!canEdit}
              onChange={(v) => setGoals((g) => ({ ...g, maxCpaBrl: v }))}
            />
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase text-muted-foreground">ROAS mínimo</Label>
              <Input
                inputMode="decimal"
                value={goals.targetRoas}
                disabled={!canEdit}
                onChange={(e) => setGoals((g) => ({ ...g, targetRoas: e.target.value }))}
                className="h-10 rounded-xl"
              />
            </div>
            <MoneyField
              id={`${ch}-minspend`}
              label="Gasto mínimo p/ alertas"
              value={goals.minSpendForAlertsBrl}
              disabled={!canEdit}
              onChange={(v) => setGoals((g) => ({ ...g, minSpendForAlertsBrl: v }))}
            />
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase text-muted-foreground">Mín. resultados p/ CPA</Label>
              <Input
                inputMode="numeric"
                value={goals.minResultsForCpa}
                disabled={!canEdit}
                onChange={(e) => setGoals((g) => ({ ...g, minResultsForCpa: e.target.value }))}
                className="h-10 rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Automações</CardTitle>
            <p className="text-xs text-muted-foreground">
              Preferências gravadas · execução no painel/campanhas evolui conforme o produto.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <AutomationCard
              title="Pausar campanha se CPL passar do máximo"
              description="Sinaliza pausa quando o CPL ultrapassa o teto configurado nas metas."
              checked={auto.pauseIfCplAboveMax}
              disabled={!canEdit}
              onCheckedChange={(v) => patchAuto(ch, { pauseIfCplAboveMax: v })}
            >
              <Label className="text-xs">Considerar só após N resultados (opcional)</Label>
              <Input
                className="mt-1 h-9 max-w-[120px] rounded-lg"
                inputMode="numeric"
                placeholder="ex: 20"
                value={auto.pauseIfCplAboveMaxMinResults ?? ""}
                disabled={!canEdit}
                onChange={(e) => {
                  const t = e.target.value.trim();
                  patchAuto(ch, {
                    pauseIfCplAboveMaxMinResults: t === "" ? null : Number.parseInt(t, 10) || null,
                  });
                }}
              />
            </AutomationCard>
            <AutomationCard
              title="Reduzir orçamento se CPL acima da meta"
              description="Marca necessidade de redução quando CPL piora vs. alvo."
              checked={auto.reduceBudgetIfCplAboveTarget}
              disabled={!canEdit}
              onCheckedChange={(v) => patchAuto(ch, { reduceBudgetIfCplAboveTarget: v })}
            >
              <Label className="text-xs">% de redução sugerido (opcional)</Label>
              <Input
                className="mt-1 h-9 max-w-[100px] rounded-lg"
                inputMode="decimal"
                value={auto.reduceBudgetPercent ?? ""}
                disabled={!canEdit}
                onChange={(e) => {
                  const t = e.target.value.trim();
                  patchAuto(ch, {
                    reduceBudgetPercent: t === "" ? null : Number(t.replace(",", ".")) || null,
                  });
                }}
              />
            </AutomationCard>
            <AutomationCard
              title="Aumentar orçamento se CPL abaixo da meta"
              description="Indica folga para escalar quando CPL está melhor que o alvo."
              checked={auto.increaseBudgetIfCplBelowTarget}
              disabled={!canEdit}
              onCheckedChange={(v) => patchAuto(ch, { increaseBudgetIfCplBelowTarget: v })}
            >
              <Label className="text-xs">% de aumento sugerido (opcional)</Label>
              <Input
                className="mt-1 h-9 max-w-[100px] rounded-lg"
                inputMode="decimal"
                value={auto.increaseBudgetPercent ?? ""}
                disabled={!canEdit}
                onChange={(e) => {
                  const t = e.target.value.trim();
                  patchAuto(ch, {
                    increaseBudgetPercent: t === "" ? null : Number(t.replace(",", ".")) || null,
                  });
                }}
              />
            </AutomationCard>
            <AutomationCard
              title="Sinalizar escala (CPL muito bom)"
              description="Destaca quando o CPL está confortável abaixo da meta."
              checked={auto.flagScaleIfCplGood}
              disabled={!canEdit}
              onCheckedChange={(v) => patchAuto(ch, { flagScaleIfCplGood: v })}
            />
            <AutomationCard
              title="Sinalizar revisão (gasto sobe e conversão cai)"
              description="Marca campanhas para revisão operacional quando o padrão aparecer nos dados."
              checked={auto.flagReviewSpendUpConvDown}
              disabled={!canEdit}
              onCheckedChange={(v) => patchAuto(ch, { flagReviewSpendUpConvDown: v })}
            />
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Alertas via WhatsApp</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ativa CRM · eventos abaixo disparam mensagem quando a integração estiver ativa.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-3 py-2 text-sm">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span className={crmHub ? "font-medium text-emerald-600" : "text-muted-foreground"}>
                {crmHub ? "WhatsApp / CRM pronto" : "Configure token e número em Integrações"}
              </span>
              {lastAlertRel ? (
                <span className="text-xs text-muted-foreground">Último alerta: {lastAlertRel}</span>
              ) : null}
              {lastTestRel ? (
                <span className="text-xs text-muted-foreground">Último teste: {lastTestRel}</span>
              ) : null}
            </div>
            <div className="space-y-2">
              {(
                [
                  ["cplAboveMax", "CPL acima do máximo", "cplAboveMax"],
                  ["cplAboveTarget", "CPL acima da meta", "cplAboveTarget"],
                  ["roasBelowMin", "ROAS abaixo do mínimo", "roasBelowMin"],
                  ["minSpendNoResults", "Gasto mínimo sem resultado suficiente", "minSpendNoResults"],
                  ["scaleOpportunity", "Oportunidade de escala (CPL muito bom)", "scaleOpportunity"],
                  ["sharpPerformanceDrop", "Queda brusca de desempenho", "sharpPerformanceDrop"],
                  ["clearAdjustmentOpportunity", "Oportunidade clara de ajuste", "clearAdjustmentOpportunity"],
                ] as const
              ).map(([key, label, field]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/50 px-3 py-2"
                >
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={Boolean(wa[field as keyof ChannelWhatsappAlertsDto])}
                    disabled={!canEdit}
                    onCheckedChange={(v) => patchWa(ch, { [field]: v } as Partial<ChannelWhatsappAlertsDto>)}
                  />
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Usar número padrão da integração</p>
                <p className="text-xs text-muted-foreground">{crmPhone ?? "—"}</p>
              </div>
              <Switch
                checked={wa.useIntegrationPhone}
                disabled={!canEdit}
                onCheckedChange={(v) => patchWa(ch, { useIntegrationPhone: v })}
              />
            </div>
            {!wa.useIntegrationPhone ? (
              <div className="space-y-1">
                <Label className="text-xs">Número alternativo (DDD + número)</Label>
                <Input
                  value={wa.overridePhone ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => patchWa(ch, { overridePhone: e.target.value.trim() || null })}
                  className="h-10 max-w-xs rounded-xl"
                />
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Silêncio UTC — início (0–23)</Label>
                <Input
                  inputMode="numeric"
                  value={wa.muteStartHourUtc ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const t = e.target.value.trim();
                    patchWa(ch, { muteStartHourUtc: t === "" ? null : Number.parseInt(t, 10) });
                  }}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Silêncio UTC — fim (0–23)</Label>
                <Input
                  inputMode="numeric"
                  value={wa.muteEndHourUtc ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const t = e.target.value.trim();
                    patchWa(ch, { muteEndHourUtc: t === "" ? null : Number.parseInt(t, 10) });
                  }}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={testBusy || !crmToken}
              onClick={() => void handleTestWhatsapp()}
            >
              {testBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Testar envio WhatsApp
            </Button>
          </CardContent>
        </Card>

        <OperationalAlertRulesCard channel={ch} canEdit={canEdit} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="w-full space-y-6 pb-28">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" asChild>
          <Link to="/marketing">
            <ArrowLeft className="h-4 w-4" />
            Painel ADS
          </Link>
        </Button>
      </div>

      <PageHeaderPremium
        eyebrow="Operação"
        breadcrumbs={[
          { label: "Painel ADS", href: "/marketing" },
          { label: "Metas, automações e alertas" },
        ]}
        title="Metas, automações e alertas"
        subtitle="Por canal: metas numéricas, automações, WhatsApp e regras avançadas."
        meta={
          <span className="inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/30 px-2 py-1">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              Modo · {GOAL_LABEL[businessGoalMode]}
            </span>
            <StatusBadge tone={alertsEnabled ? "healthy" : "neutral"} dot>
              Alertas painel {alertsEnabled ? "on" : "off"}
            </StatusBadge>
            <StatusBadge tone={crmHub ? "healthy" : "neutral"} dot>
              WhatsApp {crmHub ? "ok" : "pendente"}
            </StatusBadge>
            {evalLoading ? (
              <span className="text-muted-foreground">Analisando…</span>
            ) : (
              <span>
                Alertas: {critCount} crít. · {warnCount} aviso
              </span>
            )}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" asChild>
              <Link to="/marketing/integracoes">
                Integrações
                <ChevronRight className="ml-0.5 h-4 w-4 opacity-60" />
              </Link>
            </Button>
            <Button size="sm" className="rounded-lg" asChild>
              <Link to="/marketing">
                <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
                Painel ADS
              </Link>
            </Button>
          </div>
        }
        className="border-b border-border/45 pb-5"
      />

      {error ? (
        <div className="rounded-xl border border-destructive/35 bg-destructive/[0.08] px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {savedMsg ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3 text-sm font-medium text-emerald-900 dark:text-emerald-200">
          {savedMsg}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-6">
        <div className="rounded-xl border border-border/50 bg-muted/15 p-3 lg:col-span-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Meta · CPL</p>
          <p className="text-sm font-bold tabular-nums">{formatBrl(metaLive.cpl)}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/15 p-3 lg:col-span-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Google · CPL</p>
          <p className="text-sm font-bold tabular-nums">{formatBrl(googleLive.cpl)}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/15 p-3 lg:col-span-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Meta · ROAS</p>
          <p className="text-sm font-bold tabular-nums">{formatRoas(metaLive.roas)}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/15 p-3 lg:col-span-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Google · ROAS</p>
          <p className="text-sm font-bold tabular-nums">{formatRoas(googleLive.roas)}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/15 p-3 lg:col-span-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Gasto Meta / Google</p>
          <p className="text-xs font-semibold tabular-nums">
            {formatBrl(metaLive.spend)} · {formatBrl(googleLive.spend)}
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/15 p-3 lg:col-span-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Automações / WhatsApp</p>
          <p className="text-sm font-bold">
            {autoMetaOn + autoGoogleOn}{" "}
            <span className="text-xs font-normal text-muted-foreground">auto</span>
            {" · "}
            {waMetaOn + waGoogleOn}{" "}
            <span className="text-xs font-normal text-muted-foreground">WA</span>
          </p>
        </div>
      </div>
      {metricsLoading ? <p className="text-xs text-muted-foreground">Sincronizando métricas…</p> : null}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid h-auto w-full max-w-xl grid-cols-3 rounded-xl bg-muted/40 p-1">
          <TabsTrigger value="geral" className="rounded-lg text-xs sm:text-sm">
            Geral
          </TabsTrigger>
          <TabsTrigger value="meta" className="rounded-lg text-xs sm:text-sm">
            Meta Ads
          </TabsTrigger>
          <TabsTrigger value="google" className="rounded-lg text-xs sm:text-sm">
            Google Ads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-6 space-y-6">
          <Card className="border-border/50 bg-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Conta e alertas no painel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Modo de negócio</Label>
                  <Select
                    value={businessGoalMode}
                    disabled={!canEdit}
                    onValueChange={(v) => setBusinessGoalMode(v as BusinessGoalMode)}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEADS">Leads</SelectItem>
                      <SelectItem value="SALES">Vendas</SelectItem>
                      <SelectItem value="HYBRID">Híbrido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Rótulo da conversão principal</Label>
                  <Input
                    value={primaryConversionLabel}
                    disabled={!canEdit}
                    onChange={(e) => setPrimaryConversionLabel(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
                <span className="text-sm">Mostrar blocos de receita no modo leads</span>
                <Switch
                  checked={showRevenueBlocksInLeadMode}
                  disabled={!canEdit}
                  onCheckedChange={setShowRevenueBlocksInLeadMode}
                />
              </div>
              <Separator />
              <p className="text-xs font-semibold uppercase text-muted-foreground">Motor de alertas (painel)</p>
              <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
                <span className="text-sm">Alertas de metas ativos</span>
                <Switch checked={alertsEnabled} disabled={!canEdit} onCheckedChange={setAlertsEnabled} />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2">
                  <span className="text-xs">CPA acima do máximo</span>
                  <Switch
                    checked={alertCpaAboveMax}
                    disabled={!canEdit || !alertsEnabled}
                    onCheckedChange={setAlertCpaAboveMax}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2">
                  <span className="text-xs">CPA acima da meta</span>
                  <Switch
                    checked={alertCpaAboveTarget}
                    disabled={!canEdit || !alertsEnabled}
                    onCheckedChange={setAlertCpaAboveTarget}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2">
                  <span className="text-xs">ROAS abaixo da meta</span>
                  <Switch
                    checked={alertRoasBelowTarget}
                    disabled={!canEdit || !alertsEnabled}
                    onCheckedChange={setAlertRoasBelowTarget}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Colunas legadas de metas são preenchidas com os valores de Meta ao salvar (compatível com totais combinados em outros pontos do app).
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">WhatsApp — envio controlado</CardTitle>
              <p className="text-xs text-muted-foreground">
                Abrir o painel <span className="font-medium text-foreground">não</span> dispara mais WhatsApp automaticamente.
                Só enviamos quando você usar o botão abaixo, um cron externo com{" "}
                <code className="rounded bg-muted px-1">sendWhatsappAlerts: true</code>, ou quando integrarmos o resumo
                diário no servidor.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
                  disabled={sendWaBusy || !crmHub}
                  onClick={() => void handleSendWhatsappNow()}
                >
                  {sendWaBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Enviar alertas agora (WhatsApp)
                </Button>
                {!crmHub ? (
                  <span className="self-center text-xs text-muted-foreground">Conecte Ativa CRM nas Integrações.</span>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  Intervalo mínimo <span className="font-medium">por tipo de alerta</span> (minutos, 5–1440)
                </Label>
                <Input
                  className="h-10 max-w-[200px] rounded-xl"
                  placeholder="padrão 360 (6 h)"
                  value={whatsappCooldownMin}
                  disabled={!canEdit}
                  onChange={(e) => setWhatsappCooldownMin(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Cada regra ou código (ex.: <code className="rounded bg-muted px-1">CUSTOM_RULE:…</code>) só volta a
                  notificar após esse tempo.
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Modelos de mensagem</p>
                <p className="text-[11px] text-muted-foreground">
                  Variáveis: <code className="rounded bg-muted px-1">{"{title}"}</code>,{" "}
                  <code className="rounded bg-muted px-1">{"{message}"}</code>,{" "}
                  <code className="rounded bg-muted px-1">{"{period}"}</code>,{" "}
                  <code className="rounded bg-muted px-1">{"{channel}"}</code>,{" "}
                  <code className="rounded bg-muted px-1">{"{code}"}</code>
                </p>
                <div className="space-y-1">
                  <Label className="text-xs">Padrão (todos os alertas)</Label>
                  <textarea
                    className="min-h-[72px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={tplDefault}
                    disabled={!canEdit}
                    onChange={(e) => setTplDefault(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Regras customizadas (chave CUSTOM_RULE)</Label>
                  <textarea
                    className="min-h-[72px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Opcional — se vazio, usa o padrão acima."
                    value={tplCustomRule}
                    disabled={!canEdit}
                    onChange={(e) => setTplCustomRule(e.target.value)}
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Resumo diário (preferências)</p>
                <p className="text-[11px] text-muted-foreground">
                  Horário no seu fuso ({digestTimezone}). O agendamento no servidor usa a conversão automática; enquanto o
                  job não existir, use o botão &quot;Enviar alertas agora&quot; ou integre via API com{" "}
                  <code className="rounded bg-muted px-1">sendWhatsappAlerts: true</code>.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={digestEnabled} disabled={!canEdit} onCheckedChange={setDigestEnabled} />
                    <span className="text-sm">Ativar resumo diário (quando o job existir)</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Hora (0–23)</Label>
                    <Input
                      className="h-10 w-20 rounded-xl"
                      inputMode="numeric"
                      value={digestHourLocal}
                      disabled={!canEdit}
                      onChange={(e) => setDigestHourLocal(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Minuto (0–59)</Label>
                    <Input
                      className="h-10 w-20 rounded-xl"
                      inputMode="numeric"
                      value={digestMinuteLocal}
                      disabled={!canEdit}
                      onChange={(e) => setDigestMinuteLocal(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Números extras (vírgula ou ponto e vírgula, máx. 5)</Label>
                  <Input
                    className="h-10 max-w-md rounded-xl"
                    placeholder="5511999999999"
                    value={digestExtraPhones}
                    disabled={!canEdit}
                    onChange={(e) => setDigestExtraPhones(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Token e número padrão: Integrações → Ativa CRM. CPA máximo <span className="font-medium">por campanha</span>{" "}
                exige vínculo com IDs de campanha nos dados — próximo passo no produto; hoje use regras avançadas por
                canal e limite numérico.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meta" className="mt-6">
          <ChannelPanel ch="meta" />
        </TabsContent>

        <TabsContent value="google" className="mt-6">
          <ChannelPanel ch="google" />
        </TabsContent>
      </Tabs>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/95 px-4 py-3 backdrop-blur md:pl-[var(--sidebar-width,0px)]">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-2">
          <Button type="submit" disabled={saving || !canEdit} className="rounded-xl">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar configurações
          </Button>
        </div>
      </div>
    </form>
  );
}
