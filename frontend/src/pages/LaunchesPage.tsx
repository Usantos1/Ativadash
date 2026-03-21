import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, Pencil, Rocket, Search, Trash2 } from "lucide-react";
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
import { ScrollRegion } from "@/components/ui/scroll-region";
import {
  fetchProjects,
  fetchLaunches,
  createLaunch,
  updateLaunch,
  deleteLaunch,
  type ProjectRow,
  type LaunchRow,
} from "@/lib/workspace-api";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsPageHeader } from "@/components/analytics/AnalyticsPageHeader";
import { AnalyticsSection } from "@/components/analytics/AnalyticsSection";
import { KpiPremium } from "@/components/analytics/KpiPremium";

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

export function LaunchesPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [rows, setRows] = useState<LaunchRow[]>([]);
  const [filterProjectId, setFilterProjectId] = useState<string>("__all__");
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await fetchProjects();
        if (cancelled) return;
        setProjects(p);
        const list = await fetchLaunches(filterProjectId === "__all__" ? undefined : filterProjectId);
        if (cancelled) return;
        setRows(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filterProjectId]);

  function openCreate() {
    setEditing(null);
    setName("");
    setProjectId(projects[0]?.id ?? "");
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
      const list = await fetchLaunches(filterProjectId === "__all__" ? undefined : filterProjectId);
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const projectById = useMemo(() => {
    const m = new Map<string, ProjectRow>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.project.name.toLowerCase().includes(q) ||
        (projectById.get(r.projectId)?.clientAccount?.name ?? "").toLowerCase().includes(q)
    );
  }, [rows, search, projectById]);

  const withPeriod = useMemo(() => rows.filter((r) => r.startDate || r.endDate).length, [rows]);

  async function handleDelete(row: LaunchRow) {
    if (!confirm(`Remover o lançamento "${row.name}"?`)) return;
    try {
      await deleteLaunch(row.id);
      const list = await fetchLaunches(filterProjectId === "__all__" ? undefined : filterProjectId);
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover");
    }
  }

  return (
    <div className="w-full space-y-6">
      <AnalyticsPageHeader
        eyebrow="Operação"
        title="Lançamentos"
        subtitle="Janelas nomeadas dentro de um projeto — alimentam filtros inteligentes no Marketing quando o título coincide com campanhas."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar lançamento, projeto ou cliente…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-full pl-9"
              />
            </div>
            <Button onClick={openCreate} disabled={projects.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Novo lançamento
            </Button>
          </div>
        }
      />

      {!loading && projects.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiPremium label="Lançamentos (filtro)" value={String(rows.length)} icon={Rocket} />
          <KpiPremium label="Com período definido" value={String(withPeriod)} icon={CalendarDays} />
          <KpiPremium label="Projetos ativos" value={String(projects.length)} icon={Rocket} />
          <KpiPremium label="Resultado busca" value={String(filteredRows.length)} icon={Search} />
        </div>
      )}

      <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-card/60 px-3 py-2">
        <span className="text-sm font-medium text-muted-foreground">Projeto:</span>
        <Select value={filterProjectId} onValueChange={setFilterProjectId}>
          <SelectTrigger className="min-w-0 w-full max-w-[min(100%,320px)] sm:w-[240px]">
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

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <AnalyticsSection
        title="Carteira de lançamentos"
        description={
          projects.length === 0
            ? "Crie um projeto para habilitar lançamentos."
            : loading
              ? "Carregando…"
              : `${rows.length} lançamento(s) neste filtro de projeto.`
        }
        dense
      >
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Crie um projeto antes de adicionar lançamentos.</p>
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lançamento neste filtro.</p>
        ) : (
          <ScrollRegion className="scrollbar-thin">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Lançamento</th>
                  <th className="pb-2 pr-4 font-medium">Projeto</th>
                  <th className="pb-2 pr-4 font-medium">Cliente</th>
                  <th className="pb-2 pr-4 font-medium">Início</th>
                  <th className="pb-2 pr-4 font-medium">Fim</th>
                  <th className="pb-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 transition-colors hover:bg-muted/30">
                    <td className="py-3 pr-4 font-medium">{row.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{row.project.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {projectById.get(row.projectId)?.clientAccount?.name ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {row.startDate ? new Date(row.startDate).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {row.endDate ? new Date(row.endDate).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          aria-label="Remover"
                          onClick={() => handleDelete(row)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        )}
      </AnalyticsSection>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={editing ? "Editar lançamento" : "Novo lançamento"}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={!!editing}>
                <SelectTrigger className="min-w-0 w-full">
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
              <Label htmlFor="launch-name">Nome</Label>
              <Input
                id="launch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Abertura de carrinho"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start">Início</Label>
                <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Fim</Label>
                <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim() || !projectId}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
