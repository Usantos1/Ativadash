import { useCallback, useEffect, useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  TrendingUp,
  UserCog,
  Users2,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderPremium, KpiCardPremium, StatusBadge } from "@/components/premium";
import { formatNumber, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import {
  createManagedOrganization,
  fetchChildrenOperationsDashboard,
  formatPlanCap,
  patchChildWorkspace,
  setActiveOrganization,
  type ChildWorkspaceOperationsRow,
  type WorkspaceStatus,
} from "@/lib/organization-api";
import { getWorkspaceHealth } from "@/lib/revenda-workspace-metrics";
import { OperationsModuleNav } from "@/components/operations/operations-module-nav";
import { ClientDetailDialog } from "@/components/operations/client-detail-dialog";
import { ClientWorkspaceTeamDialog } from "@/components/operations/ClientWorkspaceTeamDialog";
import { useAuthStore } from "@/stores/auth-store";
import { AGENCY_WORKSPACE_ROLE_LABEL, AGENCY_WORKSPACE_ROLE_ORDER } from "@/lib/agency-workspace-roles";
import { ApiClientError } from "@/lib/api";

function displayClientStatus(row: ChildWorkspaceOperationsRow): {
  label: string;
  tone: "healthy" | "alert" | "disconnected";
  critical: boolean;
} {
  const h = getWorkspaceHealth(row);
  if (h === "INATIVO") {
    return {
      label: row.workspaceStatus === "PAUSED" ? "Pausado" : "Arquivado",
      tone: "disconnected",
      critical: row.workspaceStatus === "ARCHIVED",
    };
  }
  if (row.memberCount === 0) {
    return { label: "Crítico", tone: "disconnected", critical: true };
  }
  const cpl = row.cplAlertLevel;
  if (cpl === "CRITICAL") return { label: "Crítico", tone: "disconnected", critical: true };
  if (cpl === "WARNING") return { label: "Atenção", tone: "alert", critical: false };
  if (h === "CRITICO") return { label: "Crítico", tone: "disconnected", critical: true };
  if (h === "ATENCAO") return { label: "Atenção", tone: "alert", critical: false };
  if (h === "OK") {
    const m = row.marketing30d;
    const hasSignal =
      row.metaAdsConnected ||
      row.googleAdsConnected ||
      (m != null && (m.spend > 0 || m.leads > 0));
    if (!hasSignal) return { label: "Sem dados", tone: "healthy", critical: false };
    return { label: "Ativo", tone: "healthy", critical: false };
  }
  return { label: "Atenção", tone: "alert", critical: false };
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export function ClientsPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof fetchChildrenOperationsDashboard>> | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<ChildWorkspaceOperationsRow | null>(null);
  const [editRow, setEditRow] = useState<ChildWorkspaceOperationsRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<WorkspaceStatus>("ACTIVE");
  const [editSaving, setEditSaving] = useState(false);
  const [teamRow, setTeamRow] = useState<ChildWorkspaceOperationsRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setForbidden(false);
    setLoading(true);
    try {
      const data = await fetchChildrenOperationsDashboard();
      setDashboard(data);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 403) {
        setForbidden(true);
      } else {
        setError(e instanceof Error ? e.message : "Erro ao carregar");
      }
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = dashboard?.organizations ?? [];
  const summary = dashboard?.summary;
  const parent = dashboard?.parent;
  const canCreateChild = dashboard?.capabilities?.canCreateChildWorkspaces ?? false;
  const canManageChildMembers = dashboard?.capabilities?.canManageChildWorkspaceMembers ?? false;
  const canPatchChild = dashboard?.capabilities?.canPatchChildWorkspace ?? false;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  const clientsWithAlert = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.workspaceStatus !== "ACTIVE" ||
          r.needsAttention ||
          r.cplAlertLevel === "CRITICAL" ||
          r.cplAlertLevel === "WARNING" ||
          getWorkspaceHealth(r) === "CRITICO" ||
          getWorkspaceHealth(r) === "ATENCAO"
      ).length,
    [rows]
  );

  const atChildLimit =
    summary?.childSlotsCap != null &&
    summary.childSlotsCap > 0 &&
    summary.childSlotsUsed >= summary.childSlotsCap;

  async function switchToClient(organizationId: string, thenPath: string) {
    setSwitchingId(organizationId);
    setError(null);
    try {
      const res = await setActiveOrganization(organizationId);
      setAuth(
        { ...res.user, organization: res.user.organization },
        res.accessToken,
        res.refreshToken,
        {
          memberships: res.memberships,
          managedOrganizations: res.managedOrganizations ?? [],
        }
      );
      navigate(thenPath, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar no cliente.");
    } finally {
      setSwitchingId(null);
    }
  }

  function openEditWorkspace(row: ChildWorkspaceOperationsRow) {
    setEditRow(row);
    setEditName(row.name);
    setEditStatus(row.workspaceStatus);
  }

  async function handleSaveWorkspace() {
    if (!editRow) return;
    const n = editName.trim();
    if (n.length < 2) return;
    setEditSaving(true);
    setError(null);
    try {
      await patchChildWorkspace(editRow.id, { name: n, workspaceStatus: editStatus });
      setEditRow(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar conta.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleCreate() {
    const n = newName.trim();
    if (n.length < 2) return;
    setCreating(true);
    setError(null);
    try {
      await createManagedOrganization(n, { inheritPlanFromParent: true });
      setOpenCreate(false);
      setNewName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar workspace.");
    } finally {
      setCreating(false);
    }
  }

  if (forbidden && !loading) {
    return (
      <div className="w-full space-y-6">
        <PageHeaderPremium
          eyebrow="Operação"
          title="Clientes"
          subtitle="Central de contas da agência: workspaces isolados, acessos e estrutura operacional."
        />
        <div className="rounded-2xl border border-border/50 bg-card/40 p-8 text-center shadow-[var(--shadow-surface-sm)]">
          <p className="text-sm text-muted-foreground">
            Central de contas disponível para administradores da organização matriz.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-16">
      <PageHeaderPremium
        eyebrow="Operação"
        title="Clientes"
        subtitle="Gerencie as contas da agência, workspaces, acessos e vínculo com projetos e lançamentos."
        meta={<OperationsModuleNav />}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <div className="relative min-w-0 sm:w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-lg border-border/60 pl-9"
              />
            </div>
            {canCreateChild ? (
              <Button
                className="h-9 rounded-lg"
                onClick={() => {
                  setNewName("");
                  setOpenCreate(true);
                }}
                disabled={atChildLimit}
                title={atChildLimit ? "Limite de workspaces do plano" : undefined}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo cliente
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-destructive/35 bg-destructive/[0.08] px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCardPremium
            variant="primary"
            label="Clientes ativos"
            value={String(summary.activeWorkspaces)}
            hideSource
            icon={Building2}
          />
          <KpiCardPremium
            variant="secondary"
            label="Uso do plano"
            value={`${summary.childSlotsUsed} / ${formatPlanCap(summary.childSlotsCap)}`}
            hideSource
            hint={parent?.plan?.name ?? undefined}
            icon={TrendingUp}
          />
          <KpiCardPremium
            variant="secondary"
            label="Com alerta"
            value={String(clientsWithAlert)}
            hideSource
            icon={AlertTriangle}
          />
          <KpiCardPremium
            variant="secondary"
            label="Contas c/ lanç. ativos"
            value={String(summary.childrenWithActiveLaunches ?? 0)}
            hideSource
            hint="Workspaces com pelo menos um lançamento na janela atual."
            icon={TrendingUp}
          />
        </div>
      )}

      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            {search.trim() ? "Nenhum resultado." : "Nenhum workspace filho ainda."}
          </p>
          {!search.trim() ? (
            <Button className="mt-4 rounded-lg" onClick={() => setOpenCreate(true)} disabled={atChildLimit}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeiro cliente
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-4">
          {filteredRows.map((row) => {
            const st = displayClientStatus(row);
            const busy = switchingId === row.id;
            const m = row.marketing30d;
            const pc = row.projectCount ?? 0;
            const lc = row.launchCount ?? 0;
            const lac = row.activeLaunchCount ?? 0;
            const cc = row.clientAccountCount ?? 0;
            return (
              <li
                key={row.id}
                className={cn(
                  "overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-[var(--shadow-surface-sm)] transition-shadow hover:shadow-[var(--shadow-surface)]",
                  st.critical && "border-rose-500/35 ring-1 ring-rose-500/15"
                )}
              >
                <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-black tracking-tight text-foreground">{row.name}</h2>
                        {st.critical ? (
                          <span className="shrink-0 rounded-md border border-rose-500/40 bg-rose-500/[0.12] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rose-900 dark:text-rose-100">
                            {st.label}
                          </span>
                        ) : (
                          <StatusBadge tone={st.tone} dot>
                            {st.label}
                          </StatusBadge>
                        )}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">/{row.slug}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Projetos</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">{pc}</p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Lanç. ativos</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">{lac}</p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Lanç. total</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">{lc}</p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Contas comerciais</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">{cc}</p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Leads · 30d</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">
                          {m ? formatNumber(Math.round(m.leads)) : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">CPL</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">
                          {m?.cpl != null ? formatSpend(m.cpl) : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Invest. · 30d</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">
                          {m ? formatSpend(m.spend) : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Última atividade</p>
                        <p className="mt-0.5 text-xs font-semibold leading-snug text-foreground">
                          {formatShortDate(row.lastActivityAt ?? row.lastIntegrationSyncAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Plataformas</span>
                      {row.metaAdsConnected ? (
                        <span className="rounded-md border border-border/50 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                          Meta
                        </span>
                      ) : null}
                      {row.googleAdsConnected ? (
                        <span className="rounded-md border border-border/50 bg-sky-500/10 px-2 py-0.5 text-[11px] font-bold text-sky-800 dark:text-sky-200">
                          Google
                        </span>
                      ) : null}
                      {!row.metaAdsConnected && !row.googleAdsConnected ? (
                        <span className="text-xs text-muted-foreground">Nenhuma</span>
                      ) : null}
                      <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                        {row.memberCount} com acesso
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-10 rounded-xl"
                      disabled={busy}
                      onClick={() => setTeamRow(row)}
                    >
                      <Users2 className="mr-2 h-4 w-4" />
                      Equipe
                    </Button>
                    <Button
                      className="h-10 rounded-xl"
                      disabled={busy}
                      onClick={() => void switchToClient(row.id, "/marketing")}
                    >
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                      Entrar no cliente
                    </Button>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <Button variant="outline" className="h-10 rounded-xl" disabled={busy} type="button">
                          <MoreHorizontal className="mr-2 h-4 w-4" />
                          Ações
                          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                        </Button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="z-50 min-w-[14rem] rounded-xl border border-border/60 bg-popover p-1 shadow-lg"
                          sideOffset={6}
                          align="end"
                        >
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted"
                            onSelect={(e) => {
                              e.preventDefault();
                              setDetailRow(row);
                            }}
                          >
                            <Eye className="h-4 w-4 opacity-70" />
                            Ver detalhes
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted"
                            onSelect={(e) => {
                              e.preventDefault();
                              setTeamRow(row);
                            }}
                          >
                            <Users2 className="h-4 w-4 opacity-70" />
                            Equipe deste cliente
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted"
                            onSelect={(e) => {
                              e.preventDefault();
                              void switchToClient(row.id, "/usuarios");
                            }}
                          >
                            <UserCog className="h-4 w-4 opacity-70" />
                            Entrar e abrir Usuários
                          </DropdownMenu.Item>
                          {canPatchChild ? (
                            <DropdownMenu.Item
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted"
                              onSelect={(e) => {
                                e.preventDefault();
                                openEditWorkspace(row);
                              }}
                            >
                              <Pencil className="h-4 w-4 opacity-70" />
                              Editar conta
                            </DropdownMenu.Item>
                          ) : null}
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted"
                            onSelect={(e) => {
                              e.preventDefault();
                              void switchToClient(row.id, "/marketing/configuracoes");
                            }}
                          >
                            <Settings className="h-4 w-4 opacity-70" />
                            Integrações e ajustes
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
        <p className="text-xs text-muted-foreground">Papéis por workspace (evolução)</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          type="button"
          onClick={() => setRolesOpen(true)}
        >
          Ver papéis
        </Button>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent title="Novo cliente" showClose>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-client-name">Nome do workspace</Label>
            <Input
              id="new-client-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex.: Marca do cliente"
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={creating || newName.trim().length < 2} onClick={() => void handleCreate()}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent title="Papéis no cliente" showClose>
          <p className="text-sm text-muted-foreground">
            Modelo previsto para permissões por workspace. Hoje a equipe é gerida em{" "}
            <strong className="text-foreground">Usuários</strong> após entrar no cliente.
          </p>
          <ul className="space-y-2 py-2 text-sm">
            {AGENCY_WORKSPACE_ROLE_ORDER.map((k) => (
              <li key={k} className="flex justify-between rounded-lg border border-border/50 px-3 py-2">
                <span className="font-medium">{AGENCY_WORKSPACE_ROLE_LABEL[k]}</span>
                <span className="text-xs text-muted-foreground">{k}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" variant="secondary" className="rounded-lg" onClick={() => setRolesOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {teamRow ? (
        <ClientWorkspaceTeamDialog
          open={!!teamRow}
          onOpenChange={(v) => {
            if (!v) setTeamRow(null);
          }}
          workspaceId={teamRow.id}
          workspaceName={teamRow.name}
          canManageAccess={canManageChildMembers}
        />
      ) : null}

      {detailRow ? (
        <ClientDetailDialog
          open={!!detailRow}
          onOpenChange={(v) => {
            if (!v) setDetailRow(null);
          }}
          row={detailRow}
          statusLabel={displayClientStatus(detailRow).label}
          statusTone={displayClientStatus(detailRow).tone}
          statusCritical={displayClientStatus(detailRow).critical}
          onEnterClient={(id) => void switchToClient(id, "/marketing")}
          onManageAccess={(id) => void switchToClient(id, "/usuarios")}
          entering={switchingId === detailRow.id}
          formatDate={formatShortDate}
        />
      ) : null}

      <Dialog
        open={!!editRow}
        onOpenChange={(v) => {
          if (!v) setEditRow(null);
        }}
      >
        <DialogContent title="Editar conta" showClose>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-ws-name">Nome do workspace</Label>
              <Input
                id="edit-ws-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Status operacional</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as WorkspaceStatus)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="PAUSED">Pausado</SelectItem>
                  <SelectItem value="ARCHIVED">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setEditRow(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={editSaving || editName.trim().length < 2}
              onClick={() => void handleSaveWorkspace()}
            >
              {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
