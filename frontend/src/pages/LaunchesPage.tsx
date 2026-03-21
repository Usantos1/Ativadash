import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">
            Campanhas ou períodos dentro de um projeto (útil para filtros no Marketing).
          </p>
        </div>
        <Button onClick={openCreate} disabled={projects.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Novo lançamento
        </Button>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtrar por projeto:</span>
        <Select value={filterProjectId} onValueChange={setFilterProjectId}>
          <SelectTrigger className="min-w-0 w-full max-w-[280px] sm:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
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

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>
            {loading ? "Carregando…" : `${rows.length} lançamento(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Crie um projeto antes de adicionar lançamentos.</p>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento neste filtro.</p>
          ) : (
            <ScrollRegion className="scrollbar-thin">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Nome</th>
                    <th className="pb-2 pr-4 font-medium">Projeto</th>
                    <th className="pb-2 pr-4 font-medium">Início</th>
                    <th className="pb-2 pr-4 font-medium">Fim</th>
                    <th className="pb-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="py-3 pr-4 font-medium">{row.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{row.project.name}</td>
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
        </CardContent>
      </Card>

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
