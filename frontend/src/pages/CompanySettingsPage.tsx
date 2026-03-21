import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, Plus, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchOrganizationContext,
  patchOrganizationName,
  fetchManagedOrganizations,
  createManagedOrganization,
} from "@/lib/organization-api";
import type { OrganizationContext } from "@/lib/organization-api";
import type { OrganizationSummary } from "@/stores/auth-store";

export function CompanySettingsPage() {
  const [ctx, setCtx] = useState<OrganizationContext | null>(null);
  const [children, setChildren] = useState<OrganizationSummary[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [newClientName, setNewClientName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const c = await fetchOrganizationContext();
      setCtx(c);
      setName(c.name);
      try {
        const list = await fetchManagedOrganizations();
        setChildren(list);
      } catch {
        setChildren([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await patchOrganizationName(n);
      setMsg("Nome da empresa atualizado. Recarregue a página ou use o menu para ver o nome novo no topo.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateChild(e: React.FormEvent) {
    e.preventDefault();
    const n = newClientName.trim();
    if (n.length < 2) return;
    setCreating(true);
    setError(null);
    try {
      await createManagedOrganization(n);
      setNewClientName("");
      const list = await fetchManagedOrganizations();
      setChildren(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar empresa cliente");
    } finally {
      setCreating(false);
    }
  }

  if (loading && !ctx) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1 text-muted-foreground" asChild>
          <Link to="/configuracoes">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Empresa e revenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A <strong className="font-medium text-foreground">empresa ativa</strong> é o ambiente isolado (integrações,
          marketing, menu Clientes, projetos). Agências podem criar <strong className="font-medium text-foreground">empresas filhas</strong>{" "}
          abaixo — cada filha é outro ambiente completo, diferente dos registros do menu{" "}
          <strong className="font-medium text-foreground">Clientes</strong>.{" "}
          <Link
            to="/configuracoes#como-funciona-conta"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Resumo do modelo
          </Link>
          .
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {msg && <p className="text-sm text-success">{msg}</p>}

      {ctx?.parentOrganization && (
        <Card className="border-border/80 bg-muted/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Empresa vinculada</CardTitle>
            </div>
            <CardDescription>
              Esta organização está sob a agência{" "}
              <span className="font-medium text-foreground">{ctx.parentOrganization.name}</span>. Os dados aqui
              são isolados da agência e de outras empresas.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Nome da empresa ativa</CardTitle>
          </div>
          <CardDescription>Identificação exibida no painel e nas integrações deste contexto.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Nome</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg"
              />
              <p className="text-xs text-muted-foreground">Slug interno: {ctx?.slug}</p>
            </div>
            <Button type="submit" disabled={saving || name.trim().length < 2} className="rounded-lg">
              {saving ? "Salvando…" : "Salvar nome"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenda · nova organização por cliente final</CardTitle>
          <CardDescription>
            Cada item aqui vira uma <strong className="text-foreground">empresa separada no seletor do topo</strong>, com
            Google/Meta e dados próprios. Isso não substitui o menu <strong className="text-foreground">Clientes</strong>, que
            continua sendo cadastro comercial <em>dentro</em> de cada ambiente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateChild} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="child-name">Nova empresa cliente</Label>
              <Input
                id="child-name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Ex.: Cliente ABC Ltda"
                className="rounded-lg"
              />
            </div>
            <Button type="submit" disabled={creating || newClientName.trim().length < 2} className="rounded-lg">
              <Plus className="mr-2 h-4 w-4" />
              Criar
            </Button>
          </form>

          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma empresa cliente ainda. Somente usuários <strong>admin</strong> ou <strong>owner</strong> da
              empresa atual podem criar e listar filiais.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-lg border border-border/80">
              {children.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                  <span className="font-medium">{o.name}</span>
                  <span className="text-xs text-muted-foreground">{o.slug}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
