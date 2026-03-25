import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  fetchMarketingSettings,
  saveMarketingSettings,
  type BusinessGoalMode,
  type MarketingSettingsDto,
} from "@/lib/marketing-settings-api";
import {
  createAlertRule,
  deleteAlertRule,
  fetchAlertOccurrences,
  fetchAlertRules,
  patchAlertRule,
  type AlertOccurrenceDto,
  type AlertRuleDto,
  type AlertRuleMetric,
  type AlertRuleOperator,
  type AlertRuleSeverity,
} from "@/lib/alert-rules-api";
import { canUserEditMarketingSettings } from "@/lib/marketing-ads-permissions";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

function dtoToForm(s: MarketingSettingsDto) {
  return {
    businessGoalMode: s.businessGoalMode,
    primaryConversionLabel: s.primaryConversionLabel?.trim() ?? "",
    showRevenueBlocksInLeadMode: s.showRevenueBlocksInLeadMode,
    targetCpaBrl: s.targetCpaBrl != null ? String(s.targetCpaBrl) : "",
    maxCpaBrl: s.maxCpaBrl != null ? String(s.maxCpaBrl) : "",
    targetRoas: s.targetRoas != null ? String(s.targetRoas) : "",
    minResultsForCpa: String(s.minResultsForCpa),
    minSpendForAlertsBrl: s.minSpendForAlertsBrl != null ? String(s.minSpendForAlertsBrl) : "",
    alertsEnabled: s.alertsEnabled,
    alertCpaAboveMax: s.alertCpaAboveMax,
    alertCpaAboveTarget: s.alertCpaAboveTarget,
    alertRoasBelowTarget: s.alertRoasBelowTarget,
  };
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
  if (!Number.isFinite(n) || n < 1 || n > 500) throw new Error(`${label} deve ser entre 1 e 500`);
  return n;
}

