import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Ban, FileText, Pencil, PlayCircle, Search, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth-store";
import {
  assignOrgPlan,
  createPlatformOrganization,
  createPlatformPlan,
  deletePlatformPlan,
  deletePlatformOrganization,
  fetchPlatformOrganizations,
  fetchPlatformPlans,
  fetchPlatformSubscriptions,
  fetchPlatformAuditLogs,
  fetchOrgLimitsOverride,
  patchOrgSubscription,
  patchPlatformOrganization,
  putOrgLimitsOverride,
  syncPlatformSubscriptions,
  updatePlatformPlan,
  type PlanRow,
  type PlatformOrgRow,
  type PlatformSubscriptionRow,
  type PlatformAuditLogItem,
  type WorkspaceStatusDto,
} from "@/lib/platform-api";

const DEFAULT_FEATURES = {
  marketingDashboard: true,
  performanceAlerts: true,
  multiUser: true,
  multiOrganization: true,
  integrations: true,
  webhooks: false,
  campaignWrite: true,
};

const ORG_STATUS_PT: Record<WorkspaceStatusDto, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
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

  const [orgRowBusy, setOrgRowBusy] = useState<string | null>(null);
  const [subRowBusy, setSubRowBusy] = useState<string | null>(null);
  const [planRowBusy, setPlanRowBusy] = useState<string | null>(null);
  const [orgEditor, setOrgEditor] = useState<PlatformOrgRow | null>(null);
  const [orgEditName, setOrgEditName] = useState("");
  const [orgEditSlug, setOrgEditSlug] = useState("");
  const [orgEditStatus, setOrgEditStatus] = useState<WorkspaceStatusDto>("ACTIVE");
  const [orgEditResellerPartner, setOrgEditResellerPartner] = useState(false);
  const [orgEditSaving, setOrgEditSaving] = useState(false);

  const [planEditor, setPlanEditor] = useState<PlanRow | null>(null);
  const [planEditForm, setPlanEditForm] = useState({
    name: "",
    slug: "",
    planType: "standard",
    descriptionInternal: "",
    active: true,
    maxIntegrations: 5,
    maxDashboards: 10,
    maxUsers: "" as string,
    maxClientAccounts: "" as string,
    maxChildOrganizations: "" as string,
    features: { ...DEFAULT_FEATURES },
  });
  const [planEditSaving, setPlanEditSaving] = useState(false);

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

  const [platformTab, setPlatformTab] = useState("empresas");
  const [orgSearch, setOrgSearch] = useState("");
  const [newOrg, setNewOrg] = useState({
    name: "",
    slug: "",
    planId: "__none__" as string,
    ownerEmail: "",
    ownerName: "",
    ownerPassword: "",
  });
  const [newOrgSaving, setNewOrgSaving] = useState(false);

  const [auditItems, setAuditItems] = useState<PlatformAuditLogItem[]>([]);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPrefix, setAuditPrefix] = useState("");
  const [auditAppliedPrefix, setAuditAppliedPrefix] = useState("");

  const filteredOrgs = useMemo(() => {
    const q = orgSearch.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q) ||
        (o.plan?.name ?? "").toLowerCase().includes(q)
    );
  }, [orgs, orgSearch]);

  const orgById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);

  const sortedSubs = useMemo(() => {
    return [...subs].sort((a, b) => {
      const na = a.organization.name.localeCompare(b.organization.name, "pt-BR");
      if (na !== 0) return na;
      return a.organization.slug.localeCompare(b.organization.slug, "pt-BR");
    });
  }, [subs]);

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
    if (platformTab !== "auditoria" || !platformAdmin) return;
    let cancelled = false;
    (async () => {
      setAuditLoading(true);
      try {
        const res = await fetchPlatformAuditLogs({
          limit: 50,
          action: auditAppliedPrefix.trim() || undefined,
        });
        if (!cancelled) {
          setAuditItems(res.items);
          setAuditCursor(res.nextCursor);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar auditoria");
      } finally {
        if (!cancelled) setAuditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformTab, auditAppliedPrefix, platformAdmin]);

  const loadMoreAudit = useCallback(async () => {
    if (!auditCursor || auditLoading) return;
    setAuditLoading(true);
    try {
      const res = await fetchPlatformAuditLogs({
        limit: 50,
        cursor: auditCursor,
        action: auditAppliedPrefix.trim() || undefined,
      });
      setAuditItems((p) => [...p, ...res.items]);
      setAuditCursor(res.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar mais registros");
    } finally {
      setAuditLoading(false);
    }
  }, [auditCursor, auditLoading, auditAppliedPrefix]);

  function openOrgEditor(o: PlatformOrgRow) {
    setOrgEditName(o.name);
    setOrgEditSlug(o.slug);
    setOrgEditStatus(o.workspaceStatus);
    setOrgEditResellerPartner(o.resellerPartner ?? false);
    setOrgEditor(o);
  }

  function openPlanEditor(p: PlanRow) {
    setPlanEditForm({
      name: p.name,
      slug: p.slug,
      planType: p.planType,
      descriptionInternal: p.descriptionInternal ?? "",
      active: p.active,
      maxIntegrations: p.maxIntegrations,
      maxDashboards: p.maxDashboards,
      maxUsers: p.maxUsers != null ? String(p.maxUsers) : "",
      maxClientAccounts: p.maxClientAccounts != null ? String(p.maxClientAccounts) : "",
      maxChildOrganizations: p.maxChildOrganizations != null ? String(p.maxChildOrganizations) : "",
      features: { ...DEFAULT_FEATURES, ...(p.features ?? {}) },
    });
    setPlanEditor(p);
  }

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

  async function handleCreateOrganization(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNewOrgSaving(true);
    try {
      await createPlatformOrganization({
        name: newOrg.name.trim(),
        slug: newOrg.slug.trim() || undefined,
        planId: newOrg.planId === "__none__" ? null : newOrg.planId,
        ownerEmail: newOrg.ownerEmail.trim() || undefined,
        ownerName: newOrg.ownerName.trim() || undefined,
        ownerPassword: newOrg.ownerPassword || undefined,
      });
      setNewOrg({
        name: "",
        slug: "",
        planId: "__none__",
        ownerEmail: "",
        ownerName: "",
        ownerPassword: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar empresa");
    } finally {
      setNewOrgSaving(false);
    }
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

  function openSubscriptionEditor(s: PlatformSubscriptionRow) {
    const o = orgById.get(s.organization.id);
    if (!o) {
      setError(
        "Esta empresa não está na lista atual. Abra a aba Empresas ou clique em atualizar após criar o tenant."
      );
      return;
    }
    setManageOrg(o);
  }

  async function handleRemoveSubscription(organizationId: string, orgLabel: string) {
    if (
      !window.confirm(
        `Remover assinatura e plano de «${orgLabel}»? A empresa continua cadastrada; você poderá atribuir outro plano depois.`
      )
    ) {
      return;
    }
    setSubRowBusy(organizationId);
    setError(null);
    try {
      await assignOrgPlan(organizationId, null);
      if (manageOrg?.id === organizationId) setManageOrg(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover assinatura");
    } finally {
      setSubRowBusy(null);
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

  async function saveOrgEditor() {
    if (!orgEditor) return;
    setOrgEditSaving(true);
    setError(null);
    try {
      await patchPlatformOrganization(orgEditor.id, {
        name: orgEditName.trim(),
        slug: orgEditSlug.trim().toLowerCase(),
        workspaceStatus: orgEditStatus,
        ...(orgEditor.parentOrganizationId == null ? { resellerPartner: orgEditResellerPartner } : {}),
      });
      setOrgEditor(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar empresa");
    } finally {
      setOrgEditSaving(false);
    }
  }

  async function orgSetStatus(id: string, workspaceStatus: WorkspaceStatusDto) {
    setOrgRowBusy(id);
    setError(null);
    try {
      await patchPlatformOrganization(id, { workspaceStatus });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar status");
    } finally {
      setOrgRowBusy(null);
    }
  }

  async function handleDeleteOrganization(o: PlatformOrgRow) {
    if (
      !window.confirm(
        `Excluir "${o.name}"? Será aplicado arquivamento + soft delete. Não permitido se existirem organizações filhas.`
      )
    ) {
      return;
    }
    setOrgRowBusy(o.id);
    setError(null);
    try {
      await deletePlatformOrganization(o.id);
      if (manageOrg?.id === o.id) setManageOrg(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir empresa");
    } finally {
      setOrgRowBusy(null);
    }
  }

  async function planSetActive(id: string, active: boolean) {
    setPlanRowBusy(id);
    setError(null);
    try {
      await updatePlatformPlan(id, { active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar plano");
    } finally {
      setPlanRowBusy(null);
    }
  }

  async function savePlanEditor() {
    if (!planEditor) return;
    setPlanEditSaving(true);
    setError(null);
    try {
      await updatePlatformPlan(planEditor.id, {
        name: planEditForm.name.trim(),
        slug: planEditForm.slug.trim().toLowerCase(),
        planType: planEditForm.planType,
        descriptionInternal: planEditForm.descriptionInternal.trim() || null,
        active: planEditForm.active,
        maxIntegrations: Number(planEditForm.maxIntegrations),
        maxDashboards: Number(planEditForm.maxDashboards),
        maxUsers: parseCap(planEditForm.maxUsers),
        maxClientAccounts: parseCap(planEditForm.maxClientAccounts),
        maxChildOrganizations: parseCap(planEditForm.maxChildOrganizations),
        features: planEditForm.features,
      });
      setPlanEditor(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar plano");
    } finally {
      setPlanEditSaving(false);
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
    return <Navigate to="/revenda" replace />;
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plataforma</h1>
          <p className="text-sm text-muted-foreground">
            Empresas raiz, catálogo de planos e assinaturas. Use as abas para separar cada área.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleSyncSubs}>
          Sincronizar assinaturas (org → subscription)
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      <Dialog open={!!manageOrg} onOpenChange={(o) => !o && setManageOrg(null)}>
        <DialogContent
          alignTop
          title={`Assinatura · ${manageOrg?.name ?? ""}`}
          className="w-[min(100vw-1rem,28rem)] max-w-none sm:max-w-lg"
        >
          {manageOrg && (
            <div className="max-h-[calc(100dvh-7rem)] space-y-4 overflow-y-auto pr-1 text-sm">
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

      <Dialog open={!!orgEditor} onOpenChange={(o) => !o && setOrgEditor(null)}>
        <DialogContent alignTop title={`Editar empresa · ${orgEditor?.name ?? ""}`} className="sm:max-w-md">
          {orgEditor ? (
            <div className="max-h-[calc(100dvh-7rem)] space-y-3 overflow-y-auto pr-1 text-sm">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={orgEditName} onChange={(e) => setOrgEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={orgEditSlug} onChange={(e) => setOrgEditSlug(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Status operacional (workspace)</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2"
                  value={orgEditStatus}
                  onChange={(e) => setOrgEditStatus(e.target.value as WorkspaceStatusDto)}
                >
                  <option value="ACTIVE">Ativa</option>
                  <option value="PAUSED">Pausada</option>
                  <option value="ARCHIVED">Arquivada</option>
                </select>
              </div>
              {orgEditor.parentOrganizationId == null ? (
                <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <input
                    id="org-reseller-partner"
                    type="checkbox"
                    checked={orgEditResellerPartner}
                    onChange={(e) => setOrgEditResellerPartner(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <div className="min-w-0">
                    <Label htmlFor="org-reseller-partner" className="font-medium leading-snug">
                      Parceiro de revenda (matriz)
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Se ativo, esta empresa raiz pode usar o painel &quot;Matriz e filiais&quot;, revender planos e
                      cadastrar agências/empresas. Se desativado, o cliente opera só a própria conta.
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOrgEditor(null)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={orgEditSaving} onClick={() => void saveOrgEditor()}>
                  Salvar
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!planEditor} onOpenChange={(o) => !o && setPlanEditor(null)}>
        <DialogContent
          alignTop
          title={`Editar plano · ${planEditor?.name ?? ""}`}
          className="max-w-2xl"
        >
          {planEditor ? (
            <div className="max-h-[calc(100dvh-7rem)] space-y-3 overflow-y-auto pr-1 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={planEditForm.name} onChange={(e) => setPlanEditForm((s) => ({ ...s, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={planEditForm.slug}
                    onChange={(e) => setPlanEditForm((s) => ({ ...s, slug: e.target.value }))}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2"
                    value={planEditForm.planType}
                    onChange={(e) => setPlanEditForm((s) => ({ ...s, planType: e.target.value }))}
                  >
                    <option value="standard">standard</option>
                    <option value="enterprise">enterprise</option>
                    <option value="trial">trial</option>
                    <option value="internal">internal</option>
                    <option value="custom">custom</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="pe-active"
                    type="checkbox"
                    checked={planEditForm.active}
                    onChange={(e) => setPlanEditForm((s) => ({ ...s, active: e.target.checked }))}
                  />
                  <Label htmlFor="pe-active" className="font-normal">
                    Ativo no catálogo
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição interna</Label>
                <Input
                  value={planEditForm.descriptionInternal}
                  onChange={(e) => setPlanEditForm((s) => ({ ...s, descriptionInternal: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                {(
                  [
                    ["marketingDashboard", "Marketing"],
                    ["performanceAlerts", "Alertas"],
                    ["multiUser", "Multiusuário"],
                    ["multiOrganization", "Multiempresa"],
                    ["integrations", "Integrações"],
                    ["webhooks", "Webhooks"],
                    ["campaignWrite", "Edição campanhas"],
                  ] as const
                ).map(([k, lab]) => (
                  <label key={k} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!planEditForm.features[k]}
                      onChange={(e) =>
                        setPlanEditForm((s) => ({
                          ...s,
                          features: { ...s.features, [k]: e.target.checked },
                        }))
                      }
                    />
                    {lab}
                  </label>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Integrações</Label>
                  <Input
                    type="number"
                    min={0}
                    value={planEditForm.maxIntegrations}
                    onChange={(e) =>
                      setPlanEditForm((s) => ({ ...s, maxIntegrations: Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Dashboards</Label>
                  <Input
                    type="number"
                    min={0}
                    value={planEditForm.maxDashboards}
                    onChange={(e) =>
                      setPlanEditForm((s) => ({ ...s, maxDashboards: Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Usuários (∞ vazio)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={planEditForm.maxUsers}
                    onChange={(e) => setPlanEditForm((s) => ({ ...s, maxUsers: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Clientes</Label>
                  <Input
                    type="number"
                    min={0}
                    value={planEditForm.maxClientAccounts}
                    onChange={(e) => setPlanEditForm((s) => ({ ...s, maxClientAccounts: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Filhas</Label>
                  <Input
                    type="number"
                    min={0}
                    value={planEditForm.maxChildOrganizations}
                    onChange={(e) => setPlanEditForm((s) => ({ ...s, maxChildOrganizations: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setPlanEditor(null)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={planEditSaving} onClick={() => void savePlanEditor()}>
                  Salvar plano
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Tabs value={platformTab} onValueChange={setPlatformTab} className="w-full min-w-0 space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/80 p-1">
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="planos">Planos</TabsTrigger>
          <TabsTrigger value="assinaturas">Assinaturas</TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="empresas" className="mt-4 space-y-4 focus-visible:outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nova empresa raiz</CardTitle>
              <CardDescription>
                Cria um tenant independente (sem matriz). Slug vazio gera um identificador a partir do nome. Plano e
                proprietário são opcionais.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handleCreateOrganization(e)} className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nome da empresa</Label>
                  <Input
                    value={newOrg.name}
                    onChange={(e) => setNewOrg((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Ex.: Acme Ltda"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug (opcional)</Label>
                  <Input
                    value={newOrg.slug}
                    onChange={(e) => setNewOrg((s) => ({ ...s, slug: e.target.value }))}
                    placeholder="só letras minúsculas, números e hífen"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Plano inicial</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={newOrg.planId}
                    onChange={(e) => setNewOrg((s) => ({ ...s, planId: e.target.value }))}
                  >
                    <option value="__none__">Sem plano</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 border-t border-border/60 pt-3 sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Primeiro usuário — proprietário (opcional)</p>
                  <p className="text-xs text-muted-foreground">
                    Se preencher, informe os três campos. A conta precisará trocar a senha no primeiro login.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    autoComplete="off"
                    value={newOrg.ownerEmail}
                    onChange={(e) => setNewOrg((s) => ({ ...s, ownerEmail: e.target.value }))}
                    placeholder="admin@empresa.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome do usuário</Label>
                  <Input
                    value={newOrg.ownerName}
                    onChange={(e) => setNewOrg((s) => ({ ...s, ownerName: e.target.value }))}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Senha inicial</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={newOrg.ownerPassword}
                    onChange={(e) => setNewOrg((s) => ({ ...s, ownerPassword: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <div className="flex items-end sm:col-span-2">
                  <Button type="submit" disabled={newOrgSaving}>
                    {newOrgSaving ? "Criando…" : "Criar empresa"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">Empresas e plano</CardTitle>
                  <CardDescription>
                    Editar dados, pausar workspace, assinatura/limites ou trocar o plano (o seletor salva na hora).
                  </CardDescription>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar nome, slug ou plano…"
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    aria-label="Filtrar empresas"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollRegion className="scrollbar-thin">
                <table className="w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Empresa</th>
                      <th className="px-4 py-2 font-medium">Workspace</th>
                      <th className="px-4 py-2 font-medium">Plano</th>
                      <th className="px-4 py-2 font-medium">Assinatura</th>
                      <th className="px-4 py-2 font-medium">Trocar plano</th>
                      <th className="px-4 py-2 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrgs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          {orgSearch.trim() ? "Nenhuma empresa corresponde à busca." : "Nenhuma empresa cadastrada."}
                        </td>
                      </tr>
                    ) : (
                      filteredOrgs.map((o) => (
                        <tr key={o.id} className="border-b border-border/60">
                          <td className="px-4 py-2">
                            <span className="font-medium">{o.name}</span>
                            <div className="text-xs text-muted-foreground">{o.slug}</div>
                          </td>
                          <td className="px-4 py-2 text-xs">{ORG_STATUS_PT[o.workspaceStatus]}</td>
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
                              onChange={(e) => void handleAssign(o.id, e.target.value)}
                              title="Salva ao alterar"
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
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={orgRowBusy === o.id}
                                onClick={() => openOrgEditor(o)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Editar
                              </Button>
                              {o.workspaceStatus === "ACTIVE" ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="gap-1"
                                  disabled={orgRowBusy === o.id}
                                  onClick={() => void orgSetStatus(o.id, "PAUSED")}
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                  Pausar
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="gap-1"
                                  disabled={orgRowBusy === o.id}
                                  onClick={() => void orgSetStatus(o.id, "ACTIVE")}
                                >
                                  <PlayCircle className="h-3.5 w-3.5" />
                                  Ativar
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setManageOrg(o)}
                              >
                                Assinatura
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-destructive hover:text-destructive"
                                disabled={orgRowBusy === o.id}
                                onClick={() => void handleDeleteOrganization(o)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Excluir
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </ScrollRegion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planos" className="mt-4 space-y-4 focus-visible:outline-none">
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
                    ["campaignWrite", "Edição campanhas"],
                  ] as const
                ).map(([k, lab]) => (
                  <label key={k} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!newPlan.features[k]}
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
                  <th className="px-4 py-2 font-medium text-right">Ações</th>
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
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => openPlanEditor(p)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        {p.active ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="gap-1"
                            disabled={planRowBusy === p.id}
                            onClick={() => void planSetActive(p.id, false)}
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Inativar
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="gap-1"
                            disabled={planRowBusy === p.id}
                            onClick={() => void planSetActive(p.id, true)}
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            Ativar
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-destructive hover:text-destructive"
                          disabled={planRowBusy === p.id}
                          onClick={() => handleDeletePlan(p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="assinaturas" className="mt-4 space-y-4 focus-visible:outline-none">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Assinaturas</CardTitle>
          <CardDescription>
            Uma linha por empresa (cada tenant tem no máximo uma assinatura). Nomes repetidos são organizações
            diferentes — use o slug para distinguir.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollRegion className="scrollbar-thin">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Empresa</th>
                  <th className="px-4 py-2 font-medium">Slug</th>
                  <th className="px-4 py-2 font-medium">Plano</th>
                  <th className="px-4 py-2 font-medium">Modalidade</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Início</th>
                  <th className="px-4 py-2 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedSubs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma assinatura ativa.
                    </td>
                  </tr>
                ) : (
                  sortedSubs.map((s) => (
                    <tr key={s.id} className="border-b border-border/60">
                      <td className="px-4 py-2">
                        <span className="font-medium">{s.organization.name}</span>
                        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground" title="ID interno">
                          {s.organization.id.slice(0, 12)}…
                        </div>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{s.organization.slug}</td>
                      <td className="px-4 py-2 text-muted-foreground">{s.plan.name}</td>
                      <td className="px-4 py-2 text-xs">{s.billingMode}</td>
                      <td className="px-4 py-2 text-xs">{s.status}</td>
                      <td className="px-4 py-2 text-xs tabular-nums">
                        {new Date(s.startedAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            disabled={subRowBusy === s.organization.id}
                            onClick={() => openSubscriptionEditor(s)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-destructive hover:text-destructive"
                            disabled={subRowBusy === s.organization.id}
                            onClick={() =>
                              void handleRemoveSubscription(s.organization.id, s.organization.name)
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remover
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollRegion>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="auditoria" className="mt-4 space-y-4 focus-visible:outline-none">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Auditoria global</CardTitle>
              <CardDescription>
                Eventos gravados em <code className="text-xs">AuditLog</code> (contexto, webhooks, campanhas Meta,
                arquivamento de workspace, etc.). Filtro por prefixo da ação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1 space-y-1.5">
                  <Label htmlFor="audit-action-prefix">Prefixo da ação</Label>
                  <Input
                    id="audit-action-prefix"
                    value={auditPrefix}
                    onChange={(e) => setAuditPrefix(e.target.value)}
                    placeholder="ex.: webhook. ou media.meta"
                    className="font-mono text-xs"
                  />
                </div>
                <Button type="button" variant="secondary" onClick={() => setAuditAppliedPrefix(auditPrefix)}>
                  Buscar
                </Button>
              </div>
              <ScrollRegion className="scrollbar-thin max-h-[min(70vh,520px)] rounded-md border border-border/60">
                <table className="w-full min-w-[720px] text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Quando</th>
                      <th className="px-3 py-2 font-medium">Ação</th>
                      <th className="px-3 py-2 font-medium">Entidade</th>
                      <th className="px-3 py-2 font-medium">Org</th>
                      <th className="px-3 py-2 font-medium">Ator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditItems.length === 0 && !auditLoading ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                          Nenhum registro.
                        </td>
                      </tr>
                    ) : (
                      auditItems.map((row) => (
                        <tr key={row.id} className="border-b border-border/50 align-top">
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                            {new Date(row.createdAt).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px]">{row.action}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            <span className="font-medium text-foreground">{row.entityType}</span>
                            {row.entityId ? (
                              <div className="mt-0.5 max-w-[200px] truncate font-mono text-[10px]" title={row.entityId}>
                                {row.entityId}
                              </div>
                            ) : null}
                          </td>
                          <td className="max-w-[100px] truncate px-3 py-2 font-mono text-[10px] text-muted-foreground">
                            {row.organizationId ?? "—"}
                          </td>
                          <td className="max-w-[100px] truncate px-3 py-2 font-mono text-[10px] text-muted-foreground">
                            {row.actorUserId}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </ScrollRegion>
              {auditCursor ? (
                <Button type="button" variant="outline" disabled={auditLoading} onClick={() => void loadMoreAudit()}>
                  {auditLoading ? "Carregando…" : "Carregar mais"}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
