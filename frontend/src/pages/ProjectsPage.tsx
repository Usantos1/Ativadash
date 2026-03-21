import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderKanban, Plus, Pencil, Search, Trash2 } from "lucide-react";
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
  fetchClients,
  fetchProjects,
  fetchLaunches,
  createProject,
  updateProject,
  deleteProject,
  type ClientAccount,
  type ProjectRow,
} from "@/lib/workspace-api";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsPageHeader } from "@/components/analytics/AnalyticsPageHeader";
import { AnalyticsSection } from "@/components/analytics/AnalyticsSection";
import { KpiPremium } from "@/components/analytics/KpiPremium";

export function ProjectsPage() {
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [launchCountByProject, setLaunchCountByProject] = useState<Record<string, number>>({});
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
      const [c, p, launches] = await Promise.all([fetchClients(), fetchProjects(), fetchLaunches()]);
      setClients(c);
      setRows(p);
      const map: Record<string, number> = {};
      for (const l of launches) {
        map[l.projectId] = (map[l.projectId] ?? 0) + 1;
      }
      setLaunchCountByProject(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    <div className="w-full space-y-6">
      <AnalyticsPageHeader
        title="Projetos"
        subtitle="Estrutura operacional: cada projeto concentra lançamentos e pode estar vinculado a um cliente comercial."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar projeto ou cliente…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-full pl-9"
              />
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Novo projeto
            </Button>
          </div>
        }
      />

      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiPremium label="Total de projetos" value={String(rows.length)} icon={FolderKanban} />
          <KpiPremium label="Com cliente vinculado" value={String(withClient)} icon={FolderKanban} />
          <KpiPremium
            label="Lançamentos mapeados"
            value={String(Object.values(launchCountByProject).reduce((a, n) => a + n, 0))}
            hint="Contagem na organização."
            icon={FolderKanban}
          />
          <KpiPremium label="Busca" value={String(filteredRows.length)} icon={Search} />
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <AnalyticsSection
        title="Operação"
        description={loading ? "Carregando…" : `${rows.length} projeto(s) na organização.`}
        dense
      >
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum projeto. Crie um para associar lançamentos.</p>
        ) : (
          <ScrollRegion className="scrollbar-thin">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Projeto</th>
                  <th className="pb-2 pr-4 font-medium">Cliente</th>
                  <th className="pb-2 pr-4 font-medium text-right">Lançamentos</th>
                  <th className="pb-2 pr-4 font-medium">Última atualização</th>
                  <th className="pb-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 transition-colors hover:bg-muted/30">
                    <td className="py-3 pr-4 font-medium">{row.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{row.clientAccount?.name ?? "—"}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                      {launchCountByProject[row.id] ?? 0}
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {new Date(row.updatedAt).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
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
        <DialogContent title={editing ? "Editar projeto" : "Novo projeto"}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="proj-name">Nome</Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Lançamento curso 2025"
              />
            </div>
            <div className="space-y-2">
              <Label>Cliente (opcional)</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="min-w-0 w-full">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
