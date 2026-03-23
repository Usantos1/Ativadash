import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  ClipboardList,
  Download,
  FileText,
  Layers,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Users2,
  Zap,
} from "lucide-react";
import { AnalyticsPageHeader } from "@/components/analytics/AnalyticsPageHeader";
import { DataTablePremium } from "@/components/premium/data-table-premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previewOrganizationSlug } from "@/lib/org-slug-preview";
import {
  createManagedOrganization,
  fetchChildrenOperationsDashboard,
  fetchOrganizationContext,
  formatPlanCap,
  formatPlanLimit,
  patchChildWorkspace,
  switchWorkspaceOrganization,
  type ChildWorkspaceOperationsRow,
  type ChildrenOperationsDashboard,
  type OrganizationContext,
  type WorkspaceStatus,
} from "@/lib/organization-api";
import {
  buildAttentionQueue,
  countWithOperationalAlert,
  formatAlertTagLabel,
  getWorkspaceAlertTags,
  getWorkspaceHealth,
  healthLabel,
  sortRowsByLastActivity,
  type AttentionQueueItem,
  type HealthLevel,
} from "@/lib/revenda-workspace-metrics";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const STATUS_PT: Record<WorkspaceStatus, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
};

const BILLING_LABEL: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
  trial: "Trial",
  custom: "Personalizada",
};

const SUBSCRIPTION_STATUS_PT: Record<string, string> = {
  active: "Ativa",
  trialing: "Trial",
  past_due: "Inadimplente",
  canceled: "Cancelada",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function pctUsed(used: number, cap: number | null): { pct: number; unlimited: boolean } {
  if (cap === null || cap <= 0) return { pct: 0, unlimited: true };
  return { pct: Math.min(100, Math.round((used / cap) * 100)), unlimited: false };
}

function MatrixLimitBar({
  label,
  used,
  cap,
  short,
}: {
  label: string;
  used: number;
  cap: number | null;
  short?: string;
}) {
  const { pct, unlimited } = pctUsed(used, cap);
  const over = cap != null && cap > 0 && used >= cap;
  const warn = !unlimited && cap != null && cap > 0 && pct >= 85;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-foreground">
          {used}
          <span className="font-normal text-muted-foreground"> / {formatPlanCap(cap)}</span>
        </span>
      </div>
      {unlimited ? (
        <p className="text-[11px] text-muted-foreground">{short ?? "Sem teto numérico no plano."}</p>
      ) : (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                over ? "bg-destructive" : warn ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {short ??
              (over
                ? "Limite atingido."
                : warn
                  ? "Próximo do limite — planeje upgrade ou liberação."
                  : `${cap! - used > 0 ? `${cap! - used} disponível(is)` : "Sem folga"}`)}
          </p>
        </>
      )}
    </div>
  );
}

