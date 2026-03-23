import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  resellerCreatePlan,
  resellerDeletePlan,
  resellerDuplicatePlan,
  resellerUpdatePlan,
  fetchResellerPlansCatalog,
  REVENDA_PLAN_FEATURE_KEYS,
  type ResellerPlanRow,
} from "@/lib/revenda-api";
import { formatPlanCap } from "@/lib/organization-api";

function parseFeatures(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const { key } of REVENDA_PLAN_FEATURE_KEYS) {
    out[key] = false;
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    for (const { key } of REVENDA_PLAN_FEATURE_KEYS) {
      if (o[key] !== undefined) out[key] = Boolean(o[key]);
    }
  }
  return out;
}

const DEFAULT_NUM = { maxIntegrations: 5, maxDashboards: 3, maxUsers: null as number | null };

type FormState = {
  name: string;
  slug: string;
  planType: string;
  descriptionInternal: string;
  active: boolean;
  maxIntegrations: string;
  maxDashboards: string;
  maxUsers: string;
  maxClientAccounts: string;
  maxChildOrganizations: string;
  features: Record<string, boolean>;
};

function emptyForm(): FormState {
  const features = parseFeatures({});
  features.marketingDashboard = true;
  features.performanceAlerts = true;
  features.multiUser = true;
  features.multiOrganization = true;
  features.integrations = true;
  return {
    name: "",
    slug: "",
    planType: "standard",
    descriptionInternal: "",
    active: true,
    maxIntegrations: String(DEFAULT_NUM.maxIntegrations),
    maxDashboards: String(DEFAULT_NUM.maxDashboards),
    maxUsers: "",
    maxClientAccounts: "",
    maxChildOrganizations: "",
    features,
  };
}

function planToForm(p: ResellerPlanRow): FormState {
  return {
    name: p.name,
    slug: p.slug,
    planType: p.planType,
    descriptionInternal: (p.descriptionInternal as string) ?? "",
    active: p.active,
    maxIntegrations: String(p.maxIntegrations),
    maxDashboards: String(p.maxDashboards),
    maxUsers: p.maxUsers != null ? String(p.maxUsers) : "",
    maxClientAccounts: p.maxClientAccounts != null ? String(p.maxClientAccounts) : "",
    maxChildOrganizations: p.maxChildOrganizations != null ? String(p.maxChildOrganizations) : "",
    features: parseFeatures(p.features),
  };
}

