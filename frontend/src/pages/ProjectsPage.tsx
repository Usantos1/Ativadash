import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FolderKanban,
  Link2,
  MoreHorizontal,
  Plus,
  Rocket,
  Search,
  Trash2,
  ExternalLink,
  Pencil,
  ChevronDown,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
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
  fetchClients,
  fetchProjects,
  fetchLaunches,
  createProject,
  updateProject,
  deleteProject,
  type ClientAccount,
  type ProjectRow,
  type LaunchRow,
} from "@/lib/workspace-api";
import { OperationsModuleNav } from "@/components/operations/operations-module-nav";
import { projectLaunchPulse, projectLaunchPulseLabel } from "@/lib/launch-operational";
import { formatPageTitle, usePageTitle } from "@/hooks/usePageTitle";

export function ProjectsPage() {
  usePageTitle(formatPageTitle(["Projetos"]));
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [launches, setLaunches] = useState<LaunchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<string>("__none__");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [c, p, l] = await Promise.all([fetchClients(), fetchProjects(), fetchLaunches()]);
      setClients(c);
      setRows(p);
      setLaunches(l);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const launchCountByProject = useMemo(() => {
    const map: Record<string, number> = {};
    for (const x of launches) {
      map[x.projectId] = (map[x.projectId] ?? 0) + 1;
    }
    return map;
  }, [launches]);

  const launchesByProject = useMemo(() => {
    const m = new Map<string, LaunchRow[]>();
    for (const l of launches) {
      const arr = m.get(l.projectId) ?? [];
      arr.push(l);
      m.set(l.projectId, arr);
    }
    return m;
  }, [launches]);

  function openCreate() {
    setEditing(null);
    setName("");
    setClientId("__none__");
    setOpen(true);
  }

  function openEdit(row: ProjectRow) {
    setEditing(row);
    setName(row.name);
    setClientId(row.clientAccountId ?? "__none__");
    setOpen(true);
  }

  function openEditLinkClient(row: ProjectRow) {
    setEditing(row);
    setName(row.name);
    setClientId(row.clientAccountId ?? "__none__");
    setOpen(true);
  }

  async function handleSave() {
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    try {
      const cid = clientId === "__none__" ? null : clientId;
      if (editing) {
        await updateProject(editing.id, { name: n, clientAccountId: cid });
      } else {
        await createProject(n, cid ?? undefined);
      }
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.clientAccount?.name ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const withClient = useMemo(() => rows.filter((r) => r.clientAccountId).length, [rows]);

  const withActiveLaunch = useMemo(() => {
    return rows.filter((r) => {
      const ls = launchesByProject.get(r.id) ?? [];
      const pulse = projectLaunchPulse(ls);
      return pulse === "ativo";
    }).length;
  }, [rows, launchesByProject]);

  async function handleDelete(row: ProjectRow) {
    if (!confirm(`Remover o projeto "${row.name}"? Lançamentos vinculados também serão ocultados do fluxo ativo.`))
      return;
    try {
      await deleteProject(row.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover");
    }
  }

  return (
    <div className="w-full space-y-6 pb-12">
      <PageHeaderPremium
        eyebrow="Operação"
        title="Projetos"
        subtitle="Organize frentes operacionais por cliente e concentre lançamentos no mesmo contexto."
        meta={<OperationsModuleNav />}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <div className="relative min-w-0 sm:w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar projeto ou cliente"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-lg border-border/60 pl-9"
              />
            </div>
            <Button className="h-9 rounded-lg" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Novo projeto
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-destructive/35 bg-destructive/[0.08] px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCardPremium variant="primary" label="Total de projetos" value={String(rows.length)} icon={FolderKanban} hideSource />
          <KpiCardPremium
            variant="secondary"
            label="Com cliente vinculado"
            value={String(withClient)}
            hideSource
            hint={`${rows.length - withClient} sem vínculo comercial.`}
            icon={Link2}
          />
          <KpiCardPremium
            variant="secondary"
            label="Com lançamento ativo"
            value={String(withActiveLaunch)}
            hideSource
            icon={Rocket}
          />
          <KpiCardPremium
            variant="secondary"
            label="Lançamentos mapeados"
            value={String(launches.length)}
            hideSource
            icon={FolderKanban}
          />
        </div>
      )}

      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">Nenhum projeto ainda. Crie a primeira frente operacional.</p>
          <Button className="mt-4 rounded-xl" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Criar projeto
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4">
          {filteredRows.map((row) => {
            const nLaunch = launchCountByProject[row.id] ?? 0;
            const ls = launchesByProject.get(row.id) ?? [];
            const pulse = projectLaunchPulse(ls);
            const pulseLabel = projectLaunchPulseLabel(pulse);
            const tone =
              pulse === "ativo" ? ("healthy" as const) : pulse === "sem_lancamentos" ? ("alert" as const) : ("healthy" as const);
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
                        {pulseLabel}
                      </StatusBadge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Cliente</p>
                        <p className="mt-0.5 text-sm font-semibold text-foreground">
                          {row.clientAccount?.name ?? (
                            <span className="text-amber-700 dark:text-amber-300">Sem vínculo</span>
                          )}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Lançamentos</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">{nLaunch}</p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Última atualização</p>
                        <p className="mt-0.5 text-xs font-semibold">
                          {new Date(row.updatedAt).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Contexto ADS</p>
                        <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                          Filtre por lançamento no Painel ADS usando o nome cadastrado.
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <Link to="/clientes" className="font-medium text-primary underline-offset-2 hover:underline">
                        Contas
                      </Link>{" "}
                      → projeto →{" "}
                      <Link to="/lancamentos" className="font-medium text-primary underline-offset-2 hover:underline">
                        Lançamentos
                      </Link>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                    <Button className="h-10 rounded-xl" variant="default" asChild>
                      <Link to="/marketing">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir projeto
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
                          sideOffset={6}
                          align="end"
                        >
                          <DropdownMenu.Item asChild>
                            <Link
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted"
                              to={`/lancamentos?project=${encodeURIComponent(row.id)}`}
                            >
                              <Rocket className="h-4 w-4 opacity-70" />
                              Ver lançamentos
                            </Link>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted"
                            onSelect={() => openEditLinkClient(row)}
                          >
                            <Link2 className="h-4 w-4 opacity-70" />
                            Vincular cliente
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-muted"
                            onSelect={() => openEdit(row)}
                          >
                            <Pencil className="h-4 w-4 opacity-70" />
                            Editar
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
        <DialogContent title={editing ? "Editar projeto" : "Novo projeto"} showClose>
          <div className="space-y-4 py-2">
            {!editing && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                Associe um <strong>cliente comercial</strong> para alinhar esta frente à conta certa na operação.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="proj-name">Nome da frente</Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Captação Q2"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Cliente comercial</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="min-w-0 w-full rounded-xl">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem vínculo (não recomendado)</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button className="rounded-xl" onClick={() => void handleSave()} disabled={saving || !name.trim()}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