function ExecutiveKpi({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string;
  value: string;
  subtitle: string;
  tone: "neutral" | "amber" | "rose" | "emerald" | "slate";
}) {
  const border =
    tone === "amber"
      ? "border-l-amber-500"
      : tone === "rose"
        ? "border-l-rose-500"
        : tone === "emerald"
          ? "border-l-emerald-500"
          : tone === "slate"
            ? "border-l-slate-500"
            : "border-l-primary";

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/95 py-3.5 pl-4 pr-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
        "border-l-4",
        border
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function statusBadgeClass(s: WorkspaceStatus) {
  if (s === "ACTIVE") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100";
  if (s === "PAUSED") return "border-amber-500/40 bg-amber-500/15 text-amber-950 dark:text-amber-100";
  return "border-border/70 bg-muted/60 text-muted-foreground";
}

function healthBadgeClass(h: HealthLevel) {
  if (h === "OK") return "border-emerald-500/40 bg-emerald-500/12 text-emerald-950 dark:text-emerald-100";
  if (h === "ATENCAO") return "border-amber-500/45 bg-amber-500/14 text-amber-950 dark:text-amber-100";
  if (h === "CRITICO") return "border-rose-500/45 bg-rose-500/12 text-rose-950 dark:text-rose-100";
  return "border-border/70 bg-muted/50 text-muted-foreground";
}

function priorityStripe(p: AttentionQueueItem["priority"]) {
  if (p === "P1") return "bg-rose-500";
  if (p === "P2") return "bg-amber-500";
  return "bg-slate-400 dark:bg-slate-500";
}

export function RevendaWorkspacesPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const platformAdmin = useAuthStore((s) => s.user?.platformAdmin);

  const [ctx, setCtx] = useState<OrganizationContext | null>(null);
  const [dash, setDash] = useState<ChildrenOperationsDashboard | null>(null);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [opsError, setOpsError] = useState<string | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [loadingOps, setLoadingOps] = useState(false);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | WorkspaceStatus>("all");
  const [filterHealthLevel, setFilterHealthLevel] = useState<"all" | HealthLevel>("all");
  const [filterHealth, setFilterHealth] = useState<"all" | "no_integration" | "no_members" | "stale">("all");
  const [filterIntegration, setFilterIntegration] = useState<"all" | "with" | "without">("all");
  const [sortActivity, setSortActivity] = useState<"desc" | "asc">("desc");

  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<ChildWorkspaceOperationsRow | null>(null);

  const [createName, setCreateName] = useState("");
  const [createInherit, setCreateInherit] = useState(true);
  const [createNote, setCreateNote] = useState("");
  const [createSetupFlag, setCreateSetupFlag] = useState(false);
  const [createStartMinimal, setCreateStartMinimal] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<WorkspaceStatus>("ACTIVE");
  const [editNote, setEditNote] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const revendaEnabled =
    ctx?.enabledFeatures.multiOrganization === true &&
    (ctx.limits.maxChildOrganizations == null || ctx.limits.maxChildOrganizations > 0);

  const loadCtx = useCallback(async () => {
    setCtxError(null);
    setLoadingCtx(true);
    try {
      const c = await fetchOrganizationContext();
      setCtx(c);
    } catch {
      setCtxError("Não foi possível carregar o contexto da organização.");
    } finally {
      setLoadingCtx(false);
    }
  }, []);

  const loadOps = useCallback(async () => {
    setOpsError(null);
    setLoadingOps(true);
    try {
      const d = await fetchChildrenOperationsDashboard();
      setDash(d);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sem permissão para ver a central de workspaces.";
      setOpsError(msg);
      setDash(null);
    } finally {
      setLoadingOps(false);
    }
  }, []);

  useEffect(() => {
    void loadCtx();
  }, [loadCtx]);

  useEffect(() => {
    if (!ctx || ctx.parentOrganization) return;
    void loadOps();
  }, [ctx, loadOps]);

  const suggestedSlug = useMemo(() => previewOrganizationSlug(createName), [createName]);

  const attentionQueue = useMemo(() => {
    if (!dash?.organizations) return [];
    return buildAttentionQueue(dash.organizations);
  }, [dash?.organizations]);

  const matrixAlerts = useMemo(() => {
    if (!dash?.alerts) return [];
    return dash.alerts.filter((a) => a.type === "at_child_limit" || a.type === "near_child_limit");
  }, [dash?.alerts]);

  const filteredRows = useMemo(() => {
    const rows = dash?.organizations ?? [];
    return rows.filter((r) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !r.slug.toLowerCase().includes(q)) return false;
      }
      if (filterStatus !== "all" && r.workspaceStatus !== filterStatus) return false;
      if (filterHealthLevel !== "all" && getWorkspaceHealth(r) !== filterHealthLevel) return false;
      if (filterHealth === "no_integration" && r.connectedIntegrations > 0) return false;
      if (filterHealth === "no_members" && r.memberCount > 0) return false;
      if (filterHealth === "stale" && !r.staleActivity) return false;
      if (filterIntegration === "with" && r.connectedIntegrations === 0) return false;
      if (filterIntegration === "without" && r.connectedIntegrations > 0) return false;
      return true;
    });
  }, [dash?.organizations, search, filterStatus, filterHealthLevel, filterHealth, filterIntegration]);

  const sortedRows = useMemo(
    () => sortRowsByLastActivity(filteredRows, sortActivity),
    [filteredRows, sortActivity]
  );

  const inheritedCount = useMemo(
    () => dash?.organizations.filter((o) => o.inheritPlanFromParent).length ?? 0,
    [dash?.organizations]
  );
  const ownPlanCount = useMemo(
    () => (dash?.organizations.length ?? 0) - inheritedCount,
    [dash?.organizations, inheritedCount]
  );

  const withAlertCount = useMemo(
    () => (dash?.organizations ? countWithOperationalAlert(dash.organizations) : 0),
    [dash?.organizations]
  );

  async function enterWorkspace(organizationId: string) {
    setActionError(null);
    setSwitchingId(organizationId);
    try {
      const res = await switchWorkspaceOrganization(organizationId);
      setAuth(
        { ...res.user, organization: res.user.organization },
        res.accessToken,
        res.refreshToken,
        {
          memberships: res.memberships,
          managedOrganizations: res.managedOrganizations ?? [],
        }
      );
      navigate("/dashboard", { replace: true });
    } catch {
      setActionError("Não foi possível entrar neste workspace.");
    } finally {
      setSwitchingId(null);
    }
  }

  async function setWorkspaceStatus(id: string, workspaceStatus: WorkspaceStatus) {
    setActionError(null);
    try {
      await patchChildWorkspace(id, { workspaceStatus });
      await loadOps();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erro ao atualizar status");
    }
  }

  async function submitCreate() {
    const n = createName.trim();
    if (n.length < 2) return;
    setCreateSubmitting(true);
    setActionError(null);
    try {
      let note = createNote.trim() || null;
      if (createSetupFlag && !createStartMinimal) {
        const tag = "[Setup inicial pendente]";
        note = note ? `${tag} ${note}` : tag;
      }
      await createManagedOrganization(n, {
        inheritPlanFromParent: createInherit,
        workspaceNote: note,
      });
      setCreateOpen(false);
      setCreateName("");
      setCreateNote("");
      setCreateSetupFlag(false);
      setCreateStartMinimal(false);
      await loadOps();
      await loadCtx();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erro ao criar workspace");
    } finally {
      setCreateSubmitting(false);
    }
  }

  function openEdit(row: ChildWorkspaceOperationsRow) {
    setEditRow(row);
    setEditName(row.name);
    setEditStatus(row.workspaceStatus);
    setEditNote(row.workspaceNote ?? "");
  }

  async function submitEdit() {
    if (!editRow) return;
    const n = editName.trim();
    if (n.length < 2) return;
    setEditSubmitting(true);
    setActionError(null);
    try {
      await patchChildWorkspace(editRow.id, {
        name: n,
        workspaceStatus: editStatus,
        workspaceNote: editNote.trim() || null,
      });
      setEditRow(null);
      await loadOps();
      await loadCtx();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setEditSubmitting(false);
    }
  }

  function exportCsv() {
    const rows = sortedRows;
    const header = [
      "Nome",
      "Slug",
      "Status",
      "Saude",
      "Usuarios",
      "Integracoes",
      "Dashboards",
      "Ultima atividade",
      "Criado em",
      "Plano",
      "Alertas",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) => {
        const h = getWorkspaceHealth(r);
        const tags = getWorkspaceAlertTags(r)
          .map(formatAlertTagLabel)
          .join("; ");
        return [
          `"${r.name.replace(/"/g, '""')}"`,
          r.slug,
          r.workspaceStatus,
          h,
          r.memberCount,
          r.connectedIntegrations,
          r.dashboardCount,
          r.lastActivityAt ?? "",
          r.createdAt,
          r.inheritPlanFromParent ? "herdado" : "proprio",
          `"${tags.replace(/"/g, '""')}"`,
        ].join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `workspaces-filhos-${ctx?.slug ?? "matriz"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copySlug(slug: string) {
    try {
      await navigator.clipboard.writeText(slug);
    } catch {
      setActionError("Não foi possível copiar para a área de transferência.");
    }
  }

  if (loadingCtx && !ctx) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando…
      </p>
    );
  }

  if (ctxError || !ctx) {
    return (
      <div className="mx-auto max-w-md space-y-3 text-center">
        <p className="text-sm text-destructive">{ctxError ?? "Erro"}</p>
        <Button variant="outline" onClick={() => void loadCtx()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (ctx.parentOrganization) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <AnalyticsPageHeader
          eyebrow="Multiempresa"
          title="Gestão de workspaces"
          subtitle="Esta central fica na organização matriz. Você está em um workspace filho vinculado à agência."
          breadcrumbs={[{ label: "Gestão de workspaces" }]}
        />
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Trocar de contexto</CardTitle>
            <CardDescription>
              Use o seletor de empresa no topo para voltar à matriz <strong>{ctx.parentOrganization.name}</strong> e
              gerenciar filiais.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const planLabel = ctx.subscription?.plan.name ?? ctx.plan?.name ?? "—";
  const subStatus = ctx.subscription?.status;
  const billingMode = ctx.subscription?.billingMode;
  const p = dash?.parent;
  const rows = dash?.organizations ?? [];
  const capChild = dash?.summary.childSlotsCap ?? null;
  const usedChild = dash?.summary.childSlotsUsed ?? 0;
  const nearLimit =
    capChild != null && capChild > 0 && usedChild >= Math.ceil(capChild * 0.9) && usedChild < capChild;
  const atLimit = capChild != null && capChild > 0 && usedChild >= capChild;

  return (
    <div className="min-w-0 space-y-10 pb-14">
      {/* Visão executiva — header + faixa */}
      <section
        className={cn(
          "overflow-hidden rounded-2xl border border-border/70",
          "bg-gradient-to-br from-card via-card to-muted/35",
          "shadow-[0_1px_0_0_hsl(var(--border)/0.5),0_12px_40px_-24px_rgba(0,0,0,0.35)]",
          "dark:shadow-[0_1px_0_0_hsl(var(--border)/0.4),0_12px_48px_-20px_rgba(0,0,0,0.55)]"
        )}
      >
        <div className="border-b border-border/60 bg-gradient-to-r from-primary/[0.07] via-transparent to-amber-500/[0.06] px-4 py-4 sm:px-6">
          <nav className="mb-2 text-[11px] font-medium text-muted-foreground" aria-label="Breadcrumb">
            <Link to="/configuracoes" className="transition-colors hover:text-foreground">
              Configurações
            </Link>
            <span className="mx-1.5 opacity-50">/</span>
            <span className="text-foreground/90">Gestão de workspaces</span>
          </nav>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Central de revenda</p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem]">Gestão de workspaces</h1>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground/90">{ctx.name}</span> — comando da operação multiempresa:
                saúde das filiais, fila do que precisa de ação, limites da matriz e acesso rápido a cada ambiente.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center rounded-md border border-border/70 bg-background/80 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                  Plano: {planLabel}
                </span>
                {subStatus ? (
                  <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 dark:text-emerald-100">
                    {SUBSCRIPTION_STATUS_PT[subStatus] ?? subStatus}
                  </span>
                ) : null}
                {billingMode ? (
                  <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {BILLING_LABEL[billingMode] ?? billingMode}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                size="lg"
                className="gap-2 rounded-xl shadow-md"
                disabled={!revendaEnabled}
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Novo workspace filho
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2 rounded-xl border border-border/80"
                disabled={loadingOps}
                onClick={() => void loadOps()}
              >
                <RefreshCw className={cn("h-4 w-4", loadingOps && "animate-spin")} aria-hidden />
                Atualizar dados
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2 rounded-xl"
                disabled={sortedRows.length === 0}
                onClick={() => exportCsv()}
              >
                <Download className="h-4 w-4" aria-hidden />
                Exportar CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-6">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-foreground">Visão executiva</h2>
          </div>
          {!revendaEnabled ? (
            <div
              className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
              role="alert"
            >
              O plano atual <strong>não inclui</strong> workspaces filhos. Quando liberado, esta faixa mostra a operação
              consolidada em tempo real.
            </div>
          ) : null}

          {opsError ? (
            <div className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {opsError}{" "}
              <span className="text-foreground/80">Somente admins diretos da matriz veem os indicadores consolidados.</span>
            </div>
          ) : null}

          {dash && !opsError ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
              <ExecutiveKpi
                label="Workspaces"
                value={String(dash.summary.totalWorkspaces)}
                subtitle="Total cadastrado na matriz (ativos + pausados + arquivados)."
                tone="slate"
              />
              <ExecutiveKpi
                label="Ativos"
                value={String(dash.summary.activeWorkspaces)}
                subtitle={`${dash.summary.pausedWorkspaces} pausados · ${dash.summary.archivedWorkspaces} arquivados`}
                tone="emerald"
              />
              <ExecutiveKpi
                label="Com alerta operacional"
                value={String(withAlertCount)}
                subtitle="Filhos em atenção ou crítico — ver fila abaixo e agir."
                tone={withAlertCount > 0 ? "amber" : "neutral"}
              />
              <ExecutiveKpi
                label="Sem integração"
                value={String(dash.summary.withoutIntegration)}
                subtitle="Workspaces ativos sem conector conectado."
                tone={dash.summary.withoutIntegration > 0 ? "amber" : "neutral"}
              />
              <ExecutiveKpi
                label="Sem membros"
                value={String(dash.summary.withoutMembers)}
                subtitle="Risco de ambiente ‘vazio’ — convidar equipe ou entrar para configurar."
                tone={dash.summary.withoutMembers > 0 ? "rose" : "neutral"}
              />
              <ExecutiveKpi
                label="Sem atividade recente"
                value={String(dash.summary.staleActivityCount)}
                subtitle="≈14 dias sem sinal de sync ou movimento de equipe."
                tone={dash.summary.staleActivityCount > 0 ? "amber" : "neutral"}
              />
              <ExecutiveKpi
                label="Limite de filiais"
                value={`${usedChild} / ${formatPlanLimit(capChild, { zeroMeansNotIncluded: true })}`}
                subtitle={
                  atLimit
                    ? "Limite atingido — não crie novos até liberar cota."
                    : nearLimit
                      ? "Próximo do teto — alinhar plano ou arquivar filiais ociosas."
                      : "Capacidade contratada de workspaces filhos."
                }
                tone={atLimit ? "rose" : nearLimit ? "amber" : "neutral"}
              />
              <ExecutiveKpi
                label="Usuários nas filiais"
                value={String(dash.summary.usersTotalAcrossChildren)}
                subtitle="Soma de membros em todos os workspaces filhos."
                tone="neutral"
              />
              <ExecutiveKpi
                label="Integrações nas filiais"
                value={String(dash.summary.integrationsTotalAcrossChildren)}
                subtitle="Total de integrações conectadas nos filhos."
                tone="neutral"
              />
            </div>
          ) : null}
        </div>
      </section>

      {actionError ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {/* Fila de atenção */}
      {dash && !opsError && revendaEnabled ? (
        <section aria-labelledby="attention-title" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="attention-title" className="text-lg font-bold tracking-tight text-foreground">
                Workspaces que exigem atenção
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Priorização operacional: o que está bloqueando valor ou expondo risco. Use as ações para entrar no contexto
                certo e resolver na sequência.
              </p>
            </div>
            {attentionQueue.length > 0 ? (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-950 dark:text-amber-100">
                {attentionQueue.length} na fila
              </span>
            ) : null}
          </div>

          <div
            className={cn(
              "overflow-hidden rounded-2xl border-2 border-amber-500/40",
              "bg-gradient-to-b from-amber-500/[0.12] via-card to-card",
              "shadow-[0_0_0_1px_rgba(245,158,11,0.15),0_16px_48px_-28px_rgba(0,0,0,0.25)]"
            )}
          >
            {matrixAlerts.length > 0 ? (
              <div className="space-y-2 border-b border-amber-500/25 bg-amber-500/10 px-4 py-3 sm:px-5">
                {matrixAlerts.map((a, i) => (
                  <div
                    key={`m-${a.type}-${i}`}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                      a.severity === "critical"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-amber-600/30 bg-background/60 text-foreground"
                    )}
                  >
                    <span className="font-semibold">{a.message}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="p-4 sm:p-5">
              {attentionQueue.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Sparkles className="h-10 w-10 text-emerald-600/80 dark:text-emerald-400/90" aria-hidden />
                  <p className="text-base font-semibold text-foreground">Nada crítico na fila agora</p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Nenhum workspace ativo com bloqueios listados. Continue monitorando integrações, equipe e atividade na
                    tabela abaixo.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {attentionQueue.map((item) => (
                    <li
                      key={item.organizationId}
                      className="flex gap-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm"
                    >
                      <div className={cn("w-1 shrink-0", priorityStripe(item.priority))} aria-hidden />
                      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-bold text-foreground">{item.name}</p>
                            <code className="shrink-0 text-[11px] text-muted-foreground">{item.slug}</code>
                            <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              {item.priority}
                            </span>
                            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                              {item.priorityLabel}
                            </span>
                          </div>
                          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                            {item.problems.map((pr, j) => (
                              <li key={j}>{pr}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1.5 rounded-lg"
                            onClick={() => void enterWorkspace(item.organizationId)}
                            disabled={switchingId === item.organizationId}
                          >
                            {switchingId === item.organizationId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ArrowRight className="h-3.5 w-3.5" />
                            )}
                            Entrar no workspace
                          </Button>
                          <p className="text-[10px] leading-snug text-muted-foreground sm:text-right">
                            Depois de entrar: menu <strong className="text-foreground/90">Equipe</strong> e{" "}
                            <strong className="text-foreground/90">Integrações</strong> valem para{" "}
                            <em>esse</em> workspace.
                          </p>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="rounded-lg text-xs"
                            onClick={() => {
                              const row = rows.find((r) => r.id === item.organizationId);
                              if (row) openEdit(row);
                            }}
                          >
                            Governança (nome, status, nota)
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* Saúde da matriz / consolidado */}
      {p && !opsError ? (
        <section className="space-y-4" aria-labelledby="matrix-health-title">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" aria-hidden />
            <h2 id="matrix-health-title" className="text-lg font-bold tracking-tight text-foreground">
              Saúde e capacidade da matriz
            </h2>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Governança do contrato e do que ainda pode crescer. Filhos:{" "}
            <strong className="text-foreground">{inheritedCount}</strong> com plano herdado,{" "}
            <strong className="text-foreground">{ownPlanCount}</strong> com plano próprio.
          </p>

          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="rounded-2xl border-border/70 bg-card shadow-md lg:col-span-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Contrato e plano</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  {ctx.limitsHaveOverrides ? (
                    <span className="font-semibold text-amber-900 dark:text-amber-100">Limites com override da plataforma.</span>
                  ) : (
                    "Limites efetivos do plano aplicado à matriz."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                    {planLabel}
                  </span>
                  {subStatus ? (
                    <span className="rounded-md border border-border/60 bg-muted/50 px-2 py-1 text-xs font-semibold">
                      {SUBSCRIPTION_STATUS_PT[subStatus] ?? subStatus}
                    </span>
                  ) : null}
                  {billingMode ? (
                    <span className="rounded-md border border-border/60 px-2 py-1 text-xs">
                      {BILLING_LABEL[billingMode] ?? billingMode}
                    </span>
                  ) : null}
                </div>
                {ctx.subscription?.renewsAt ? (
                  <p className="text-xs text-muted-foreground">
                    Próxima renovação:{" "}
                    <strong className="text-foreground">
                      {new Date(ctx.subscription.renewsAt).toLocaleDateString("pt-BR")}
                    </strong>
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="rounded-lg border border-border/55 bg-muted/25 p-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Usuários (filiais)</p>
                    <p className="text-lg font-bold tabular-nums">{dash?.summary.usersTotalAcrossChildren ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-border/55 bg-muted/25 p-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Integrações (filiais)</p>
                    <p className="text-lg font-bold tabular-nums">{dash?.summary.integrationsTotalAcrossChildren ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-border/55 bg-muted/25 p-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Dashboards (filiais)</p>
                    <p className="text-lg font-bold tabular-nums">{dash?.summary.dashboardsTotalAcrossChildren ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-border/55 bg-muted/25 p-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Workspaces filhos</p>
                    <p className="text-lg font-bold tabular-nums">{dash?.summary.totalWorkspaces ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-card shadow-md lg:col-span-8">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Uso vs. limite (matriz)</CardTitle>
                <CardDescription>Capacidade restante no workspace matriz — não confundir com totais nas filiais.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <MatrixLimitBar
                  label="Workspaces filhos"
                  used={p.usage.childOrganizations}
                  cap={p.limits.maxChildOrganizations}
                />
                <MatrixLimitBar
                  label="Usuários (login)"
                  used={p.usage.directMembers + (p.usage.pendingInvitations ?? 0)}
                  cap={p.limits.maxUsers}
                  short="Inclui convites pendentes na conta."
                />
                <MatrixLimitBar label="Integrações" used={p.usage.integrations} cap={p.limits.maxIntegrations} />
                <MatrixLimitBar label="Dashboards" used={p.usage.dashboards} cap={p.limits.maxDashboards} />
                <MatrixLimitBar
                  label="Clientes comerciais"
                  used={p.usage.clientAccounts}
                  cap={p.limits.maxClientAccounts}
                  short="Registros do menu Clientes na matriz."
                />
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {/* Tabela premium */}
      <section className="space-y-4" aria-labelledby="table-workspaces-title">
        <div className="flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="table-workspaces-title" className="text-lg font-bold tracking-tight text-foreground">
              Carteira de workspaces
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Saúde, alertas e métricas por filial — filtre, ordene e exporte para operação ou comitê.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome ou slug…"
                className="h-10 rounded-xl pl-8"
                aria-label="Buscar workspace"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <SelectUi
                value={filterStatus}
                onChange={(v) => setFilterStatus(v as typeof filterStatus)}
                label="Status"
                options={[
                  { v: "all", t: "Todos os status" },
                  { v: "ACTIVE", t: "Ativa" },
                  { v: "PAUSED", t: "Pausada" },
                  { v: "ARCHIVED", t: "Arquivada" },
                ]}
              />
              <SelectUi
                value={filterHealthLevel}
                onChange={(v) => setFilterHealthLevel(v as typeof filterHealthLevel)}
                label="Saúde"
                options={[
                  { v: "all", t: "Todas" },
                  { v: "OK", t: "OK" },
                  { v: "ATENCAO", t: "Atenção" },
                  { v: "CRITICO", t: "Crítico" },
                  { v: "INATIVO", t: "Inativo" },
                ]}
              />
              <SelectUi
                value={filterIntegration}
                onChange={(v) => setFilterIntegration(v as typeof filterIntegration)}
                label="Integração"
                options={[
                  { v: "all", t: "Todas" },
                  { v: "with", t: "Com integração" },
                  { v: "without", t: "Sem integração" },
                ]}
              />
              <SelectUi
                value={filterHealth}
                onChange={(v) => setFilterHealth(v as typeof filterHealth)}
                label="Sinal"
                options={[
                  { v: "all", t: "Sem filtro extra" },
                  { v: "no_integration", t: "Sem integração" },
                  { v: "no_members", t: "Sem usuários" },
                  { v: "stale", t: "Inativos (14d)" },
                ]}
              />
              <SelectUi
                value={sortActivity}
                onChange={(v) => setSortActivity(v as typeof sortActivity)}
                label="Ordem"
                options={[
                  { v: "desc", t: "Atividade ↓" },
                  { v: "asc", t: "Atividade ↑" },
                ]}
              />
            </div>
          </div>
        </div>

        {loadingOps && !dash ? (
          <DataTablePremium zebra minHeight="min-h-[12rem]" className="rounded-2xl border-border/70">
            <thead>
              <tr>
                <th scope="col">Workspace</th>
                <th scope="col">Status</th>
                <th scope="col">Saúde</th>
                <th scope="col">Alertas</th>
                <th scope="col">Usuários</th>
                <th scope="col">Integrações</th>
                <th scope="col">Dashboards</th>
                <th scope="col">Última atividade</th>
                <th scope="col">Criado</th>
                <th scope="col">Plano</th>
                <th scope="col" className="text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={11} className="py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-primary" aria-hidden />
                  Carregando operação…
                </td>
              </tr>
            </tbody>
          </DataTablePremium>
        ) : opsError ? null : sortedRows.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={dash?.organizations.length === 0 ? "Nenhum workspace filho" : "Nenhum resultado"}
            description={
              dash?.organizations.length === 0
                ? "Crie o primeiro workspace para isolar dados, integrações e equipe de cada cliente ou unidade."
                : "Ajuste filtros ou a busca."
            }
            actionLabel={dash?.organizations.length === 0 && revendaEnabled ? "Novo workspace filho" : undefined}
            onAction={dash?.organizations.length === 0 && revendaEnabled ? () => setCreateOpen(true) : undefined}
          />
        ) : (
          <DataTablePremium zebra minHeight="min-h-[16rem]" shellClassName="rounded-2xl border-border/80 shadow-md">
            <thead>
              <tr>
                <th scope="col">Workspace</th>
                <th scope="col">Status</th>
                <th scope="col">Saúde</th>
                <th scope="col">Alertas</th>
                <th scope="col">Usuários</th>
                <th scope="col">Integrações</th>
                <th scope="col">Dashboards</th>
                <th scope="col">Última atividade</th>
                <th scope="col">Criado</th>
                <th scope="col">Plano</th>
                <th scope="col" className="text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const busy = switchingId === r.id;
                const health = getWorkspaceHealth(r);
                const tags = getWorkspaceAlertTags(r).filter((t) => t !== "pausado" && t !== "arquivado");
                return (
                  <tr
                    key={r.id}
                    className={cn(
                      health === "CRITICO" && "bg-rose-500/[0.06]",
                      health === "ATENCAO" && "bg-amber-500/[0.05]"
                    )}
                  >
                    <td className="align-middle">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-foreground">{r.name}</span>
                        <code className="text-[11px] text-muted-foreground">{r.slug}</code>
                        {r.pendingInvitationsCount > 0 ? (
                          <span className="text-[10px] font-semibold text-primary">
                            {r.pendingInvitationsCount} convite(s)
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="align-middle">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold",
                          statusBadgeClass(r.workspaceStatus)
                        )}
                      >
                        {STATUS_PT[r.workspaceStatus]}
                      </span>
                    </td>
                    <td className="align-middle">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold",
                          healthBadgeClass(health)
                        )}
                      >
                        {healthLabel(health)}
                      </span>
                    </td>
                    <td className="align-middle">
                      <div className="flex max-w-[10rem] flex-wrap gap-1">
                        {tags.length === 0 ? (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        ) : (
                          tags.slice(0, 4).map((t) => (
                            <span
                              key={t}
                              className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-foreground/90"
                            >
                              {formatAlertTagLabel(t)}
                            </span>
                          ))
                        )}
                        {tags.length > 4 ? (
                          <span className="text-[10px] text-muted-foreground">+{tags.length - 4}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="align-middle tabular-nums font-medium">{r.memberCount}</td>
                    <td className="align-middle tabular-nums">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Plug className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        {r.connectedIntegrations}
                      </span>
                    </td>
                    <td className="align-middle tabular-nums font-medium">{r.dashboardCount}</td>
                    <td className="align-middle text-xs text-muted-foreground">{formatDateTime(r.lastActivityAt)}</td>
                    <td className="align-middle text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                    <td className="align-middle">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold",
                          r.inheritPlanFromParent
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border/70 bg-muted/50 text-muted-foreground"
                        )}
                      >
                        {r.inheritPlanFromParent ? "Herdado" : "Próprio"}
                      </span>
                    </td>
                    <td className="align-middle text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="h-8 gap-1 rounded-lg px-2 text-xs"
                          onClick={() => void enterWorkspace(r.id)}
                          disabled={busy}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                          Entrar
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 gap-1 rounded-lg px-2 text-xs"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        {r.workspaceStatus === "ACTIVE" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 rounded-lg px-2 text-xs"
                            onClick={() => void setWorkspaceStatus(r.id, "PAUSED")}
                          >
                            <Pause className="h-3.5 w-3.5" />
                            Pausar
                          </Button>
                        ) : null}
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 rounded-lg p-0">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Mais</span>
                            </Button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              className="z-50 min-w-[12rem] rounded-xl border border-border/80 bg-popover p-1 shadow-[var(--shadow-surface)]"
                              sideOffset={6}
                              align="end"
                            >
                              <DropdownMenu.Item
                                className="cursor-pointer rounded-lg px-2 py-2 text-sm outline-none focus:bg-accent"
                                onSelect={() => void copySlug(r.slug)}
                              >
                                Copiar slug
                              </DropdownMenu.Item>
                              {r.workspaceStatus === "PAUSED" ? (
                                <DropdownMenu.Item
                                  className="cursor-pointer rounded-lg px-2 py-2 text-sm outline-none focus:bg-accent"
                                  onSelect={() => void setWorkspaceStatus(r.id, "ACTIVE")}
                                >
                                  Reativar
                                </DropdownMenu.Item>
                              ) : null}
                              {r.workspaceStatus !== "ARCHIVED" ? (
                                <DropdownMenu.Item
                                  className="cursor-pointer rounded-lg px-2 py-2 text-sm outline-none focus:bg-destructive/10 focus:text-destructive"
                                  onSelect={() => void setWorkspaceStatus(r.id, "ARCHIVED")}
                                >
                                  Arquivar
                                </DropdownMenu.Item>
                              ) : (
                                <DropdownMenu.Item
                                  className="cursor-pointer rounded-lg px-2 py-2 text-sm outline-none focus:bg-accent"
                                  onSelect={() => void setWorkspaceStatus(r.id, "ACTIVE")}
                                >
                                  Desarquivar
                                </DropdownMenu.Item>
                              )}
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTablePremium>
        )}
      </section>

      {/* Acessos relacionados */}
      <section className="space-y-4 border-t border-border/60 pt-10" aria-labelledby="related-title">
        <h2 id="related-title" className="text-lg font-bold tracking-tight text-foreground">
          Acessos relacionados
        </h2>
        <p className="text-sm text-muted-foreground">
          Atalhos para ações típicas da matriz após priorizar a fila e a tabela acima.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RelatedCard
            icon={Users2}
            title="Equipe da matriz"
            description="Membros, papéis e convites do workspace atual (matriz)."
            to="/usuarios"
          />
          <RelatedCard
            icon={Plug}
            title="Integrações da matriz"
            description="Conectores da organização ativa no seletor do topo."
            to="/marketing/integracoes"
          />
          <RelatedCard
            icon={Building2}
            title="Dados da empresa matriz"
            description="Nome e identificação exibidos no painel e nas integrações."
            to="/configuracoes/empresa"
          />
          <RelatedCard
            icon={FileText}
            title="Assinatura e limites"
            description="Hub de configurações com resumo de plano e cotas."
            to="/configuracoes"
          />
          <RelatedCard
            icon={ClipboardList}
            title="Auditoria / logs"
            description="Trilha de alterações por revenda ainda não disponível no produto."
            disabled
          />
          {platformAdmin ? (
            <RelatedCard
              icon={Shield}
              title="Administração da plataforma"
              description="Planos, tenants e operações globais."
              to="/plataforma"
            />
          ) : null}
        </div>

        <details className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Glossário: cliente comercial × workspace filho × matriz
          </summary>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Cliente (menu Clientes)</strong> é um registro comercial dentro do mesmo
            workspace. <strong className="text-foreground">Workspace filho</strong> é outro ambiente completo. A{" "}
            <strong className="text-foreground">matriz</strong> governa filhos nesta central.
          </p>
        </details>
      </section>

      {/* Modais */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="Criar workspace filho" className="max-w-lg" showClose>
          <p className="text-sm text-muted-foreground">
            Novo ambiente isolado: equipe, integrações e dados próprios. O slug é gerado automaticamente a partir do nome.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nw-name">Nome público da empresa / unidade</Label>
              <Input
                id="nw-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Ex.: Cliente XYZ — Operações"
                className="rounded-xl"
                aria-invalid={createName.length > 0 && createName.trim().length < 2}
              />
              {createName.length > 0 && createName.trim().length < 2 ? (
                <p className="text-xs text-destructive">Mínimo de 2 caracteres.</p>
              ) : null}
              <p className="text-[11px] text-muted-foreground">
                Slug sugerido: <code className="font-mono text-foreground/90">{suggestedSlug}</code> — o servidor garante
                unicidade.
              </p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/50 bg-muted/20 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 rounded border-input"
                checked={createInherit}
                onChange={(e) => setCreateInherit(e.target.checked)}
              />
              <span>
                <span className="font-semibold text-foreground">Herdar plano e limites da matriz</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Mantém contrato e cotas alinhados à agência. Desmarque apenas se a filial tiver plano próprio negociado.
                </span>
              </span>
            </label>
            <div className="space-y-2">
              <Label htmlFor="nw-note">Observação interna (opcional)</Label>
              <textarea
                id="nw-note"
                value={createNote}
                onChange={(e) => setCreateNote(e.target.value)}
                rows={3}
                className={cn(
                  "flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm",
                  "ring-offset-background placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                placeholder="Contrato, vertical, responsável comercial…"
              />
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 rounded border-input"
                checked={createSetupFlag}
                disabled={createStartMinimal}
                onChange={(e) => setCreateSetupFlag(e.target.checked)}
              />
              <span>
                <span className="font-semibold text-foreground">Marcar onboarding / setup pendente</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Aparece na coluna de alertas como “Setup pendente” para priorização.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 rounded border-input"
                checked={createStartMinimal}
                onChange={(e) => {
                  setCreateStartMinimal(e.target.checked);
                  if (e.target.checked) setCreateSetupFlag(false);
                }}
              />
              <span>
                <span className="font-semibold text-foreground">Iniciar vazio (sem marca de onboarding)</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Útil quando o workspace é só reserva de capacidade ou teste.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={createName.trim().length < 2 || createSubmitting}
              className="gap-2"
              onClick={() => void submitCreate()}
            >
              {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Criar workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent title="Editar workspace filho" className="max-w-md" showClose>
          {editRow ? (
            <>
              <p className="text-xs text-muted-foreground">
                Slug permanente: <code className="text-foreground">{editRow.slug}</code>
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ed-name">Nome público</Label>
                  <Input
                    id="ed-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ed-status">Status operacional</Label>
                  <select
                    id="ed-status"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as WorkspaceStatus)}
                  >
                    <option value="ACTIVE">Ativa</option>
                    <option value="PAUSED">Pausada</option>
                    <option value="ARCHIVED">Arquivada</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ed-note">Observação interna</Label>
                  <textarea
                    id="ed-note"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    rows={3}
                    className={cn(
                      "flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={editName.trim().length < 2 || editSubmitting}
                  onClick={() => void submitEdit()}
                >
                  {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SelectUi({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; t: string }[];
  label: string;
}) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-10 min-w-[9.5rem] appearance-none rounded-xl border border-input bg-background pl-3 pr-9 text-sm font-medium",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.t}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
    </div>
  );
}

function RelatedCard({
  icon: Icon,
  title,
  description,
  to,
  disabled,
}: {
  icon: typeof Users2;
  title: string;
  description: string;
  to?: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="flex gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/15 p-4 opacity-80">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="font-bold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    );
  }
  return (
    <Link
      to={to!}
      className={cn(
        "group flex gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all",
        "hover:border-primary/35 hover:shadow-md hover:ring-1 hover:ring-primary/15"
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-bold text-foreground group-hover:text-primary">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
          Abrir
          <ArrowRight className="h-3 w-3" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
