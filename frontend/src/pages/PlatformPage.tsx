import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth-store";
import {
  assignOrgPlan,
  createPlatformPlan,
  deletePlatformPlan,
  fetchPlatformOrganizations,
  fetchPlatformPlans,
  fetchPlatformSubscriptions,
  fetchOrgLimitsOverride,
  patchOrgSubscription,
  putOrgLimitsOverride,
  syncPlatformSubscriptions,
  type PlanRow,
  type PlatformOrgRow,
  type PlatformSubscriptionRow,
} from "@/lib/platform-api";

const DEFAULT_FEATURES = {
  marketingDashboard: true,
  performanceAlerts: true,
  multiUser: true,
  multiOrganization: true,
  integrations: true,
  webhooks: false,
};

export function PlatformPage() {
  const platformAdmin = useAuthStore((s) => s.user?.platformAdmin);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [orgs, setOrgs] = useState<PlatformOrgRow[]>([]);
  const [subs, setSubs] = useState<PlatformSubscriptionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [manageOrg, setManageOrg] = useState<PlatformOrgRow | null>(null);
  const [subForm, setSubForm] = useState({
    billingMode: "custom" as "monthly" | "quarterly" | "annual" | "trial" | "custom",
    status: "active" as "active" | "trialing" | "past_due" | "canceled",
    renewsAt: "",
    notes: "",
  });
  const [ovForm, setOvForm] = useState({
    maxUsers: "" as string,
    maxClientAccounts: "" as string,
    maxIntegrations: "" as string,
    maxDashboards: "" as string,
    maxChildOrganizations: "" as string,
    notes: "" as string,
  });

  const [newPlan, setNewPlan] = useState({
    name: "",
    slug: "",
    maxIntegrations: 5,
    maxDashboards: 10,
    maxUsers: "" as string | number,
    maxClientAccounts: "" as string | number,
    maxChildOrganizations: "" as string | number,
    descriptionInternal: "",
    planType: "standard",
    active: true,
    features: { ...DEFAULT_FEATURES },
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, o, s] = await Promise.all([
        fetchPlatformPlans(),
        fetchPlatformOrganizations(),
        fetchPlatformSubscriptions(),
      ]);
      setPlans(p.plans);
      setOrgs(o.organizations);
      setSubs(s.subscriptions);
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

  useEffect(() => {
    if (!manageOrg) return;
    (async () => {
      try {
        const r = await fetchOrgLimitsOverride(manageOrg.id);
        const o = r.override;
        setSubForm({
          billingMode: (manageOrg.subscription?.billingMode as typeof subForm.billingMode) ?? "custom",
          status: (manageOrg.subscription?.status as typeof subForm.status) ?? "active",
          renewsAt: manageOrg.subscription?.renewsAt
            ? manageOrg.subscription.renewsAt.slice(0, 16)
            : "",
          notes: "",
        });
        setOvForm({
          maxUsers: o?.maxUsers != null ? String(o.maxUsers) : "",
          maxClientAccounts: o?.maxClientAccounts != null ? String(o.maxClientAccounts) : "",
          maxIntegrations: o?.maxIntegrations != null ? String(o.maxIntegrations) : "",
          maxDashboards: o?.maxDashboards != null ? String(o.maxDashboards) : "",
          maxChildOrganizations: o?.maxChildOrganizations != null ? String(o.maxChildOrganizations) : "",
          notes: o?.notes ?? "",
        });
      } catch {
        setError("Erro ao carregar override");
      }
    })();
  }, [manageOrg]);

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
        descriptionInternal: newPlan.descriptionInternal.trim() || null,
        active: newPlan.active,
        planType: newPlan.planType,
        features: newPlan.features,
      });
      setNewPlan({
        name: "",
        slug: "",
        maxIntegrations: 5,
        maxDashboards: 10,
        maxUsers: "",
        maxClientAccounts: "",
        maxChildOrganizations: "",
        descriptionInternal: "",
        planType: "standard",
        active: true,
        features: { ...DEFAULT_FEATURES },
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

  async function handleSyncSubs() {
    setError(null);
    try {
      const r = await syncPlatformSubscriptions();
      await load();
      alert(`Sincronizado: ${r.synced} empresas.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sincronizar");
    }
  }

  async function saveManageDialog() {
    if (!manageOrg) return;
    setError(null);
    try {
      await patchOrgSubscription(manageOrg.id, {
        billingMode: subForm.billingMode,
        status: subForm.status,
        renewsAt: subForm.renewsAt ? new Date(subForm.renewsAt).toISOString() : null,
        notes: subForm.notes || null,
      });
      await putOrgLimitsOverride(manageOrg.id, {
        maxUsers: ovForm.maxUsers === "" ? null : parseInt(ovForm.maxUsers, 10),
        maxClientAccounts: ovForm.maxClientAccounts === "" ? null : parseInt(ovForm.maxClientAccounts, 10),
        maxIntegrations: ovForm.maxIntegrations === "" ? null : parseInt(ovForm.maxIntegrations, 10),
        maxDashboards: ovForm.maxDashboards === "" ? null : parseInt(ovForm.maxDashboards, 10),
        maxChildOrganizations:
          ovForm.maxChildOrganizations === "" ? null : parseInt(ovForm.maxChildOrganizations, 10),
        notes: ovForm.notes || null,
      });
      setManageOrg(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plataforma</h1>
          <p className="text-sm text-muted-foreground">
            Planos, assinaturas, limites customizados e vínculo com cada tenant.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleSyncSubs}>
          Sincronizar assinaturas (org → subscription)
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      <Dialog open={!!manageOrg} onOpenChange={(o) => !o && setManageOrg(null)}>
        <DialogContent title={`Assinatura · ${manageOrg?.name ?? ""}`} className="max-h-[90dvh] w-[min(100vw-1rem,28rem)] max-w-none sm:max-w-lg">
          {manageOrg && (
            <div className="space-y-4 text-sm">
              <div className="space-y-2">
                <Label>Modalidade</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2"
                  value={subForm.billingMode}
                  onChange={(e) =>
                    setSubForm((s) => ({ ...s, billingMode: e.target.value as typeof s.billingMode }))
                  }
                >
                  <option value="monthly">Mensal</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="annual">Anual</option>
                  <option value="trial">Trial</option>
                  <option value="custom">Personalizada</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2"
                  value={subForm.status}
                  onChange={(e) => setSubForm((s) => ({ ...s, status: e.target.value as typeof s.status }))}
                >
                  <option value="active">Ativa</option>
                  <option value="trialing">Trial</option>
                  <option value="past_due">Inadimplente</option>
                  <option value="canceled">Cancelada</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Renovação (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={subForm.renewsAt}
                  onChange={(e) => setSubForm((s) => ({ ...s, renewsAt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Notas assinatura</Label>
                <Input value={subForm.notes} onChange={(e) => setSubForm((s) => ({ ...s, notes: e.target.value }))} />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Override de limites (vazio = usa plano)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["maxUsers", "Máx. usuários"],
                    ["maxClientAccounts", "Máx. clientes"],
                    ["maxIntegrations", "Máx. integrações"],
                    ["maxDashboards", "Máx. dashboards"],
                    ["maxChildOrganizations", "Máx. empresas filhas"],
                  ] as const
                ).map(([k, lab]) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs">{lab}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={ovForm[k]}
                      onChange={(e) => setOvForm((o) => ({ ...o, [k]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Notas override</Label>
                <Input value={ovForm.notes} onChange={(e) => setOvForm((o) => ({ ...o, notes: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setManageOrg(null)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={saveManageDialog}>
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo plano</CardTitle>
          <CardDescription>Limites vazios = ilimitado (null). Recursos em JSON no backend.</CardDescription>
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
              <Label>Tipo do plano</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={newPlan.planType}
                onChange={(e) => setNewPlan((s) => ({ ...s, planType: e.target.value }))}
              >
                <option value="standard">standard</option>
                <option value="enterprise">enterprise</option>
                <option value="trial">trial</option>
                <option value="internal">internal</option>
                <option value="custom">custom</option>
              </select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="np-active"
                type="checkbox"
                checked={newPlan.active}
                onChange={(e) => setNewPlan((s) => ({ ...s, active: e.target.checked }))}
              />
              <Label htmlFor="np-active" className="font-normal">
                Plano ativo no catálogo
              </Label>
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label>Descrição interna</Label>
              <Input
                value={newPlan.descriptionInternal}
                onChange={(e) => setNewPlan((s) => ({ ...s, descriptionInternal: e.target.value }))}
                placeholder="Nota só para admin"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label className="text-xs text-muted-foreground">Recursos</Label>
              <div className="flex flex-wrap gap-3 text-xs">
                {(
                  [
                    ["marketingDashboard", "Marketing"],
                    ["performanceAlerts", "Alertas"],
                    ["multiUser", "Multiusuário"],
                    ["multiOrganization", "Multiempresa"],
                    ["integrations", "Integrações"],
                    ["webhooks", "Webhooks"],
                  ] as const
                ).map(([k, lab]) => (
                  <label key={k} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={newPlan.features[k]}
                      onChange={(e) =>
                        setNewPlan((s) => ({
                          ...s,
                          features: { ...s.features, [k]: e.target.checked },
                        }))
                      }
                    />
                    {lab}
                  </label>
                ))}
              </div>
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
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Nome</th>
                  <th className="px-4 py-2 font-medium">Slug</th>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium">Ativo</th>
                  <th className="px-4 py-2 font-medium">Limites</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="px-4 py-2 font-medium">{p.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.slug}</td>
                    <td className="px-4 py-2 text-xs">{p.planType}</td>
                    <td className="px-4 py-2">{p.active ? "sim" : "não"}</td>
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
          <CardTitle className="text-base">Assinaturas</CardTitle>
          <CardDescription>Uma linha por empresa com registro de assinatura.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollRegion className="scrollbar-thin">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Empresa</th>
                  <th className="px-4 py-2 font-medium">Plano</th>
                  <th className="px-4 py-2 font-medium">Modalidade</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Início</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-border/60">
                    <td className="px-4 py-2 font-medium">{s.organization.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.plan.name}</td>
                    <td className="px-4 py-2 text-xs">{s.billingMode}</td>
                    <td className="px-4 py-2 text-xs">{s.status}</td>
                    <td className="px-4 py-2 text-xs">{new Date(s.startedAt).toLocaleDateString("pt-BR")}</td>
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
          <CardDescription>Atribuição rápida; use &quot;Gerenciar&quot; para modalidade, status e overrides.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollRegion className="scrollbar-thin">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Empresa</th>
                  <th className="px-4 py-2 font-medium">Plano</th>
                  <th className="px-4 py-2 font-medium">Assinatura</th>
                  <th className="px-4 py-2 font-medium">Alterar plano</th>
                  <th className="px-4 py-2 font-medium" />
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
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {o.subscription ? `${o.subscription.billingMode} · ${o.subscription.status}` : "—"}
                      {o.limitsOverride &&
                      Object.values(o.limitsOverride).some((v) => v != null) ? (
                        <span className="ml-1 text-primary">· override</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="h-9 w-full max-w-[200px] rounded-md border border-input bg-background px-2 text-sm"
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
                    <td className="px-4 py-2 text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => setManageOrg(o)}>
                        Gerenciar
                      </Button>
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
