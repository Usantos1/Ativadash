import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ScrollRegion } from "@/components/ui/scroll-region";
import {
  fetchClients,
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
  const [orgCtx, setOrgCtx] = useState<OrganizationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClientAccount | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, ctx] = await Promise.all([fetchClients(), fetchOrganizationContext()]);
      setRows(list);
      setOrgCtx(ctx);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes comerciais</h1>
          <p className="text-sm text-muted-foreground">
            Lista de <strong className="font-medium text-foreground">contas ou marcas</strong> que você atende{" "}
            <em>dentro da empresa ativa</em> (troca no topo). Serve para agrupar projetos e lançamentos.{" "}
            <strong className="text-foreground">Não</strong> é número de usuários nem empresa de revenda —{" "}
            <Link
              to="/configuracoes#como-funciona-conta"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              ver resumo em Configurações
            </Link>
            .
          </p>
        </div>
        <Button onClick={openCreate} disabled={atClientLimit} title={atClientLimit ? "Limite do plano atingido" : undefined}>
          <Plus className="mr-2 h-4 w-4" />
          Novo cliente
        </Button>
      </div>

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

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>
            {loading
              ? "Carregando…"
              : orgCtx
                ? `${rows.length} / ${formatPlanCap(orgCtx.limits.maxClientAccounts)} cliente(s) · Plano ${orgCtx.plan?.name ?? "—"}`
                : `${rows.length} cliente(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum cliente ainda. Crie o primeiro para associar projetos.
            </p>
          ) : (
            <ScrollRegion className="scrollbar-thin">
              <table className="w-full min-w-[320px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Nome</th>
                    <th className="pb-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="py-3 pr-4 font-medium">{row.name}</td>
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