function parseOptionalInt(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

export function RevendaPlansPage() {
  const [plans, setPlans] = useState<ResellerPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<ResellerPlanRow | null>(null);
  const [dupPlan, setDupPlan] = useState<ResellerPlanRow | null>(null);
  const [deletePlan, setDeletePlan] = useState<ResellerPlanRow | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [dupSlug, setDupSlug] = useState("");
  const [dupName, setDupName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchResellerPlansCatalog();
      setPlans(r.plans);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar planos.");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => [...plans].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [plans]);

  function openCreate() {
    setActionError(null);
    setForm(emptyForm());
    setCreateOpen(true);
  }

  function openEdit(p: ResellerPlanRow) {
    setActionError(null);
    setForm(planToForm(p));
    setEditPlan(p);
  }

  function openDup(p: ResellerPlanRow) {
    setActionError(null);
    setDupPlan(p);
    setDupSlug(`${p.slug}-copia`);
    setDupName(`${p.name} (cópia)`);
  }

  async function submitCreate() {
    setSubmitting(true);
    setActionError(null);
    try {
      await resellerCreatePlan({
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        planType: form.planType.trim() || "standard",
        descriptionInternal: form.descriptionInternal.trim() || null,
        active: form.active,
        maxIntegrations: parseInt(form.maxIntegrations, 10) || 0,
        maxDashboards: parseInt(form.maxDashboards, 10) || 0,
        maxUsers: parseOptionalInt(form.maxUsers),
        maxClientAccounts: parseOptionalInt(form.maxClientAccounts),
        maxChildOrganizations: parseOptionalInt(form.maxChildOrganizations),
        features: form.features,
      });
      setCreateOpen(false);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao criar plano.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEdit() {
    if (!editPlan) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await resellerUpdatePlan(editPlan.id, {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        planType: form.planType.trim() || "standard",
        descriptionInternal: form.descriptionInternal.trim() || null,
        active: form.active,
        maxIntegrations: parseInt(form.maxIntegrations, 10) || 0,
        maxDashboards: parseInt(form.maxDashboards, 10) || 0,
        maxUsers: parseOptionalInt(form.maxUsers),
        maxClientAccounts: parseOptionalInt(form.maxClientAccounts),
        maxChildOrganizations: parseOptionalInt(form.maxChildOrganizations),
        features: form.features,
      });
      setEditPlan(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao atualizar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDup() {
    if (!dupPlan) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await resellerDuplicatePlan({
        sourcePlanId: dupPlan.id,
        newSlug: dupSlug.trim().toLowerCase(),
        newName: dupName.trim(),
      });
      setDupPlan(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao duplicar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDelete() {
    if (!deletePlan) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await resellerDeletePlan(deletePlan.id);
      setDeletePlan(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setSubmitting(false);
    }
  }

  const formBody = (
    <div className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto pr-1">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            className="font-mono text-sm"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo interno</Label>
          <Input
            value={form.planType}
            onChange={(e) => setForm((f) => ({ ...f, planType: e.target.value }))}
            placeholder="standard"
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label className="cursor-pointer">Plano ativo (catálogo)</Label>
          <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Descrição interna</Label>
        <Input
          value={form.descriptionInternal}
          onChange={(e) => setForm((f) => ({ ...f, descriptionInternal: e.target.value }))}
          placeholder="Notas para a equipe matriz"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Integrações (base)</Label>
          <Input
            type="number"
            min={0}
            value={form.maxIntegrations}
            onChange={(e) => setForm((f) => ({ ...f, maxIntegrations: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Dashboards (base)</Label>
          <Input
            type="number"
            min={0}
            value={form.maxDashboards}
            onChange={(e) => setForm((f) => ({ ...f, maxDashboards: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Usuários (vazio = ilimitado)</Label>
          <Input
            type="number"
            min={0}
            value={form.maxUsers}
            onChange={(e) => setForm((f) => ({ ...f, maxUsers: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Contas cliente</Label>
          <Input
            type="number"
            min={0}
            value={form.maxClientAccounts}
            onChange={(e) => setForm((f) => ({ ...f, maxClientAccounts: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Empresas filhas</Label>
          <Input
            type="number"
            min={0}
            value={form.maxChildOrganizations}
            onChange={(e) => setForm((f) => ({ ...f, maxChildOrganizations: e.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Módulos base</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {REVENDA_PLAN_FEATURE_KEYS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm">
              <span className="pr-2">{label}</span>
              <Switch
                checked={form.features[key] ?? false}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, features: { ...f.features, [key]: v } }))
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Planos e assinaturas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo completo: criar, editar, ativar/desativar, duplicar e excluir (quando não houver uso). Limites e módulos
            base alimentam a herança nas empresas; overrides ficam na governança de cada filial.
          </p>
        </div>
        <Button type="button" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo plano
        </Button>
      </div>

      {actionError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Catálogo</CardTitle>
          <CardDescription>Inclui planos inativos. Para atribuição rápida em telas filhas, só entram os ativos.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Nome</th>
                    <th className="py-2 pr-3">Slug</th>
                    <th className="py-2 pr-3">Ativo</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Usuários</th>
                    <th className="py-2 pr-3">Integrações</th>
                    <th className="py-2 pr-3">Dashboards</th>
                    <th className="py-2 pr-3">Filhas</th>
                    <th className="py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-3 pr-3 font-medium">{p.name}</td>
                      <td className="py-3 pr-3 font-mono text-xs text-muted-foreground">{p.slug}</td>
                      <td className="py-3 pr-3">{p.active ? "Sim" : "Não"}</td>
                      <td className="py-3 pr-3">{p.planType}</td>
                      <td className="py-3 pr-3 tabular-nums">{formatPlanCap(p.maxUsers)}</td>
                      <td className="py-3 pr-3 tabular-nums">{p.maxIntegrations}</td>
                      <td className="py-3 pr-3 tabular-nums">{p.maxDashboards}</td>
                      <td className="py-3 pr-3 tabular-nums">{formatPlanCap(p.maxChildOrganizations)}</td>
                      <td className="py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => openEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => openDup(p)}>
                            <Copy className="h-3.5 w-3.5" />
                            Duplicar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletePlan(p)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl" title="Novo plano">
          {formBody}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={submitting || !form.name.trim() || !form.slug.trim()}
              onClick={() => void submitCreate()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editPlan} onOpenChange={(o) => !o && setEditPlan(null)}>
        <DialogContent className="max-w-2xl" title="Editar plano">
          {formBody}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditPlan(null)}>
              Fechar
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void submitEdit()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dupPlan} onOpenChange={(o) => !o && setDupPlan(null)}>
        <DialogContent className="sm:max-w-md" title="Duplicar plano">
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Novo slug</Label>
              <Input value={dupSlug} onChange={(e) => setDupSlug(e.target.value)} className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Novo nome</Label>
              <Input value={dupName} onChange={(e) => setDupName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDupPlan(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={submitting || !dupSlug.trim() || !dupName.trim()}
              onClick={() => void submitDup()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Duplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletePlan} onOpenChange={(o) => !o && setDeletePlan(null)}>
        <DialogContent className="sm:max-w-md" title="Excluir plano">
          {deletePlan ? (
            <>
              <p className="text-sm text-muted-foreground">
                Excluir <span className="font-medium text-foreground">{deletePlan.name}</span> permanentemente? Só é permitido
                se nenhuma empresa ou assinatura usar este plano.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeletePlan(null)}>
                  Cancelar
                </Button>
                <Button type="button" variant="destructive" disabled={submitting} onClick={() => void submitDelete()}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
