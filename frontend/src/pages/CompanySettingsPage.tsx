import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchOrganizationContext, patchOrganizationName } from "@/lib/organization-api";
import type { OrganizationContext } from "@/lib/organization-api";
export function CompanySettingsPage() {
  const [ctx, setCtx] = useState<OrganizationContext | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const c = await fetchOrganizationContext();
      setCtx(c);
      setName(c.name);
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
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary/80">Conta</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {ctx?.parentOrganization ? "Empresa" : "Empresa e revenda"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {ctx?.parentOrganization ? (
            <>
              Esta é a <strong className="font-medium text-foreground">empresa ativa</strong> da sua agência: integrações,
              metas e clientes vinculados a este contexto. Plano e cotas da rede são tratados pela matriz.
            </>
          ) : (
            <>
              A <strong className="font-medium text-foreground">empresa ativa</strong> é o ambiente isolado (integrações,
              marketing, menu Clientes, projetos). Agências podem criar{" "}
              <strong className="font-medium text-foreground">empresas filhas</strong> abaixo — cada filha é outro
              ambiente completo, diferente dos registros do menu{" "}
              <strong className="font-medium text-foreground">Clientes</strong>.{" "}
              <Link
                to="/configuracoes#como-funciona-conta"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Resumo do modelo
              </Link>
              .
            </>
          )}
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {msg && <p className="text-sm text-success">{msg}</p>}

      {ctx?.parentOrganization && (
        <Card className="rounded-2xl border-border/55 bg-muted/25 shadow-[var(--shadow-surface-sm)]">
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

      <Card className="rounded-2xl border-border/55 shadow-[var(--shadow-surface-sm)]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Nome da empresa ativa</CardTitle>
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

      {ctx && !ctx.parentOrganization ? (
        <Card className="rounded-2xl border-border/55 shadow-[var(--shadow-surface-sm)]">
          <CardHeader>
            <CardTitle className="text-base">Workspaces filhos (revenda)</CardTitle>
            <CardDescription>
              A operação completa — KPIs, alertas, tabela, criação e governança — está em{" "}
              <Link to="/revenda" className="font-semibold text-primary underline-offset-4 hover:underline">
                Gestão de workspaces
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
