import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, LogIn, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChildWorkspaceOperationsRow, EnabledFeatures, ResellerOrgKind, WorkspaceStatus } from "@/lib/organization-api";
import { switchWorkspaceOrganization } from "@/lib/organization-api";
import {
  fetchResellerOverview,
  fetchResellerPlans,
  fetchResellerEcosystemOrganizations,
  fetchResellerChildDetail,
  resellerCreateChild,
  resellerPatchChildGovernance,
  postResellerEnterChild,
  REVENDA_PLAN_FEATURE_KEYS,
  REVENDA_LIMIT_FIELDS,
  type ResellerPlanRow,
  type ResellerEcosystemOrgRow,
  type PlanLimitFieldKey,
} from "@/lib/revenda-api";
import { useAuthStore } from "@/stores/auth-store";

const STATUS_PT: Record<WorkspaceStatus, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
};

type Props = { kind: ResellerOrgKind };

function defaultFeatureDraft(ctx: { enabledFeatures: EnabledFeatures }): EnabledFeatures {
  return { ...ctx.enabledFeatures };
}

const FALLBACK_ENABLED: EnabledFeatures = {
  marketingDashboard: true,
  performanceAlerts: true,
  multiUser: true,
  multiOrganization: true,
  integrations: true,
  webhooks: false,
  marketing: false,
  captacao: false,
  conversao: false,
  receita: false,
  whatsappcrm: false,
  revenda: false,
  auditoria: false,
  relatorios_avancados: false,
  dashboards_premium: false,
  api: false,
  automacoes: false,
};

const EMPTY_LIMIT_DRAFT: Record<PlanLimitFieldKey, string> = {
  maxUsers: "",
  maxClientAccounts: "",
  maxIntegrations: "",
  maxDashboards: "",
  maxChildOrganizations: "",
};