function formatBrlPreview(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

const GOAL_LABEL: Record<BusinessGoalMode, string> = {
  LEADS: "Leads",
  SALES: "Vendas",
  HYBRID: "Híbrido",
};

function MoneyInput({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
          R$
        </span>
        <Input
          id={id}
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 rounded-xl border-border/60 bg-background/80 pl-10 shadow-sm focus-visible:border-primary/40"
        />
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Bloco alinhado ao Painel ADS — borda suave, cabeçalho tipo cockpit. */
function AdsSettingsSection({
  kicker = "ADS",
  title,
  children,
  className,
  headerRight,
}: {
  kicker?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-[var(--shadow-surface-sm)]",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-muted/15 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{kicker}</p>
          <h2 className="text-base font-black tracking-tight text-foreground">{title}</h2>
        </div>
        {headerRight}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

function AlertRuleRow({
  id,
  title,
  subtitle,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  title: string;
  subtitle?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3",
        disabled && "opacity-45"
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p id={`${id}-label`} className="text-sm font-medium text-foreground">
          {title}
        </p>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
      />
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
  gt: "maior que (>)",
  gte: "maior ou igual (≥)",
  lt: "menor que (<)",
  lte: "menor ou igual (≤)",
};

function CustomAlertRulesPanel() {
  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const canEdit = useMemo(() => {
    if (!user?.organizationId) return false;
    const r = memberships?.find((m) => m.organizationId === user.organizationId)?.role;
    return canUserEditMarketingSettings(r);
  }, [user?.organizationId, memberships]);

  const [pack, setPack] = useState<{ items: AlertRuleDto[]; performanceAlerts: boolean } | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [panelErr, setPanelErr] = useState<string | null>(null);
  const [panelOk, setPanelOk] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [nName, setNName] = useState("");
  const [nMetric, setNMetric] = useState<AlertRuleMetric>("cpa");
  const [nOp, setNOp] = useState<AlertRuleOperator>("gt");
  const [nThreshold, setNThreshold] = useState("");
  const [nSeverity, setNSeverity] = useState<AlertRuleSeverity>("warning");
  const [nMuteA, setNMuteA] = useState("");
  const [nMuteB, setNMuteB] = useState("");
  const [creating, setCreating] = useState(false);
  const [occurrences, setOccurrences] = useState<AlertOccurrenceDto[]>([]);

  const load = useCallback(() => {
    setLoadErr(null);
    fetchAlertRules()
      .then(async (r) => {
        setPack({ items: r.items, performanceAlerts: r.performanceAlerts });
        if (r.performanceAlerts) {
          try {
            const o = await fetchAlertOccurrences(25);
            setOccurrences(o.items);
          } catch {
            setOccurrences([]);
          }
        } else {
          setOccurrences([]);
        }
      })
      .catch(() => {
        setLoadErr("Não foi possível carregar as regras.");
        setPack({ items: [], performanceAlerts: false });
        setOccurrences([]);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (pack === null) {
    return (
      <AdsSettingsSection title="Regras customizadas" kicker="Avançado">
        <Skeleton className="h-32 w-full rounded-xl" />
      </AdsSettingsSection>
    );
  }

  if (!pack.performanceAlerts) {
    return (
      <AdsSettingsSection title="Regras customizadas" kicker="Avançado">
        <p className="text-sm text-muted-foreground">Não disponível no plano atual.</p>
      </AdsSettingsSection>
    );
  }

  async function handleCreate() {
    setPanelErr(null);
    setPanelOk(null);
    const name = nName.trim();
    const t = parseFloat(nThreshold.replace(",", "."));
    if (!name) {
      setPanelErr("Informe um nome para a regra.");
      return;
    }
    if (!Number.isFinite(t)) {
      setPanelErr("Informe um limite numérico válido.");
      return;
    }
    if (nMetric === "ctr" && (t < 0 || t > 100)) {
      setPanelErr("CTR deve estar entre 0 e 100.");
      return;
    }
    if (nMetric !== "ctr" && t <= 0) {
      setPanelErr("O limite deve ser maior que zero para esta métrica.");
      return;
    }
    let muteStartHour: number | null = null;
    let muteEndHour: number | null = null;
    if (nMuteA.trim() !== "" || nMuteB.trim() !== "") {
      const a = Number.parseInt(nMuteA.trim(), 10);
      const b = Number.parseInt(nMuteB.trim(), 10);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || a > 23 || b < 0 || b > 23) {
        setPanelErr("Silêncio: horas 0–23 (UTC) ou vazio.");
        return;
      }
      muteStartHour = a;
      muteEndHour = b;
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
        muteStartHour,
        muteEndHour,
      });
      setNName("");
      setNThreshold("");
      setNMuteA("");
      setNMuteB("");
      setPanelOk("Regra criada.");
      load();
    } catch (e) {
      setPanelErr(e instanceof Error ? e.message : "Erro ao criar regra.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(rule: AlertRuleDto) {
    setPanelErr(null);
    setPanelOk(null);
    setBusy(rule.id);
    try {
      await patchAlertRule(rule.id, { active: !rule.active });
      setPanelOk(rule.active ? "Regra desativada." : "Regra ativada.");
      load();
    } catch (e) {
      setPanelErr(e instanceof Error ? e.message : "Erro ao atualizar.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir esta regra?")) return;
    setPanelErr(null);
    setPanelOk(null);
    setBusy(id);
    try {
      await deleteAlertRule(id);
      setPanelOk("Regra removida.");
      load();
    } catch (e) {
      setPanelErr(e instanceof Error ? e.message : "Erro ao excluir.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdsSettingsSection title="Regras customizadas" kicker="Avançado">
      {loadErr ? <p className="mb-3 text-sm text-destructive">{loadErr}</p> : null}
      {panelErr ? (
        <p className="mb-3 rounded-lg border border-destructive/35 bg-destructive/[0.08] px-3 py-2 text-sm text-destructive">
          {panelErr}
        </p>
      ) : null}
      {panelOk ? (
        <p className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200">
          {panelOk}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-border/50 bg-muted/15 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Disparos recentes</p>
          {occurrences.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum ainda.</p>
          ) : (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1 text-sm">
              {occurrences.map((o) => (
                <li key={o.id} className="rounded-lg border border-border/50 bg-card/80 px-3 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-foreground">{o.ruleName}</span>
                    <time className="text-xs text-muted-foreground" dateTime={o.createdAt}>
                      {new Date(o.createdAt).toLocaleString("pt-BR")}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{o.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          {pack.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma regra customizada.</p>
          ) : (
            pack.items.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-foreground">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {METRIC_LABEL[rule.metric as AlertRuleMetric] ?? rule.metric}{" "}
                    {OP_LABEL[rule.operator as AlertRuleOperator] ?? rule.operator}{" "}
                    <span className="font-mono font-semibold text-foreground">{rule.threshold}</span>
                    {" · "}
                    <span className="capitalize">{rule.severity}</span>
                    {rule.muteStartHour != null && rule.muteEndHour != null ? (
                      <span>
                        {" "}
                        · silêncio {rule.muteStartHour}h–{rule.muteEndHour}h UTC
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canEdit ? (
                    <>
                      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/80 px-3 py-1.5">
                        <span className="text-xs text-muted-foreground">Ativa</span>
                        <Switch
                          checked={rule.active}
                          disabled={busy === rule.id}
                          onCheckedChange={() => void handleToggleActive(rule)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive"
                        title="Excluir"
                        disabled={busy === rule.id}
                        onClick={() => void handleDelete(rule.id)}
                      >
                        {busy === rule.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Somente leitura</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {canEdit ? (
        <>
          <Separator className="my-6 bg-border/50" />
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Nova regra</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="ar-name">Nome</Label>
              <Input
                id="ar-name"
                value={nName}
                onChange={(e) => setNName(e.target.value)}
                placeholder="Ex.: CPA crítico campanha X"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Métrica</Label>
              <Select value={nMetric} onValueChange={(v) => setNMetric(v as AlertRuleMetric)}>
                <SelectTrigger className="h-11 rounded-xl">
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
            <div className="space-y-2">
              <Label>Condição</Label>
              <Select value={nOp} onValueChange={(v) => setNOp(v as AlertRuleOperator)}>
                <SelectTrigger className="h-11 rounded-xl">
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
            <div className="space-y-2">
              <Label htmlFor="ar-th">Limite</Label>
              <Input
                id="ar-th"
                inputMode="decimal"
                value={nThreshold}
                onChange={(e) => setNThreshold(e.target.value)}
                placeholder={nMetric === "ctr" ? "2,5" : "100"}
                className="h-11 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Severidade</Label>
              <Select value={nSeverity} onValueChange={(v) => setNSeverity(v as AlertRuleSeverity)}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warning">Aviso</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-mute-a">Silêncio UTC · início</Label>
              <Input
                id="ar-mute-a"
                inputMode="numeric"
                value={nMuteA}
                onChange={(e) => setNMuteA(e.target.value)}
                placeholder="0–23"
                className="h-11 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-mute-b">Silêncio UTC · fim</Label>
              <Input
                id="ar-mute-b"
                inputMode="numeric"
                value={nMuteB}
                onChange={(e) => setNMuteB(e.target.value)}
                placeholder="0–23"
                className="h-11 rounded-xl font-mono"
              />
            </div>
          </div>
          <Button
            type="button"
            className="mt-4 rounded-xl"
            onClick={() => void handleCreate()}
            disabled={creating}
          >
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Adicionar regra
          </Button>
        </>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">Apenas admins podem editar regras.</p>
      )}
    </AdsSettingsSection>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function MarketingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [businessGoalMode, setBusinessGoalMode] = useState<BusinessGoalMode>("HYBRID");
  const [primaryConversionLabel, setPrimaryConversionLabel] = useState("");
  const [showRevenueBlocksInLeadMode, setShowRevenueBlocksInLeadMode] = useState(false);

  const [targetCpaBrl, setTargetCpaBrl] = useState("");
  const [maxCpaBrl, setMaxCpaBrl] = useState("");
  const [targetRoas, setTargetRoas] = useState("");
  const [minResultsForCpa, setMinResultsForCpa] = useState("5");
  const [minSpendForAlertsBrl, setMinSpendForAlertsBrl] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertCpaAboveMax, setAlertCpaAboveMax] = useState(true);
  const [alertCpaAboveTarget, setAlertCpaAboveTarget] = useState(true);
  const [alertRoasBelowTarget, setAlertRoasBelowTarget] = useState(true);

  const [crmToken, setCrmToken] = useState(false);
  const [crmPhone, setCrmPhone] = useState<string | null>(null);
  const [crmAlerts, setCrmAlerts] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMarketingSettings()
      .then((s) => {
        if (cancelled) return;
        const f = dtoToForm(s);
        setBusinessGoalMode(f.businessGoalMode);
        setPrimaryConversionLabel(f.primaryConversionLabel);
        setShowRevenueBlocksInLeadMode(f.showRevenueBlocksInLeadMode);
        setTargetCpaBrl(f.targetCpaBrl);
        setMaxCpaBrl(f.maxCpaBrl);
        setTargetRoas(f.targetRoas);
        setMinResultsForCpa(f.minResultsForCpa);
        setMinSpendForAlertsBrl(f.minSpendForAlertsBrl);
        setAlertsEnabled(f.alertsEnabled);
        setAlertCpaAboveMax(f.alertCpaAboveMax);
        setAlertCpaAboveTarget(f.alertCpaAboveTarget);
        setAlertRoasBelowTarget(f.alertRoasBelowTarget);
        setCrmToken(s.ativaCrmTokenConfigured);
        setCrmPhone(s.ativaCrmNotifyPhone);
        setCrmAlerts(s.ativaCrmAlertsEnabled);
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
  }, []);

  const preview = useMemo(() => {
    let target: number | null = null;
    let max: number | null = null;
    let roas: number | null = null;
    let minSpend: number | null = null;
    try {
      target = parseOptionalMoney(targetCpaBrl);
      max = parseOptionalMoney(maxCpaBrl);
      roas = parseOptionalMoney(targetRoas);
      minSpend = parseOptionalMoney(minSpendForAlertsBrl);
    } catch {
      /* ignore preview parse errors */
    }
    return { target, max, roas, minSpend };
  }, [targetCpaBrl, maxCpaBrl, targetRoas, minSpendForAlertsBrl]);

  function applyMetasPreset(which: "performance" | "escala" | "marca") {
    if (which === "performance") {
      setTargetCpaBrl("38");
      setMaxCpaBrl("62");
      setTargetRoas("2.8");
      setMinSpendForAlertsBrl("400");
    } else if (which === "escala") {
      setTargetCpaBrl("52");
      setMaxCpaBrl("88");
      setTargetRoas("2.2");
      setMinSpendForAlertsBrl("250");
    } else {
      setTargetCpaBrl("75");
      setMaxCpaBrl("115");
      setTargetRoas("1.6");
      setMinSpendForAlertsBrl("900");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavedMsg(null);
    setError(null);
    let target: number | null;
    let max: number | null;
    let roas: number | null;
    let minSpend: number | null;
    let minRes: number;
    try {
      target = parseOptionalMoney(targetCpaBrl);
      max = parseOptionalMoney(maxCpaBrl);
      roas = parseOptionalMoney(targetRoas);
      minSpend = parseOptionalMoney(minSpendForAlertsBrl);
      minRes = parseRequiredInt(minResultsForCpa, "Mínimo de resultados");
      if (target != null && max != null && target > max) {
        setError("CPA alvo deve ser menor ou igual ao CPA máximo.");
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verifique os valores informados.");
      return;
    }

    setSaving(true);
    try {
      await saveMarketingSettings({
        businessGoalMode,
        primaryConversionLabel: primaryConversionLabel.trim() ? primaryConversionLabel.trim() : null,
        showRevenueBlocksInLeadMode,
        targetCpaBrl: target,
        maxCpaBrl: max,
        targetRoas: roas,
        minResultsForCpa: minRes,
        minSpendForAlertsBrl: minSpend,
        alertsEnabled,
        alertCpaAboveMax,
        alertCpaAboveTarget,
        alertRoasBelowTarget,
      });
      setSavedMsg("Salvo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full space-y-6 pb-12">
        <div className="space-y-3">
          <Skeleton className="h-3 w-28 rounded-md" />
          <Skeleton className="h-10 w-full max-w-xl rounded-lg" />
          <Skeleton className="h-4 w-full rounded-md" />
        </div>
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8 2xl:col-span-9">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
          <Skeleton className="h-80 rounded-2xl xl:col-span-4 2xl:col-span-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-28">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
          <Link to="/marketing">
            <ArrowLeft className="h-4 w-4" />
            Painel ADS
          </Link>
        </Button>
        <span className="hidden text-border sm:inline">|</span>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="ghost" size="sm" className="h-9 rounded-lg text-xs" asChild>
            <Link to="/marketing/captacao">Captação</Link>
          </Button>
          <Button variant="ghost" size="sm" className="h-9 rounded-lg text-xs" asChild>
            <Link to="/marketing/conversao">Conversão</Link>
          </Button>
          <Button variant="ghost" size="sm" className="h-9 rounded-lg text-xs" asChild>
            <Link to="/marketing/receita">Receita</Link>
          </Button>
        </div>
      </div>

      <PageHeaderPremium
        eyebrow="ADS"
        breadcrumbs={[
          { label: "Painel ADS", href: "/marketing" },
          { label: "Metas e alertas" },
        ]}
        title="Metas e alertas"
        subtitle="O mesmo conjunto de metas alimenta o Painel ADS, Captação, Conversão e Receita."
        meta={
          <span className="inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/30 px-2 py-1">
              <BarChart3 className="h-3.5 w-3.5 text-primary" aria-hidden />
              Modo · {GOAL_LABEL[businessGoalMode]}
            </span>
            <StatusBadge tone={alertsEnabled ? "healthy" : "neutral"} dot>
              Alertas {alertsEnabled ? "on" : "off"}
            </StatusBadge>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" asChild>
              <Link to="/marketing/integracoes">
                Integrações
                <ChevronRight className="ml-0.5 h-4 w-4 opacity-60" />
              </Link>
            </Button>
            <Button size="sm" className="rounded-lg" asChild>
              <Link to="/marketing">
                <LayoutDashboard className="mr-1.5 h-3.5 w-3.5 opacity-90" />
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

      <div className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-muted/15 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Atalhos</p>
          <p className="text-sm font-semibold text-foreground">Presets de metas</p>
          <p className="text-xs text-muted-foreground">Ajusta campos · confirme com Salvar abaixo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" className="rounded-lg" onClick={() => applyMetasPreset("performance")}>
            Performance
          </Button>
          <Button type="button" variant="secondary" size="sm" className="rounded-lg" onClick={() => applyMetasPreset("escala")}>
            Escala
          </Button>
          <Button type="button" variant="secondary" size="sm" className="rounded-lg" onClick={() => applyMetasPreset("marca")}>
            Marca
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-12 xl:items-start">
        <div className="min-w-0 space-y-6 xl:col-span-8 2xl:col-span-9">
          <form onSubmit={handleSubmit} className="space-y-6">
            <AdsSettingsSection title="Objetivo da conta" kicker="Conta">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="business-goal-mode" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Modo
                  </Label>
                  <Select value={businessGoalMode} onValueChange={(v) => setBusinessGoalMode(v as BusinessGoalMode)}>
                    <SelectTrigger id="business-goal-mode" className="h-11 rounded-xl border-border/60">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEADS">Leads — CPL</SelectItem>
                      <SelectItem value="SALES">Vendas — ROAS</SelectItem>
                      <SelectItem value="HYBRID">Híbrido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primary-conv-label" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Rótulo do resultado (opcional)
                  </Label>
                  <Input
                    id="primary-conv-label"
                    value={primaryConversionLabel}
                    onChange={(e) => setPrimaryConversionLabel(e.target.value)}
                    placeholder="Ex.: Oportunidade, Lead"
                    maxLength={80}
                    className="h-11 rounded-xl border-border/60"
                  />
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/15 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-foreground">Receita visível no modo Leads</p>
                <Switch
                  checked={showRevenueBlocksInLeadMode}
                  onCheckedChange={setShowRevenueBlocksInLeadMode}
                  id="show-revenue-lead-mode"
                />
              </div>
            </AdsSettingsSection>

            <AdsSettingsSection title="Metas numéricas" kicker="Período">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <MoneyInput id="targetCpa" label="CPL / CPA alvo" placeholder="45" value={targetCpaBrl} onChange={setTargetCpaBrl} />
                <MoneyInput id="maxCpa" label="CPL / CPA máximo" placeholder="80" value={maxCpaBrl} onChange={setMaxCpaBrl} />
                <div className="space-y-2">
                  <Label htmlFor="targetRoas" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    ROAS mínimo
                  </Label>
                  <div className="relative">
                    <Input
                      id="targetRoas"
                      inputMode="decimal"
                      placeholder="3"
                      value={targetRoas}
                      onChange={(e) => setTargetRoas(e.target.value)}
                      className="h-11 rounded-xl border-border/60 pr-10"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      ×
                    </span>
                  </div>
                </div>
              </div>
            </AdsSettingsSection>

            <AdsSettingsSection
              title="Alertas automáticos"
              kicker="Sensibilidade"
              headerRight={
                <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/80 px-3 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Ativos</span>
                  <Switch checked={alertsEnabled} onCheckedChange={setAlertsEnabled} id="alerts-master" />
                </div>
              }
            >
              <div className="grid gap-3 md:grid-cols-3">
                <AlertRuleRow
                  id="rule-max"
                  title="CPA acima do máximo"
                  checked={alertCpaAboveMax}
                  onChange={setAlertCpaAboveMax}
                  disabled={!alertsEnabled}
                />
                <AlertRuleRow
                  id="rule-target"
                  title="CPA acima da meta"
                  checked={alertCpaAboveTarget}
                  onChange={setAlertCpaAboveTarget}
                  disabled={!alertsEnabled}
                />
                <AlertRuleRow
                  id="rule-roas"
                  title="ROAS abaixo da meta"
                  checked={alertRoasBelowTarget}
                  onChange={setAlertRoasBelowTarget}
                  disabled={!alertsEnabled}
                />
              </div>

              <Separator className="my-6 bg-border/50" />

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="minRes" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Mín. resultados p/ CPA
                  </Label>
                  <Input
                    id="minRes"
                    inputMode="numeric"
                    value={minResultsForCpa}
                    onChange={(e) => setMinResultsForCpa(e.target.value)}
                    className="h-11 rounded-xl border-border/60 font-mono tabular-nums"
                  />
                </div>
                <MoneyInput
                  id="minSpend"
                  label="Gasto mínimo (alertas)"
                  placeholder="Opcional"
                  value={minSpendForAlertsBrl}
                  onChange={setMinSpendForAlertsBrl}
                />
              </div>
            </AdsSettingsSection>

            <div
              className={cn(
                "sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-border/50 bg-background/95 px-4 py-4 shadow-[var(--shadow-surface)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:flex-row sm:items-center sm:justify-between sm:px-5",
                "xl:static xl:bottom-auto xl:border-border/50 xl:bg-card/50 xl:shadow-[var(--shadow-surface-sm)]"
              )}
            >
              <p className="text-xs text-muted-foreground">
                Metas aplicadas nas tabelas e nos chips de status do módulo ADS.
              </p>
              <Button type="submit" size="lg" className="w-full shrink-0 rounded-xl sm:w-auto" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar alterações
                  </>
                )}
              </Button>
            </div>
          </form>

          <CustomAlertRulesPanel />
        </div>

        <aside className="flex min-w-0 flex-col gap-4 xl:col-span-4 2xl:col-span-3 xl:sticky xl:top-4">
          <section className="overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-[var(--shadow-surface-sm)]">
            <div className="border-b border-border/40 bg-muted/15 px-4 py-3 sm:px-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Live</p>
              <h2 className="text-base font-black tracking-tight">Preview das metas</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4 sm:gap-3 sm:p-5">
              <PreviewMetric label="CPA alvo" value={formatBrlPreview(preview.target)} />
              <PreviewMetric label="CPA máx." value={formatBrlPreview(preview.max)} />
              <PreviewMetric
                label="ROAS mín."
                value={preview.roas != null ? `${preview.roas}×` : "—"}
              />
              <PreviewMetric label="Gasto mín." value={formatBrlPreview(preview.minSpend)} />
            </div>
          </section>

          <Card className="rounded-2xl border-border/50 shadow-[var(--shadow-surface-sm)]">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-bold">WhatsApp</CardTitle>
              </div>
              <StatusBadge tone={crmToken ? "connected" : "disconnected"} dot>
                {crmToken ? "OK" : "Off"}
              </StatusBadge>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <Link
                to="/marketing/integracoes"
                className="inline-flex font-medium text-primary underline-offset-4 hover:underline"
              >
                Configurar na Integrações
              </Link>
              {crmPhone ? <p className="font-mono text-[11px] text-foreground/90">{crmPhone}</p> : null}
              {crmToken ? (
                <p className="text-foreground/80">
                  CRM: <span className="font-semibold">{crmAlerts ? "alertas on" : "alertas off"}</span>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-3 text-center text-xs text-muted-foreground">
            Mesmo motor de metas do <Link to="/marketing" className="font-medium text-primary hover:underline">Painel ADS</Link>
            .
          </div>
        </aside>
      </div>
    </div>
  );
}
