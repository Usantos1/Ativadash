import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Download,
  Layers,
  Loader2,
  MoreHorizontal,
  Plug,
  Plus,
  RefreshCw,
  Search,
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
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const STATUS_PT: Record<WorkspaceStatus, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
};

const SUBSCRIPTION_STATUS_PT: Record<string, string> = {
  active: "Assinatura ativa",
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

function KpiTile({
  label,
  value,
  hint,
  variant,
}: {
  label: string;
  value: string;
  hint?: string;
  variant?: "default" | "amber" | "destructive";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 shadow-[0_1px_0_0_hsl(var(--border)/0.25)]",
        variant === "amber" && "border-amber-500/30 bg-amber-500/[0.06]",
        variant === "destructive" && "border-destructive/35 bg-destructive/[0.06]",
        !variant && "border-border/55 bg-card/90"
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-lg font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function statusBadgeClass(s: WorkspaceStatus) {
  if (s === "ACTIVE") return "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
  if (s === "PAUSED") return "border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100";
  return "border-border/70 bg-muted/50 text-muted-foreground";
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
  const [filterHealth, setFilterHealth] = useState<"all" | "no_integration" | "no_members" | "stale">("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<ChildWorkspaceOperationsRow | null>(null);

  const [createName, setCreateName] = useState("");
  const [createInherit, setCreateInherit] = useState(true);
  const [createNote, setCreateNote] = useState("");
  const [createSetupFlag, setCreateSetupFlag] = useState(false);
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

  const filteredRows = useMemo(() => {
    const rows = dash?.organizations ?? [];
    return rows.filter((r) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !r.slug.toLowerCase().includes(q)) return false;
      }
      if (filterStatus !== "all" && r.workspaceStatus !== filterStatus) return false;
      if (filterHealth === "no_integration" && r.connectedIntegrations > 0) return false;
      if (filterHealth === "no_members" && r.memberCount > 0) return false;
      if (filterHealth === "stale" && !r.staleActivity) return false;
      return true;
    });
  }, [dash?.organizations, search, filterStatus, filterHealth]);

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
      if (createSetupFlag) {
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
    const rows = filteredRows;
    const header = [
      "Nome",
      "Slug",
      "Status",
      "Usuários",
      "Integrações",
      "Dashboards",
      "Última atividade",
      "Criado em",
      "Plano",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          `"${r.name.replace(/"/g, '""')}"`,
          r.slug,
          r.workspaceStatus,
          r.memberCount,
          r.connectedIntegrations,
          r.dashboardCount,
          r.lastActivityAt ?? "",
          r.createdAt,
          r.inheritPlanFromParent ? "herdado" : "próprio",
        ].join(",")
      ),
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
  const p = dash?.parent;

  return (
    <div className="min-w-0 space-y-8 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <AnalyticsPageHeader
          eyebrow="Matriz · multiempresa"
          title="Gestão de workspaces"
          subtitle={`Organização matriz: ${ctx.name}. Monitore filiais, integrações, equipe e consumo consolidado. Plano aplicado: ${planLabel}.`}
          breadcrumbs={[
            { label: "Configurações", href: "/configuracoes" },
            { label: "Gestão de workspaces" },
          ]}
          className="min-w-0 flex-1 [&>div]:max-w-none"
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            className="gap-2 rounded-lg"
            disabled={!revendaEnabled}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Novo workspace filho
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-lg"
            disabled={loadingOps}
            onClick={() => void loadOps()}
          >
            <RefreshCw className={cn("h-4 w-4", loadingOps && "animate-spin")} aria-hidden />
            Atualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-lg"
            disabled={filteredRows.length === 0}
            onClick={() => exportCsv()}
          >
            <Download className="h-4 w-4" aria-hidden />
            Exportar CSV
          </Button>
        </div>
      </div>

      {!revendaEnabled ? (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
          role="alert"
        >
          O plano atual <strong>não inclui</strong> workspaces filhos (revenda). Quando estiver habilitado, esta página
          concentra cadastro, métricas e governança das filiais.
        </div>
      ) : null}

      {opsError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {opsError}{" "}
          <span className="text-foreground/80">
            Apenas administradores diretos da matriz visualizam a operação consolidada.
          </span>
        </div>
      ) : null}

      {actionError ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {dash && !opsError ? (
        <section className="space-y-3" aria-label="Indicadores da operação">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Indicadores da operação</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
            <KpiTile label="Workspaces cadastrados" value={String(dash.summary.totalWorkspaces)} />
            <KpiTile
              label="Ativos / pausados / arquivados"
              value={`${dash.summary.activeWorkspaces} / ${dash.summary.pausedWorkspaces} / ${dash.summary.archivedWorkspaces}`}
            />
            <KpiTile
              label="Sem integração (ativos)"
              value={String(dash.summary.withoutIntegration)}
              variant={dash.summary.withoutIntegration > 0 ? "amber" : "default"}
            />
            <KpiTile
              label="Sem membros (ativos)"
              value={String(dash.summary.withoutMembers)}
              variant={dash.summary.withoutMembers > 0 ? "amber" : "default"}
            />
            <KpiTile
              label="Sem atividade recente"
              value={String(dash.summary.staleActivityCount)}
              hint="≈ 14 dias sem sync/movimento registrado"
            />
            <KpiTile
              label="Uso do limite de filiais"
              value={`${dash.summary.childSlotsUsed} / ${formatPlanLimit(dash.summary.childSlotsCap, { zeroMeansNotIncluded: true })}`}
              variant={
                dash.summary.childSlotsCap != null &&
                dash.summary.childSlotsCap > 0 &&
                dash.summary.childSlotsUsed >= dash.summary.childSlotsCap
                  ? "destructive"
                  : "default"
              }
            />
            <KpiTile label="Integrações (total nas filiais)" value={String(dash.summary.integrationsTotalAcrossChildren)} />
            <KpiTile label="Usuários (total nas filiais)" value={String(dash.summary.usersTotalAcrossChildren)} />
          </div>
        </section>
      ) : null}

      {dash && dash.alerts.length > 0 && !opsError ? (
        <Card className="rounded-2xl border-border/60 shadow-[var(--shadow-surface-sm)]">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
              <CardTitle className="text-base font-semibold">Alertas operacionais</CardTitle>
            </div>
            <CardDescription>Priorize filiais que precisam de ação (integração, equipe, limite ou status).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {dash.alerts.slice(0, 12).map((a, i) => (
              <div
                key={`${a.type}-${a.organizationId}-${i}`}
                className={cn(
                  "flex flex-wrap items-baseline justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                  a.severity === "critical" && "border-destructive/40 bg-destructive/[0.07]",
                  a.severity === "warning" && "border-amber-500/35 bg-amber-500/[0.06]",
                  a.severity === "info" && "border-border/60 bg-muted/25"
                )}
              >
                <span className="font-medium text-foreground">
                  {a.name ? `${a.name} · ` : null}
                  {a.message}
                </span>
                {a.organizationId && a.name ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 text-xs"
                    onClick={() => void enterWorkspace(a.organizationId)}
                    disabled={switchingId === a.organizationId}
                  >
                    Entrar
                  </Button>
                ) : null}
              </div>
            ))}
            {dash.alerts.length > 12 ? (
              <p className="text-xs text-muted-foreground">+{dash.alerts.length - 12} alertas adicionais na operação.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {p && !opsError ? (
        <Card className="rounded-2xl border-border/60 shadow-[var(--shadow-surface-sm)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Consumo consolidado da matriz</CardTitle>
            <CardDescription>
              Cotas efetivas do workspace atual (matriz).{" "}
              {ctx.limitsHaveOverrides ? (
                <span className="font-medium text-foreground">Limites personalizados pela plataforma.</span>
              ) : null}{" "}
              {subStatus ? (
                <span className="text-foreground/90">
                  Contrato: {SUBSCRIPTION_STATUS_PT[subStatus] ?? subStatus}
                  {ctx.subscription?.renewsAt
                    ? ` · renovação ${new Date(ctx.subscription.renewsAt).toLocaleDateString("pt-BR")}`
                    : ""}
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <div className="rounded-lg border border-border/55 bg-muted/20 p-3 text-sm">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Workspaces filhos</p>
                <p className="mt-1 font-semibold tabular-nums">
                  {p.usage.childOrganizations}{" "}
                  <span className="text-muted-foreground">
                    / {formatPlanLimit(p.limits.maxChildOrganizations, { zeroMeansNotIncluded: true })}
                  </span>
                </p>
              </div>
              <div className="rounded-lg border border-border/55 bg-muted/20 p-3 text-sm">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Usuários (matriz)</p>
                <p className="mt-1 font-semibold tabular-nums">
                  {p.usage.directMembers + (p.usage.pendingInvitations ?? 0)}{" "}
                  <span className="text-muted-foreground">/ {formatPlanCap(p.limits.maxUsers)}</span>
                </p>
              </div>
              <div className="rounded-lg border border-border/55 bg-muted/20 p-3 text-sm">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Integrações (matriz)</p>
                <p className="mt-1 font-semibold tabular-nums">
                  {p.usage.integrations}{" "}
                  <span className="text-muted-foreground">/ {p.limits.maxIntegrations}</span>
                </p>
              </div>
              <div className="rounded-lg border border-border/55 bg-muted/20 p-3 text-sm">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Dashboards (matriz)</p>
                <p className="mt-1 font-semibold tabular-nums">
                  {p.usage.dashboards}{" "}
                  <span className="text-muted-foreground">/ {formatPlanCap(p.limits.maxDashboards)}</span>
                </p>
              </div>
              <div className="rounded-lg border border-border/55 bg-muted/20 p-3 text-sm">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Clientes comerciais</p>
                <p className="mt-1 font-semibold tabular-nums">
                  {p.usage.clientAccounts}{" "}
                  <span className="text-muted-foreground">/ {formatPlanCap(p.limits.maxClientAccounts)}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3" aria-labelledby="table-workspaces-title">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="table-workspaces-title" className="text-sm font-semibold text-foreground">
              Workspaces filhos
            </h2>
            <p className="text-xs text-muted-foreground">Tabela operacional com governança, métricas e ações.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou slug…"
                className="h-9 rounded-lg pl-8"
                aria-label="Buscar workspace"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <select
                  className={cn(
                    "h-9 appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                  aria-label="Filtrar por status"
                >
                  <option value="all">Todos os status</option>
                  <option value="ACTIVE">Ativa</option>
                  <option value="PAUSED">Pausada</option>
                  <option value="ARCHIVED">Arquivada</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
              </div>
              <div className="relative">
                <select
                  className={cn(
                    "h-9 appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                  value={filterHealth}
                  onChange={(e) => setFilterHealth(e.target.value as typeof filterHealth)}
                  aria-label="Filtrar por saúde"
                >
                  <option value="all">Saúde: todas</option>
                  <option value="no_integration">Sem integração</option>
                  <option value="no_members">Sem usuários</option>
                  <option value="stale">Sem atividade recente</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
              </div>
            </div>
          </div>
        </div>

        {loadingOps && !dash ? (
          <DataTablePremium zebra minHeight="min-h-[12rem]">
            <thead>
              <tr>
                <th scope="col">Workspace</th>
                <th scope="col">Status</th>
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
                <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-primary" aria-hidden />
                  Carregando operação…
                </td>
              </tr>
            </tbody>
          </DataTablePremium>
        ) : opsError ? null : filteredRows.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={dash?.organizations.length === 0 ? "Nenhum workspace filho" : "Nenhum resultado"}
            description={
              dash?.organizations.length === 0
                ? "Crie o primeiro workspace para isolar dados, integrações e equipe de cada cliente ou unidade."
                : "Ajuste filtros ou a busca para ver as filiais."
            }
            actionLabel={dash?.organizations.length === 0 && revendaEnabled ? "Novo workspace filho" : undefined}
            onAction={dash?.organizations.length === 0 && revendaEnabled ? () => setCreateOpen(true) : undefined}
          />
        ) : (
          <DataTablePremium zebra minHeight="min-h-[14rem]">
            <thead>
              <tr>
                <th scope="col">Workspace</th>
                <th scope="col">Status</th>
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
              {filteredRows.map((r) => {
                const busy = switchingId === r.id;
                return (
                  <tr key={r.id} className={r.needsAttention ? "bg-amber-500/[0.04]" : undefined}>
                    <td className="align-middle">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground">{r.name}</span>
                        <code className="text-[11px] text-muted-foreground">{r.slug}</code>
                        {r.pendingInvitationsCount > 0 ? (
                          <span className="text-[10px] font-medium text-primary">
                            {r.pendingInvitationsCount} convite(s) pendente(s)
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="align-middle">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                          statusBadgeClass(r.workspaceStatus)
                        )}
                      >
                        {STATUS_PT[r.workspaceStatus]}
                      </span>
                    </td>
                    <td className="align-middle tabular-nums">{r.memberCount}</td>
                    <td className="align-middle tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Plug className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        {r.connectedIntegrations}
                      </span>
                    </td>
                    <td className="align-middle tabular-nums">{r.dashboardCount}</td>
                    <td className="align-middle text-xs text-muted-foreground">{formatDateTime(r.lastActivityAt)}</td>
                    <td className="align-middle text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                    <td className="align-middle">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                          r.inheritPlanFromParent
                            ? "border-primary/25 bg-primary/[0.06] text-primary"
                            : "border-border/70 bg-muted/40 text-muted-foreground"
                        )}
                      >
                        {r.inheritPlanFromParent ? "Herdado" : "Próprio"}
                      </span>
                    </td>
                    <td className="align-middle text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 rounded-lg px-2 text-xs"
                          onClick={() => void enterWorkspace(r.id)}
                          disabled={busy}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                          Entrar
                        </Button>
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 rounded-lg p-0">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Mais ações</span>
                            </Button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              className="z-50 min-w-[11rem] rounded-xl border border-border/80 bg-popover p-1 shadow-[var(--shadow-surface)]"
                              sideOffset={6}
                              align="end"
                            >
                              <DropdownMenu.Item
                                className="cursor-pointer rounded-lg px-2 py-2 text-sm outline-none focus:bg-accent"
                                onSelect={() => openEdit(r)}
                              >
                                Editar…
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                className="cursor-pointer rounded-lg px-2 py-2 text-sm outline-none focus:bg-accent"
                                onSelect={() => void copySlug(r.slug)}
                              >
                                Copiar slug
                              </DropdownMenu.Item>
                              {r.workspaceStatus !== "PAUSED" ? (
                                <DropdownMenu.Item
                                  className="cursor-pointer rounded-lg px-2 py-2 text-sm outline-none focus:bg-accent"
                                  onSelect={() => void setWorkspaceStatus(r.id, "PAUSED")}
                                >
                                  Pausar
                                </DropdownMenu.Item>
                              ) : (
                                <DropdownMenu.Item
                                  className="cursor-pointer rounded-lg px-2 py-2 text-sm outline-none focus:bg-accent"
                                  onSelect={() => void setWorkspaceStatus(r.id, "ACTIVE")}
                                >
                                  Reativar
                                </DropdownMenu.Item>
                              )}
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

      <footer className="flex flex-col gap-4 border-t border-border/50 pt-6 text-xs text-muted-foreground">
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/usuarios" className="font-medium text-primary underline-offset-4 hover:underline">
            Equipe da matriz
          </Link>
          <Link to="/marketing/integracoes" className="font-medium text-primary underline-offset-4 hover:underline">
            Integrações da matriz
          </Link>
          <Link to="/configuracoes/empresa" className="font-medium text-primary underline-offset-4 hover:underline">
            Dados da empresa matriz
          </Link>
          <Link to="/configuracoes" className="font-medium text-primary underline-offset-4 hover:underline">
            Configurações e assinatura
          </Link>
          {platformAdmin ? (
            <Link to="/plataforma" className="font-medium text-primary underline-offset-4 hover:underline">
              Administração da plataforma
            </Link>
          ) : null}
          <span className="text-muted-foreground/80">Auditoria de revenda: em evolução.</span>
        </p>

        <details className="rounded-lg border border-border/50 bg-muted/15 px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-foreground/90">
            Cliente comercial × workspace filho × matriz
          </summary>
          <p className="mt-2 max-w-3xl leading-relaxed">
            <strong className="text-foreground">Cliente (menu Clientes)</strong> é um registro comercial dentro do mesmo
            workspace. <strong className="text-foreground">Workspace filho</strong> é outro ambiente completo (dados,
            integrações, equipe isolados). A <strong className="text-foreground">matriz</strong> é a organização que
            cria e governa esses workspaces nesta página.
          </p>
        </details>
      </footer>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="Novo workspace filho" className="max-w-md">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nw-name">Nome público</Label>
              <Input
                id="nw-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Ex.: Agência Sul"
                className="rounded-lg"
              />
              <p className="text-[11px] text-muted-foreground">
                Slug sugerido: <code className="text-foreground/90">{suggestedSlug}</code> (ajustado no servidor se já
                existir)
              </p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 rounded border-input"
                checked={createInherit}
                onChange={(e) => setCreateInherit(e.target.checked)}
              />
              <span>
                <span className="font-medium text-foreground">Herdar plano e limites da matriz</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Recomendado para operação homogênea.</span>
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
                  "flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm",
                  "ring-offset-background placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                placeholder="Notas visíveis na gestão da matriz…"
              />
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 rounded border-input"
                checked={createSetupFlag}
                onChange={(e) => setCreateSetupFlag(e.target.checked)}
              />
              <span>
                <span className="font-medium text-foreground">Marcar setup inicial pendente</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Anexa um rótulo na observação para priorizar onboarding.
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
              onClick={() => void submitCreate()}
            >
              {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent title="Editar workspace filho" className="max-w-md">
          {editRow ? (
            <>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Slug fixo: <code>{editRow.slug}</code> (identificador estável)
                </p>
                <div className="space-y-2">
                  <Label htmlFor="ed-name">Nome público</Label>
                  <Input
                    id="ed-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ed-status">Status operacional</Label>
                  <select
                    id="ed-status"
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
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
                      "flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm",
                      "ring-offset-background placeholder:text-muted-foreground",
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
