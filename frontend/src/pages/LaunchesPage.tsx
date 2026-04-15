import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  CalendarDays,
  ChevronDown,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
  Rocket,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderPremium, KpiCardPremium, StatusBadge } from "@/components/premium";
import {
  fetchProjects,
  fetchLaunches,
  createLaunch,
  updateLaunch,
  deleteLaunch,
  type ProjectRow,
  type LaunchRow,
} from "@/lib/workspace-api";
import { OperationsModuleNav } from "@/components/operations/operations-module-nav";
import { launchWindowKind, launchWindowLabel } from "@/lib/launch-operational";
import { cn } from "@/lib/utils";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fromDateInput(s: string): string | undefined {
  if (!s) return undefined;
  return new Date(`${s}T12:00:00`).toISOString();
}

type StatusFilter = "all" | "active" | "future" | "ended";

export function LaunchesPage() {
  usePageTitle(formatPageTitle(["Lançamentos"]));
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [allRows, setAllRows] = useState<LaunchRow[]>([]);
  const [filterProjectId, setFilterProjectId] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LaunchRow | null>(null);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const p = await fetchProjects();
      setProjects(p);
      const list = await fetchLaunches();
      setAllRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const pid = searchParams.get("project");
    if (pid && projects.some((p) => p.id === pid)) {
      setFilterProjectId(pid);
    }
  }, [searchParams, projects]);

  const projectById = useMemo(() => {
    const m = new Map<string, ProjectRow>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  const projectScoped = useMemo(() => {
    if (filterProjectId === "__all__") return allRows;
    return allRows.filter((r) => r.projectId === filterProjectId);
  }, [allRows, filterProjectId]);

  const rowsWithKind = useMemo(() => {
    return projectScoped.map((r) => ({
      row: r,
      kind: launchWindowKind(r.startDate, r.endDate),
    }));
  }, [projectScoped]);

  const filteredByStatus = useMemo(() => {
    if (statusFilter === "all") return rowsWithKind;
    if (statusFilter === "active") {
      return rowsWithKind.filter((x) => x.kind === "active" || x.kind === "open");
    }
    if (statusFilter === "future") return rowsWithKind.filter((x) => x.kind === "future");
    return rowsWithKind.filter((x) => x.kind === "ended");
  }, [rowsWithKind, statusFilter]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filteredByStatus;
    return filteredByStatus.filter(
      ({ row: r }) =>
        r.name.toLowerCase().includes(q) ||
        r.project.name.toLowerCase().includes(q) ||
        (projectById.get(r.projectId)?.clientAccount?.name ?? "").toLowerCase().includes(q)
    );
  }, [filteredByStatus, search, projectById]);

  const activeCount = useMemo(
    () => rowsWithKind.filter((x) => x.kind === "active" || x.kind === "open").length,
    [rowsWithKind]
  );
  const futureCount = useMemo(() => rowsWithKind.filter((x) => x.kind === "future").length, [rowsWithKind]);
  const endedCount = useMemo(() => rowsWithKind.filter((x) => x.kind === "ended").length, [rowsWithKind]);

  const projectsWithCalendar = useMemo(() => {
    const ids = new Set(projectScoped.map((r) => r.projectId));
    return ids.size;
  }, [projectScoped]);

  function setProjectFilter(id: string) {
    setFilterProjectId(id);
    const next = new URLSearchParams(searchParams);
    if (id === "__all__") next.delete("project");
    else next.set("project", id);
    setSearchParams(next, { replace: true });
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setProjectId(filterProjectId !== "__all__" ? filterProjectId : projects[0]?.id ?? "");
    setStartDate("");
    setEndDate("");
    setOpen(true);
  }

  function openEdit(row: LaunchRow) {
    setEditing(row);
    setName(row.name);
    setProjectId(row.projectId);
    setStartDate(toDateInput(row.startDate));
    setEndDate(toDateInput(row.endDate));
    setOpen(true);
  }

  function duplicateFrom(row: LaunchRow) {
    setEditing(null);
    setName(`${row.name} (cópia)`);
    setProjectId(row.projectId);
    setStartDate(toDateInput(row.startDate));
    setEndDate(toDateInput(row.endDate));
    setOpen(true);
  }

  async function handleSave() {
    const n = name.trim();
    if (!n) return;
    if (!projectId) {
      setError("Selecione um projeto.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const sd = startDate ? fromDateInput(startDate) : null;
      const ed = endDate ? fromDateInput(endDate) : null;
      if (editing) {
        await updateLaunch(editing.id, {
          name: n,
          startDate: sd ?? null,
          endDate: ed ?? null,
        });
      } else {
        await createLaunch({
          projectId,
          name: n,
          startDate: sd,
          endDate: ed,
        });
      }
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: LaunchRow) {
    if (!confirm(`Remover o lançamento "${row.name}"?`)) return;
    try {
      await deleteLaunch(row.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover");
    }
  }

  const filterChips: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "active", label: "Ativos" },
    { id: "future", label: "Futuros" },
    { id: "ended", label: "Encerrados" },
  ];

  return (
    <div className="w-full space-y-6 pb-12">
      <PageHeaderPremium
        eyebrow="Operação"
        title="Lançamentos"
        subtitle="Gerencie janelas operacionais por projeto e use esses recortes para filtrar mídia e contexto no ADS."
        meta={<OperationsModuleNav />}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <div className="relative min-w-0 sm:w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar lançamento, projeto ou cliente"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-lg border-border/60 pl-9"
              />
            </div>
            <Button className="h-9 rounded-lg" onClick={openCreate} disabled={projects.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Novo lançamento
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-destructive/35 bg-destructive/[0.08] px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && projects.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCardPremium variant="primary" label="Ativos (filtro)" value={String(activeCount)} icon={Rocket} hideSource />
          <KpiCardPremium variant="secondary" label="Futuros" value={String(futureCount)} icon={CalendarDays} hideSource />
          <KpiCardPremium variant="secondary" label="Encerrados" value={String(endedCount)} icon={CalendarDays} hideSource />
          <KpiCardPremium
            variant="secondary"
            label="Projetos c/ lançamentos"
            value={String(projectsWithCalendar)}
            hideSource
            hint="No recorte de projeto atual ou global."
            icon={Rocket}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card/35 p-4 shadow-[var(--shadow-surface-sm)] sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Projeto</span>
          <Select value={filterProjectId} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-10 rounded-xl border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os projetos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Status da janela</span>
          <div className="flex flex-wrap gap-2">
            {filterChips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setStatusFilter(c.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  statusFilter === c.id
                    ? "border-primary/45 bg-primary/12 text-primary"
                    : "border-border/55 bg-muted/20 text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 px-6 py-12 text-center text-sm text-muted-foreground">
          Crie um{" "}
          <Link to="/projetos" className="font-medium text-primary underline-offset-2 hover:underline">
            projeto
          </Link>{" "}
          antes de cadastrar lançamentos.
        </div>
      ) : loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhum lançamento neste recorte. Ajuste filtros ou crie uma janela.
        </div>
      ) : (
        <ul className="grid gap-4">
          {filteredRows.map(({ row, kind }) => {
            const clientName = projectById.get(row.projectId)?.clientAccount?.name ?? "—";
            const statusLabel = launchWindowLabel(kind);
            const tone =
              kind === "active" || kind === "open"
                ? ("healthy" as const)
                : kind === "future"
                  ? ("alert" as const)
                  : ("disconnected" as const);
            return (
              <li
                key={row.id}
                className="overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-[var(--shadow-surface-sm)] transition-shadow hover:shadow-[var(--shadow-surface)]"
              >
                <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black tracking-tight text-foreground">{row.name}</h2>
                      <StatusBadge tone={tone} dot>
                        {statusLabel}
                      </StatusBadge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2 lg:col-span-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Projeto</p>
                        <p className="mt-0.5 text-sm font-semibold">{row.project.name}</p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2 lg:col-span-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Cliente</p>
                        <p className="mt-0.5 text-sm font-semibold text-muted-foreground">{clientName}</p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Início</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums">
                          {row.startDate ? new Date(row.startDate).toLocaleDateString("pt-BR") : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Fim</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums">
                          {row.endDate ? new Date(row.endDate).toLocaleDateString("pt-BR") : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Campanhas</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">Filtro por nome no ADS</p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Atualizado</p>
                        <p className="mt-0.5 text-xs font-semibold">
                          {new Date(row.updatedAt).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                    <Button className="h-10 rounded-xl" asChild>
                      <Link to="/marketing">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir contexto
                      </Link>
                    </Button>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <Button variant="outline" className="h-10 rounded-xl" type="button">
                          <MoreHorizontal className="mr-2 h-4 w-4" />
                          Ações
                          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                        </Button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="z-50 min-w-[12rem] rounded-xl border border-border/60 bg-popover p-1 shadow-lg"
                          align="end"
                          sideOffset={6}
                        >
                          <DropdownMenu.Item asChild>
                            <Link
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted"
                              to="/projetos"
                            >
                              <Rocket className="h-4 w-4 opacity-70" />
                              Ver projeto
                            </Link>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted"
                            onSelect={() => openEdit(row)}
                          >
                            <Pencil className="h-4 w-4 opacity-70" />
                            Editar
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted"
                            onSelect={() => duplicateFrom(row)}
                          >
                            <Copy className="h-4 w-4 opacity-70" />
                            Duplicar
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive outline-none hover:bg-muted"
                            onSelect={() => handleDelete(row)}
                          >
                            <Trash2 className="h-4 w-4 opacity-70" />
                            Remover
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={editing ? "Editar lançamento" : "Novo lançamento"} showClose>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={!!editing}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="launch-name">Nome da janela</Label>
              <Input
                id="launch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Abertura de carrinho"
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start">Início</Label>
                <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Fim</Label>
                <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button className="rounded-xl" onClick={() => void handleSave()} disabled={saving || !name.trim() || !projectId}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