export function RevendaTenantsPage({ kind }: Props) {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [rows, setRows] = useState<ChildWorkspaceOperationsRow[]>([]);
  const [ecosystem, setEcosystem] = useState<ResellerEcosystemOrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<ResellerPlanRow[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createInherit, setCreateInherit] = useState(true);
  const [createPlanId, setCreatePlanId] = useState<string | null>(null);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [editRow, setEditRow] = useState<ChildWorkspaceOperationsRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editStatus, setEditStatus] = useState<WorkspaceStatus>("ACTIVE");
  const [editInherit, setEditInherit] = useState(true);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [featureDraft, setFeatureDraft] = useState<EnabledFeatures | null>(null);
  const [limitDraft, setLimitDraft] = useState<Record<PlanLimitFieldKey, string> | null>(null);
  const [limitsTouched, setLimitsTouched] = useState(false);
  const [modulesTouched, setModulesTouched] = useState(false);
  const [subBilling, setSubBilling] = useState("");
  const [subStatus, setSubStatus] = useState("");
  const [subNotes, setSubNotes] = useState("");

  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const title = kind === "AGENCY" ? "Agências" : "Empresas";
  const description =
    kind === "AGENCY"
      ? "Parceiros e agências no ecossistema: plano próprio, equipe e empresas vinculadas."
      : "Empresas finais (clientes) operando com dados isolados sob a matriz ou sob uma agência.";

  const matrixOrg = useMemo(() => ecosystem.find((o) => o.isMatrix) ?? null, [ecosystem]);
  const agencyOptions = useMemo(
    () => ecosystem.filter((o) => o.resellerOrgKind === "AGENCY" && !o.isMatrix),
    [ecosystem]
  );

  const filtered = useMemo(
    () => rows.filter((r) => (r.resellerOrgKind ?? "CLIENT") === kind),
    [rows, kind]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, p, eco] = await Promise.all([
        fetchResellerOverview(),
        fetchResellerPlans(),
        fetchResellerEcosystemOrganizations(),
      ]);
      setRows(d.organizations);
      setPlans(p.plans);
      setEcosystem(eco.organizations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editRow) {
      setFeatureDraft(null);
      setLimitDraft(null);
      setLimitsTouched(false);
      setModulesTouched(false);
      setSubBilling("");
      setSubStatus("");
      setSubNotes("");
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void fetchResellerChildDetail(editRow.id)
      .then((d) => {
        if (cancelled) return;
        setFeatureDraft(defaultFeatureDraft(d.context));
        const ov = d.limitsOverride;
        const next: Record<PlanLimitFieldKey, string> = { ...EMPTY_LIMIT_DRAFT };
        if (ov) {
          if (ov.maxUsers != null) next.maxUsers = String(ov.maxUsers);
          if (ov.maxClientAccounts != null) next.maxClientAccounts = String(ov.maxClientAccounts);
          if (ov.maxIntegrations != null) next.maxIntegrations = String(ov.maxIntegrations);
          if (ov.maxDashboards != null) next.maxDashboards = String(ov.maxDashboards);
          if (ov.maxChildOrganizations != null) next.maxChildOrganizations = String(ov.maxChildOrganizations);
        }
        setLimitDraft(next);
        setLimitsTouched(false);
        setModulesTouched(false);
        const sub = d.context.subscription;
        setSubBilling(sub?.billingMode ?? "");
        setSubStatus(sub?.status ?? "");
        setSubNotes(sub?.notes ?? "");
      })
      .catch(() => {
        if (!cancelled) {
          setActionError("Não foi possível carregar detalhes de governança (módulos/limites).");
          setFeatureDraft({ ...FALLBACK_ENABLED });
          setLimitDraft({ ...EMPTY_LIMIT_DRAFT });
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editRow]);

  async function handleEnterChild(orgId: string) {
    setActionError(null);
    setSwitchingId(orgId);
    try {
      await postResellerEnterChild(orgId);
      const r = await switchWorkspaceOrganization(orgId);
      setAuth(r.user, r.accessToken, r.refreshToken, {
        memberships: r.memberships,
        managedOrganizations: r.managedOrganizations,
      });
      navigate("/dashboard");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Não foi possível entrar na empresa.");
    } finally {
      setSwitchingId(null);
    }
  }

  async function submitCreate() {
    if (!createName.trim()) return;
    setCreateSubmitting(true);
    setActionError(null);
    try {
      await resellerCreateChild({
        name: createName.trim(),
        parentOrganizationId:
          kind === "CLIENT" && createParentId && createParentId !== "__matrix__" ? createParentId : undefined,
        inheritPlanFromParent: createInherit,
        planId: createInherit ? undefined : createPlanId,
        resellerOrgKind: kind,
      });
      setCreateOpen(false);
      setCreateName("");
      setCreateInherit(true);
      setCreatePlanId(null);
      setCreateParentId(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao criar.");
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function submitEdit() {
    if (!editRow || !limitDraft) return;
    setEditSubmitting(true);
    setActionError(null);
    try {
      const body: Record<string, unknown> = {
        name: editName.trim(),
        workspaceStatus: editStatus,
        inheritPlanFromParent: editInherit,
        ...(editInherit ? {} : { planId: editPlanId }),
      };
      if (featureDraft && modulesTouched) {
        body.featureOverrides = Object.fromEntries(
          REVENDA_PLAN_FEATURE_KEYS.map(({ key }) => [key, featureDraft[key]])
        );
      }
      body.workspaceNote = editNote.trim() ? editNote.trim() : null;
      if (limitsTouched) {
        const lo: Record<string, number | null> = {};
        for (const { key } of REVENDA_LIMIT_FIELDS) {
          const t = limitDraft[key].trim();
          lo[key] = t === "" ? null : parseInt(t, 10);
        }
        body.limitsOverride = lo;
      }
      if (subBilling.trim() || subStatus.trim() || subNotes.trim()) {
        body.subscription = {
          ...(subBilling.trim() ? { billingMode: subBilling.trim() } : {}),
          ...(subStatus.trim() ? { status: subStatus.trim() } : {}),
          ...(subNotes.trim() ? { notes: subNotes.trim() } : {}),
        };
      }
      await resellerPatchChildGovernance(editRow.id, body);
      setEditRow(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setEditSubmitting(false);
    }
  }

  function openEdit(r: ChildWorkspaceOperationsRow) {
    setActionError(null);
    setEditRow(r);
    setEditName(r.name);
    setEditNote(r.workspaceNote ?? "");
    setEditStatus(r.workspaceStatus);
    setEditInherit(r.inheritPlanFromParent);
    setEditPlanId(r.planId);
  }

  function resetLimitsToInherit() {
    if (!limitDraft) return;
    const cleared: Record<PlanLimitFieldKey, string> = {
      maxUsers: "",
      maxClientAccounts: "",
      maxIntegrations: "",
      maxDashboards: "",
      maxChildOrganizations: "",
    };
    setLimitDraft(cleared);
    setLimitsTouched(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setCreateParentId(null);
            setCreateOpen(true);
          }}
          className="shrink-0 gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova {kind === "AGENCY" ? "agência" : "empresa"}
        </Button>
      </div>

      {actionError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Listagem</CardTitle>
          <CardDescription>
            {filtered.length} registro(s) · plano, status e consumo resumidos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro nesta categoria.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Nome</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Plano</th>
                    <th className="py-2 pr-3">Membros</th>
                    <th className="py-2 pr-3">Integrações</th>
                    <th className="py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-3 pr-3 font-medium">{r.name}</td>
                      <td className="py-3 pr-3">{STATUS_PT[r.workspaceStatus]}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{r.plan?.name ?? "—"}</td>
                      <td className="py-3 pr-3 tabular-nums">{r.memberCount}</td>
                      <td className="py-3 pr-3 tabular-nums">{r.connectedIntegrations}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            disabled={switchingId === r.id}
                            onClick={() => void handleEnterChild(r.id)}
                          >
                            {switchingId === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <LogIn className="h-3.5 w-3.5" />
                            )}
                            Entrar
                          </Button>
                          <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Governança
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
        <DialogContent className="sm:max-w-md" title={`Nova ${kind === "AGENCY" ? "agência" : "empresa"}`}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cn">Nome</Label>
              <Input id="cn" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Nome exibido" />
            </div>
            {kind === "CLIENT" && matrixOrg ? (
              <div className="space-y-2">
                <Label>Vincular a</Label>
                <Select
                  value={createParentId ?? "__matrix__"}
                  onValueChange={(v) => setCreateParentId(v === "__matrix__" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Matriz ou agência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__matrix__">Matriz (direto)</SelectItem>
                    {agencyOptions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        Agência: {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <input
                id="ci"
                type="checkbox"
                checked={createInherit}
                onChange={(e) => setCreateInherit(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="ci">Herdar plano do pai (matriz ou agência)</Label>
            </div>
            {!createInherit ? (
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={createPlanId ?? ""} onValueChange={(v) => setCreatePlanId(v || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={createSubmitting || !createName.trim()} onClick={() => void submitCreate()}>
              {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" title="Governança">
          {editRow ? (
            <>
              {detailLoading ? (
                <div className="flex items-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Carregando módulos e limites…
                </div>
              ) : null}
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="en">Nome</Label>
                  <Input id="en" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Nota operacional</Label>
                  <Input
                    id="note"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Opcional · substitui ou define observação interna"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status operacional</Label>
                  <Select value={editStatus} onValueChange={(v) => setEditStatus(v as WorkspaceStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Ativa</SelectItem>
                      <SelectItem value="PAUSED">Pausada</SelectItem>
                      <SelectItem value="ARCHIVED">Arquivada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="ei"
                    type="checkbox"
                    checked={editInherit}
                    onChange={(e) => setEditInherit(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="ei">Herdar plano da organização pai</Label>
                </div>
                {!editInherit ? (
                  <div className="space-y-2">
                    <Label>Plano</Label>
                    <Select value={editPlanId ?? ""} onValueChange={(v) => setEditPlanId(v || null)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Plano" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="space-y-2 border-t pt-4">
                  <p className="text-sm font-medium">Assinatura operacional (opcional)</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Billing mode</Label>
                      <Input value={subBilling} onChange={(e) => setSubBilling(e.target.value)} placeholder="ex. monthly" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <Input value={subStatus} onChange={(e) => setSubStatus(e.target.value)} placeholder="ex. active" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notas</Label>
                    <Input value={subNotes} onChange={(e) => setSubNotes(e.target.value)} />
                  </div>
                </div>

                {featureDraft ? (
                  <div className="space-y-2 border-t pt-4">
                    <p className="text-sm font-medium">Módulos efetivos (override explícito ao salvar)</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {REVENDA_PLAN_FEATURE_KEYS.map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm">
                          <span className="pr-2">{label}</span>
                          <Switch
                            checked={featureDraft[key]}
                            onCheckedChange={(v) => {
                              setModulesTouched(true);
                              setFeatureDraft((d) => (d ? { ...d, [key]: v } : d));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {limitDraft ? (
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">Limites (vazio = herdar após salvar)</p>
                      <Button type="button" variant="outline" size="sm" onClick={resetLimitsToInherit}>
                        Limpar overrides
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {REVENDA_LIMIT_FIELDS.map(({ key, label }) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs">{label}</Label>
                          <Input
                            type="number"
                            min={0}
                            value={limitDraft[key]}
                            onChange={(e) => {
                              setLimitsTouched(true);
                              setLimitDraft((ld) => (ld ? { ...ld, [key]: e.target.value } : ld));
                            }}
                            placeholder="Herdar"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
                  Fechar
                </Button>
                <Button
                  type="button"
                  disabled={editSubmitting || detailLoading || !limitDraft}
                  onClick={() => void submitEdit()}
                >
                  {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
