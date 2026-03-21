import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsPageHeader } from "@/components/analytics/AnalyticsPageHeader";
import { AnalyticsSection } from "@/components/analytics/AnalyticsSection";
import { KpiCardPremium } from "@/components/premium";
import {
  fetchClients,
  fetchProjects,
  createClient,
  updateClient,
  deleteClient,
  type ClientAccount,
} from "@/lib/workspace-api";
import {
  fetchOrganizationContext,
  formatPlanCap,
  type OrganizationContext,
} from "@/lib/organization-api";

export function ClientsPage() {
  const [rows, setRows] = useState<ClientAccount[]>([]);
  const [projectCountByClient, setProjectCountByClient] = useState<Record<string, number>>({});
  const [orgCtx, setOrgCtx] = useState<OrganizationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClientAccount | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, ctx, projects] = await Promise.all([
        fetchClients(),
        fetchOrganizationContext(),
        fetchProjects(),
      ]);
      setRows(list);
      setOrgCtx(ctx);
      const map: Record<string, number> = {};
      for (const p of projects) {
        if (p.clientAccountId) {
          map[p.clientAccountId] = (map[p.clientAccountId] ?? 0) + 1;
        }
      }
      setProjectCountByClient(map);
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
    setOpen(true);
  }

  function openEdit(row: ClientAccount) {
    setEditing(row);
    setName(row.name);
    setOpen(true);
  }

  async function handleSave() {
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    try {
      if (editing) {
        await updateClient(editing.id, n);
      } else {
        await createClient(n);
      }
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const maxClients = orgCtx?.limits.maxClientAccounts;
  const atClientLimit =
    maxClients != null && rows.length >= maxClients;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  const totalProjectsOnClients = useMemo(
    () => Object.values(projectCountByClient).reduce((a, n) => a + n, 0),
    [projectCountByClient]
  );

  async function handleDelete(row: ClientAccount) {
    if (!confirm(`Remover o cliente "${row.name}"? Projetos vinculados ficam sem cliente.`)) return;
    try {
      await deleteClient(row.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover");
    }
  }

  return (
    <div className="w-full space-y-6">
      <AnalyticsPageHeader
        eyebrow="Carteira"
        title="Clientes comerciais"
        subtitle="Contas ou marcas que você atende nesta organização. Agrupam projetos, lançamentos e vínculos de mídia. Não confundir com usuários da equipe."
        meta={
          <Link
            to="/configuracoes#como-funciona-conta"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Modelo de conta em Configurações
          </Link>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-full pl-9"
              />
            </div>
            <Button onClick={openCreate} disabled={atClientLimit} title={atClientLimit ? "Limite do plano atingido" : undefined}>
              <Plus className="mr-2 h-4 w-4" />
              Novo cliente
            </Button>
          </div>
        }
      />

      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCardPremium variant="primary" label="Clientes cadastrados" value={String(rows.length)} icon={Building2} />
          <KpiCardPremium
            variant="primary"
            label="Uso do plano"
            value={orgCtx ? `${rows.length} / ${formatPlanCap(orgCtx.limits.maxClientAccounts)}` : "—"}
            hint={orgCtx ? `Plano ${orgCtx.plan?.name ?? "—"}` : undefined}
            icon={Building2}
          />
          <KpiCardPremium
            variant="compact"
            label="Projetos com cliente"
            value={String(totalProjectsOnClients)}
            hint="Projetos vinculados a algum cliente."
            icon={Building2}
          />
          <KpiCardPremium
            variant="compact"
            label="Resultado da busca"
            value={String(filteredRows.length)}
            hint={search.trim() ? `Filtro: “${search.trim()}”` : "Sem filtro de texto."}
            icon={Search}
          />
        </div>
      )}

      {atClientLimit && (
        <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
          Limite de clientes comerciais do plano atingido. Remova um cliente ou fale com vendas para ampliar.
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <AnalyticsSection
        title="Carteira"
        description={
          loading
            ? "Carregando…"
            : orgCtx
              ? `${rows.length} / ${formatPlanCap(orgCtx.limits.maxClientAccounts)} no plano · ${orgCtx.plan?.name ?? "—"}`
              : `${rows.length} cliente(s)`
        }
        dense
      >
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum cliente ainda. Crie o primeiro para associar projetos.
          </p>
        ) : (
          <ScrollRegion className="scrollbar-thin">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Cliente</th>
                  <th className="pb-2 pr-4 font-medium text-right">Projetos</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 transition-colors hover:bg-muted/30">
                    <td className="py-3 pr-4 font-medium">{row.name}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                      {projectCountByClient[row.id] ?? 0}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                        Ativo
                      </span>
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
        <DialogContent title={editing ? "Editar cliente" : "Novo cliente"}>
          <div className="space-y-2 py-2">
            <Label htmlFor="client-name">Nome</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Agência XYZ"
            />
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
