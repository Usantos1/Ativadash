import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  ChevronRight,
  LayoutDashboard,
  ListPlus,
  Loader2,
  MessageCircle,
  Plus,
  Save,
  SlidersHorizontal,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Label htmlFor={id} className="text-sm font-medium">
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
          className="h-11 rounded-xl border-border/70 pl-10 shadow-[var(--shadow-surface-sm)] transition-shadow focus-visible:border-primary/40"
        />
      </div>
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SectionShell({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: typeof Target;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border-border/60 bg-card shadow-[var(--shadow-surface-sm)] transition-shadow hover:shadow-[var(--shadow-surface)]",
        className
      )}
    >
      <CardHeader className="space-y-3 border-b border-border/40 bg-gradient-to-br from-card to-primary/[0.03] pb-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 sm:p-6">{children}</CardContent>
    </Card>
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
  subtitle: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border border-border/55 bg-muted/[0.35] px-4 py-3.5 transition-colors",
        disabled && "opacity-50"
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p id={`${id}-label`} className="text-sm font-medium text-foreground">
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
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
      <SectionShell
        icon={ListPlus}
        title="Regras de alerta customizadas"
        description="Carregando…"
      >
        <Skeleton className="h-24 w-full rounded-xl" />
      </SectionShell>
    );
  }

  if (!pack.performanceAlerts) {
    return (
      <SectionShell
        icon={ListPlus}
        title="Regras de alerta customizadas"
        description="Defina limites adicionais por métrica. A avaliação ocorre no painel de marketing e ao disparar a avaliação de insights (com persistência de ocorrências conforme o fluxo)."
      >
        <p className="text-sm text-muted-foreground">
          Este recurso exige o módulo <strong className="font-medium text-foreground">alertas de performance</strong> no
          plano da empresa. Fale com a matriz ou com o suporte para habilitar.
        </p>
      </SectionShell>
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
        setPanelErr("Horas de silêncio: use inteiros de 0 a 23 (UTC do servidor) ou deixe os dois vazios.");
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
    <SectionShell
      icon={ListPlus}
      title="Regras de alerta customizadas"
      description="Limites por métrica (CPA, ROAS, gasto, CTR) avaliados no painel de marketing e em POST /insights/evaluate; ocorrências são registradas quando a avaliação persiste disparos (dedupe ~4h por regra)."
    >
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

      <div className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Últimos disparos
          </p>
          {occurrences.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum disparo registrado ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {occurrences.map((o) => (
                <li
                  key={o.id}
                  className="rounded-lg border border-border/50 bg-background/80 px-3 py-2"
                >
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

        <Separator className="my-4" />

        {pack.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma regra customizada ainda.</p>
        ) : (
          pack.items.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-col gap-3 rounded-xl border border-border/55 bg-muted/[0.25] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-foreground">{rule.name}</p>
                <p className="text-xs text-muted-foreground">
                  {METRIC_LABEL[rule.metric as AlertRuleMetric] ?? rule.metric} {OP_LABEL[rule.operator as AlertRuleOperator] ?? rule.operator}{" "}
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

      {canEdit ? (
        <>
          <Separator className="my-6 bg-border/60" />
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nova regra</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ar-name">Nome</Label>
              <Input
                id="ar-name"
                value={nName}
                onChange={(e) => setNName(e.target.value)}
                placeholder="Ex.: CPA crítico lançamento X"
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
              <Label htmlFor="ar-mute-a">Silêncio UTC — início (0–23)</Label>
              <Input
                id="ar-mute-a"
                inputMode="numeric"
                value={nMuteA}
                onChange={(e) => setNMuteA(e.target.value)}
                placeholder="vazio = sem janela"
                className="h-11 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-mute-b">Silêncio UTC — fim (0–23)</Label>
              <Input
                id="ar-mute-b"
                inputMode="numeric"
                value={nMuteB}
                onChange={(e) => setNMuteB(e.target.value)}
                placeholder="vazio = sem janela"
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
        <p className="mt-4 text-xs text-muted-foreground">Apenas administradores do workspace podem criar ou editar regras.</p>
      )}
    </SectionShell>
  );
}

export function MarketingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

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
      setSavedMsg("Alterações aplicadas com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-8 pb-16">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="h-9 w-2/3 max-w-md rounded-lg" />
          <Skeleton className="h-4 w-full max-w-xl rounded-md" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
          <Skeleton className="h-64 rounded-2xl lg:h-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-28">
      <Button variant="ghost" size="sm" className="-ml-2 h-9 gap-1.5 text-muted-foreground hover:text-foreground" asChild>
        <Link to="/marketing">
          <ArrowLeft className="h-4 w-4" />
          Marketing
        </Link>
      </Button>

      <PageHeaderPremium
        eyebrow="Marketing"
        breadcrumbs={[
          { label: "Marketing", href: "/marketing" },
          { label: "Metas e alertas" },
        ]}
        title="Metas e alertas de performance"
        subtitle="Defina CPA, ROAS e regras de sensibilidade. Os alertas alimentam o dashboard e as visões de campanha quando os dados do período estiverem disponíveis."
        meta={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-primary" aria-hidden />
              CPA = investimento ÷ resultados (Google + Meta)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-primary" aria-hidden />
              ROAS = valor atribuído ÷ investimento
            </span>
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
                Visão geral
              </Link>
            </Button>
          </div>
        }
        className="border-b border-border/45 pb-6"
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(280px,320px)] lg:items-start">
        <div className="min-w-0 space-y-8">
        <form onSubmit={handleSubmit} className="space-y-8">
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

          <SectionShell
            icon={Target}
            title="Metas numéricas"
            description="Valores usados para comparar o desempenho do período selecionado. Deixe em branco o que ainda não quiser monitorar."
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <MoneyInput
                id="targetCpa"
                label="CPA alvo"
                hint="Custo desejado por resultado."
                placeholder="45"
                value={targetCpaBrl}
                onChange={setTargetCpaBrl}
              />
              <MoneyInput
                id="maxCpa"
                label="CPA máximo"
                hint="Teto crítico — prioridade alta nos alertas."
                placeholder="80"
                value={maxCpaBrl}
                onChange={setMaxCpaBrl}
              />
            </div>
            <Separator className="my-6 bg-border/60" />
            <div className="max-w-md space-y-2">
              <Label htmlFor="targetRoas" className="text-sm font-medium">
                ROAS mínimo desejado
              </Label>
              <div className="relative">
                <Input
                  id="targetRoas"
                  inputMode="decimal"
                  placeholder="3"
                  value={targetRoas}
                  onChange={(e) => setTargetRoas(e.target.value)}
                  className="h-11 rounded-xl border-border/70 pr-12 shadow-[var(--shadow-surface-sm)]"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  ×
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ex.: 3 significa R$ 3 em valor atribuído para cada R$ 1 investido.
              </p>
            </div>
          </SectionShell>

          <SectionShell
            icon={Bell}
            title="Alertas e amostra mínima"
            description="Controle quais situações geram aviso e exija volume mínimo para não poluir com dados frágeis."
          >
            <div className="rounded-xl border border-border/50 bg-muted/25 px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Alertas de performance</p>
                  <p className="text-xs text-muted-foreground">Liga ou desliga todo o bloco de avisos por metas.</p>
                </div>
                <Switch checked={alertsEnabled} onCheckedChange={setAlertsEnabled} id="alerts-master" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Regras
              </div>
              <div className="grid gap-2.5 sm:grid-cols-1">
                <AlertRuleRow
                  id="rule-max"
                  title="CPA acima do máximo"
                  subtitle="Alerta crítico quando o CPA ultrapassar o teto."
                  checked={alertCpaAboveMax}
                  onChange={setAlertCpaAboveMax}
                  disabled={!alertsEnabled}
                />
                <AlertRuleRow
                  id="rule-target"
                  title="CPA acima da meta"
                  subtitle="Atenção quando estiver pior que o CPA alvo."
                  checked={alertCpaAboveTarget}
                  onChange={setAlertCpaAboveTarget}
                  disabled={!alertsEnabled}
                />
                <AlertRuleRow
                  id="rule-roas"
                  title="ROAS abaixo da meta"
                  subtitle="Quando houver investimento e valor atribuído para calcular."
                  checked={alertRoasBelowTarget}
                  onChange={setAlertRoasBelowTarget}
                  disabled={!alertsEnabled}
                />
              </div>
            </div>

            <Separator className="my-6 bg-border/60" />

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minRes" className="text-sm font-medium">
                  Mínimo de resultados para CPA
                </Label>
                <Input
                  id="minRes"
                  inputMode="numeric"
                  value={minResultsForCpa}
                  onChange={(e) => setMinResultsForCpa(e.target.value)}
                  className="h-11 rounded-xl border-border/70 font-mono tabular-nums shadow-[var(--shadow-surface-sm)]"
                />
                <p className="text-xs text-muted-foreground">Evita alertas com poucos eventos.</p>
              </div>
              <MoneyInput
                id="minSpend"
                label="Gasto mínimo no período"
                hint="Opcional. Só avalia depois deste valor em mídia."
                placeholder="Opcional"
                value={minSpendForAlertsBrl}
                onChange={setMinSpendForAlertsBrl}
              />
            </div>
          </SectionShell>

          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/90 px-4 py-3 shadow-[0_-8px_30px_-12px_hsl(224_20%_14%/0.12)] backdrop-blur-md supports-[backdrop-filter]:bg-background/75 lg:static lg:z-0 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
              <p className="hidden text-xs text-muted-foreground sm:block">
                As alterações valem para a empresa ativa no seletor do topo.
              </p>
              <Button type="submit" size="lg" className="w-full rounded-xl sm:w-auto" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar configurações
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        <CustomAlertRulesPanel />
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4">
          <Card className="rounded-2xl border-border/60 shadow-[var(--shadow-surface-sm)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Pré-visualização</CardTitle>
              <CardDescription className="text-xs">Como as metas aparecem na lógica atual</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-2 border-b border-border/50 py-2">
                <span className="text-muted-foreground">CPA alvo</span>
                <span className="font-medium tabular-nums">{formatBrlPreview(preview.target)}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-border/50 py-2">
                <span className="text-muted-foreground">CPA máx.</span>
                <span className="font-medium tabular-nums">{formatBrlPreview(preview.max)}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-border/50 py-2">
                <span className="text-muted-foreground">ROAS mín.</span>
                <span className="font-medium tabular-nums">
                  {preview.roas != null ? `${preview.roas}×` : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-2 py-2">
                <span className="text-muted-foreground">Gasto mín.</span>
                <span className="font-medium tabular-nums">{formatBrlPreview(preview.minSpend)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 shadow-[var(--shadow-surface-sm)]">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">WhatsApp (CRM)</CardTitle>
              </div>
              <StatusBadge tone={crmToken ? "connected" : "disconnected"} dot>
                {crmToken ? "Token" : "Off"}
              </StatusBadge>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <p>
                Envio dos mesmos alertas no WhatsApp é configurado em{" "}
                <Link to="/marketing/integracoes" className="font-medium text-primary underline-offset-4 hover:underline">
                  Integrações
                </Link>
                .
              </p>
              {crmPhone ? (
                <p className="font-mono text-[11px] text-foreground/80">{crmPhone}</p>
              ) : (
                <p>Nenhum número de destino definido.</p>
              )}
              {crmToken && (
                <p className="text-foreground/80">
                  Alertas CRM:{" "}
                  <span className="font-medium">{crmAlerts ? "ativos" : "desligados na integração"}</span>
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-dashed border-border/80 bg-muted/20">
            <CardContent className="pt-5 text-xs leading-relaxed text-muted-foreground">
              <strong className="font-medium text-foreground">Onde aparecem os alertas</strong>
              <p className="mt-2">
                Dashboard de marketing e páginas de visão quando o período tiver métricas suficientes. Integração
                WhatsApp é independente deste formulário.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
