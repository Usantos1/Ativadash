import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { useAuthStore } from "@/stores/auth-store";
import {
  assignOrgPlan,
  createPlatformPlan,
  deletePlatformPlan,
  fetchPlatformOrganizations,
  fetchPlatformPlans,
  type PlanRow,
  type PlatformOrgRow,
} from "@/lib/platform-api";

export function PlatformPage() {
  const platformAdmin = useAuthStore((s) => s.user?.platformAdmin);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [orgs, setOrgs] = useState<PlatformOrgRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPlan, setNewPlan] = useState({
    name: "",
    slug: "",
    maxIntegrations: 5,
    maxDashboards: 10,
    maxUsers: "" as string | number,
    maxClientAccounts: "" as string | number,
    maxChildOrganizations: "" as string | number,
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, o] = await Promise.all([fetchPlatformPlans(), fetchPlatformOrganizations()]);
      setPlans(p.plans);
      setOrgs(o.organizations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar plataforma");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (platformAdmin) load();
    else setLoading(false);
  }, [platformAdmin, load]);

  function parseCap(v: string | number): number | null {
    if (v === "" || v === undefined) return null;
    const n = typeof v === "number" ? v : parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createPlatformPlan({
        name: newPlan.name.trim(),
        slug: newPlan.slug.trim().toLowerCase(),
        maxIntegrations: Number(newPlan.maxIntegrations),
        maxDashboards: Number(newPlan.maxDashboards),
        maxUsers: parseCap(newPlan.maxUsers),
        maxClientAccounts: parseCap(newPlan.maxClientAccounts),
        maxChildOrganizations: parseCap(newPlan.maxChildOrganizations),
      });
      setNewPlan({
        name: "",
        slug: "",
        maxIntegrations: 5,
        maxDashboards: 10,
        maxUsers: "",
        maxClientAccounts: "",
        maxChildOrganizations: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar plano");
    }
  }

  async function handleAssign(orgId: string, planId: string) {
    setError(null);
    try {
      await assignOrgPlan(orgId, planId === "__none__" ? null : planId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atribuir plano");
    }
  }

  async function handleDeletePlan(id: string) {
    if (!window.confirm("Excluir este plano?")) return;
    setError(null);
    try {
      await deletePlatformPlan(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir");
    }
  }

  if (!platformAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Plataforma</h1>
        <p className="text-sm text-muted-foreground">
          Área restrita. Defina <code className="rounded bg-muted px-1">PLATFORM_ADMIN_EMAILS</code> no servidor com o seu
          e-mail e faça login novamente.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plataforma</h1>
        <p className="text-sm text-muted-foreground">Planos globais e atribuição por empresa (tenant).</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo plano</CardTitle>
          <CardDescription>Campos vazios de limite = ilimitado (null).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreatePlan} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={newPlan.name}
                onChange={(e) => setNewPlan((s) => ({ ...s, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input
                value={newPlan.slug}
                onChange={(e) => setNewPlan((s) => ({ ...s, slug: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Máx. integrações</Label>
              <Input
                type="number"
                min={0}
                value={newPlan.maxIntegrations}
                onChange={(e) => setNewPlan((s) => ({ ...s, maxIntegrations: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Máx. dashboards</Label>
              <Input
                type="number"
                min={0}
                value={newPlan.maxDashboards}
                onChange={(e) => setNewPlan((s) => ({ ...s, maxDashboards: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Máx. usuários (vazio = ∞)</Label>
              <Input
                type="number"
                min={0}
                value={newPlan.maxUsers}
                onChange={(e) => setNewPlan((s) => ({ ...s, maxUsers: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Máx. clientes comerciais</Label>
              <Input
                type="number"
                min={0}
                value={newPlan.maxClientAccounts}
                onChange={(e) => setNewPlan((s) => ({ ...s, maxClientAccounts: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Máx. empresas filhas</Label>
              <Input
                type="number"
                min={0}
                value={newPlan.maxChildOrganizations}
                onChange={(e) => setNewPlan((s) => ({ ...s, maxChildOrganizations: e.target.value }))}
              />
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <Button type="submit">Criar plano</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Planos cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollRegion className="scrollbar-thin">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Nome</th>
                  <th className="px-4 py-2 font-medium">Slug</th>
                  <th className="px-4 py-2 font-medium">Limites</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="px-4 py-2 font-medium">{p.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.slug}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      int {p.maxIntegrations} · dash {p.maxDashboards} · users {p.maxUsers ?? "∞"} · clients{" "}
                      {p.maxClientAccounts ?? "∞"} · filhas {p.maxChildOrganizations ?? "∞"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleDeletePlan(p.id)}>
                        Excluir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Empresas e plano</CardTitle>
          <CardDescription>Atribua <code className="text-xs">planId</code> por organização.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollRegion className="scrollbar-thin">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Empresa</th>
                  <th className="px-4 py-2 font-medium">Plano atual</th>
                  <th className="px-4 py-2 font-medium">Alterar</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} className="border-b border-border/60">
                    <td className="px-4 py-2">
                      <span className="font-medium">{o.name}</span>
                      <div className="text-xs text-muted-foreground">{o.slug}</div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{o.plan?.name ?? "—"}</td>
                    <td className="px-4 py-2">
                      <select
                        className="h-9 w-full max-w-[220px] rounded-md border border-input bg-background px-2 text-sm"
                        value={o.planId ?? "__none__"}
                        onChange={(e) => handleAssign(o.id, e.target.value)}
                      >
                        <option value="__none__">Sem plano</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        </CardContent>
      </Card>
    </div>
  );
}
