import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Ban, Building2, Link2Off, Loader2, LogIn, Pencil, PlayCircle, Plus, Store, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { startImpersonation } from "@/lib/impersonation-api";
import {
  fetchResellerOverview,
  fetchResellerPlans,
  fetchResellerEcosystemOrganizations,
  fetchResellerChildDetail,
  resellerCreateChild,
  resellerDetachChildAsStandalone,
  resellerDeleteChild,
  resellerPatchChildGovernance,
  postResellerEnterChild,
  REVENDA_PLAN_FEATURE_KEYS,
  REVENDA_LIMIT_FIELDS,
  type ResellerPlanRow,
  type ResellerEcosystemOrgRow,
  type PlanLimitFieldKey,
} from "@/lib/revenda-api";
import { useAuthStore } from "@/stores/auth-store";
import { dispatchOrganizationPlanFeaturesRefreshIfCurrentOrg } from "@/components/layout/organization-plan-features-context";
import { PageHint } from "@/pages/revenda/PageHint";

const STATUS_PT: Record<WorkspaceStatus, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
};

type Props = {
  /** Kind inicial (legado). Se ausente, lê `?kind=` da URL e cai em "CLIENT". */
  kind?: ResellerOrgKind;
};

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
  campaignWrite: true,
  checkoutIntegrations: false,
};

const EMPTY_LIMIT_DRAFT: Record<PlanLimitFieldKey, string> = {
  maxUsers: "",
  maxClientAccounts: "",
  maxIntegrations: "",
  maxDashboards: "",
  maxChildOrganizations: "",
};

type ClientCadastroForm = {
  legalName: string;
  taxId: string;
  phoneWhatsapp: string;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
  addressLine1: string;
  addressNumber: string;
  addressDistrict: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
};

const EMPTY_CLIENT_CADASTRO: ClientCadastroForm = {
  legalName: "",
  taxId: "",
  phoneWhatsapp: "",
  ownerEmail: "",
  ownerName: "",
  ownerPassword: "",
  addressLine1: "",
  addressNumber: "",
  addressDistrict: "",
  addressCity: "",
  addressState: "",
  addressPostalCode: "",
};

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function isClientCreateFormValid(c: ClientCadastroForm): boolean {
  const cnpj = digitsOnly(c.taxId);
  if (cnpj.length > 0 && cnpj.length !== 14) return false;
  const w = digitsOnly(c.phoneWhatsapp);
  if (w.length < 10 || w.length > 15) return false;
  const em = c.ownerEmail.trim();
  if (em.length < 5 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return false;
  if (c.ownerName.trim().length < 2) return false;
  if (c.ownerPassword.length < 8) return false;
  const uf = c.addressState.trim();
  if (uf.length > 0 && !/^[A-Za-z]{2}$/.test(uf)) return false;
  const cep = digitsOnly(c.addressPostalCode);
  if (cep.length > 0 && cep.length !== 8) return false;
  return true;
}

export function RevendaTenantsPage({ kind: kindProp }: Props) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const currentOrgId = useAuthStore((s) => s.user?.organizationId);
  const kindParam = searchParams.get("kind");
  const kind: ResellerOrgKind = kindProp ?? (kindParam === "AGENCY" ? "AGENCY" : "CLIENT");

  const setKind = useCallback(
    (next: ResellerOrgKind) => {
      const sp = new URLSearchParams(searchParams);
      sp.set("kind", next);
      setSearchParams(sp, { replace: true });
    },
    [searchParams, setSearchParams]
  );

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
  const [clientCadastro, setClientCadastro] = useState<ClientCadastroForm>({ ...EMPTY_CLIENT_CADASTRO });

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
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /** Cadastro com administrador (e-mail, senha, WhatsApp) — obrigatório para cliente e para nova agência. */
  const needsOwnerBootstrap = kind === "CLIENT" || kind === "AGENCY";

  const matrixOrg = useMemo(() => ecosystem.find((o) => o.isMatrix) ?? null, [ecosystem]);
  const agencyOptions = useMemo(
    () => ecosystem.filter((o) => o.resellerOrgKind === "AGENCY" && !o.isMatrix),
    [ecosystem]
  );

  /** IDs de agências filiais — clientes sob uma agência aparecem na aba Agências, não em Clientes. */
  const agencyBranchIds = useMemo(() => new Set(agencyOptions.map((o) => o.id)), [agencyOptions]);

  const kindCounts = useMemo(() => {
    const isClientLike = (r: ChildWorkspaceOperationsRow) => (r.resellerOrgKind ?? "CLIENT") === "CLIENT";
    let clients = 0;
    let agencies = 0;
    for (const r of rows) {
      if (r.resellerOrgKind === "AGENCY" || (isClientLike(r) && r.parentOrganizationId != null && agencyBranchIds.has(r.parentOrganizationId))) {
        agencies += 1;
      } else if (isClientLike(r)) {
        clients += 1;
      }
    }
    return { clients, agencies };
  }, [rows, agencyBranchIds]);

  const activeCount = useMemo(() => rows.filter((r) => r.workspaceStatus === "ACTIVE").length, [rows]);
  const pausedCount = useMemo(() => rows.filter((r) => r.workspaceStatus === "PAUSED").length, [rows]);

  const filtered = useMemo(() => {
    const isClientLike = (r: ChildWorkspaceOperationsRow) => (r.resellerOrgKind ?? "CLIENT") === "CLIENT";

    if (kind === "AGENCY") {
      const list = rows.filter(
        (r) =>
          r.resellerOrgKind === "AGENCY" ||
          (isClientLike(r) &&
            r.parentOrganizationId != null &&
            agencyBranchIds.has(r.parentOrganizationId))
      );
      return [...list].sort((a, b) => {
        const tier = (x: ChildWorkspaceOperationsRow) => (x.resellerOrgKind === "AGENCY" ? 0 : 1);
        const d = tier(a) - tier(b);
        if (d !== 0) return d;
        const pa = a.parentOrganization?.name ?? "";
        const pb = b.parentOrganization?.name ?? "";
        if (pa !== pb) return pa.localeCompare(pb, "pt");
        return a.name.localeCompare(b.name, "pt");
      });
    }

    return rows
      .filter(
        (r) =>
          isClientLike(r) &&
          (r.parentOrganizationId == null || !agencyBranchIds.has(r.parentOrganizationId))
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pt"));
  }, [rows, kind, agencyBranchIds]);

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
          setActionError("Não foi possível carregar módulos e limites desta conta.");
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
      const r = await startImpersonation(orgId);
      setAuth(
        { ...r.user, organization: r.user.organization },
        r.accessToken,
        r.refreshToken,
        { memberships: r.memberships, managedOrganizations: r.managedOrganizations }
      );
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Não foi possível entrar na empresa.");
    } finally {
      setSwitchingId(null);
    }
  }

  async function submitCreate() {
    if (!createName.trim()) return;
    if (needsOwnerBootstrap && !isClientCreateFormValid(clientCadastro)) return;
    setCreateSubmitting(true);
    setActionError(null);
    try {
      const base = {
        name: createName.trim(),
        parentOrganizationId:
          kind === "CLIENT" && createParentId && createParentId !== "__matrix__" ? createParentId : undefined,
        inheritPlanFromParent: createInherit,
        planId: createInherit ? undefined : createPlanId ?? undefined,
        resellerOrgKind: kind,
      };
      await resellerCreateChild(
        needsOwnerBootstrap
          ? {
              ...base,
              legalName: clientCadastro.legalName.trim() || null,
              taxId: clientCadastro.taxId,
              phoneWhatsapp: clientCadastro.phoneWhatsapp,
              ownerEmail: clientCadastro.ownerEmail.trim(),
              ownerName: clientCadastro.ownerName.trim(),
              ownerPassword: clientCadastro.ownerPassword,
              addressLine1: clientCadastro.addressLine1.trim(),
              addressNumber: clientCadastro.addressNumber.trim(),
              addressDistrict: clientCadastro.addressDistrict.trim() || undefined,
              addressCity: clientCadastro.addressCity.trim(),
              addressState: clientCadastro.addressState.trim().toUpperCase(),
              addressPostalCode: clientCadastro.addressPostalCode,
            }
          : base
      );
      setCreateOpen(false);
      setCreateName("");
      setCreateInherit(true);
      setCreatePlanId(null);
      setCreateParentId(null);
      setClientCadastro({ ...EMPTY_CLIENT_CADASTRO });
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
      const editedId = editRow.id;
      await resellerPatchChildGovernance(editedId, body);
      dispatchOrganizationPlanFeaturesRefreshIfCurrentOrg(currentOrgId, editedId);
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

  async function quickSetStatus(row: ChildWorkspaceOperationsRow, status: WorkspaceStatus) {
    setRowActionId(row.id);
    setActionError(null);
    try {
      await resellerPatchChildGovernance(row.id, { workspaceStatus: status });
      dispatchOrganizationPlanFeaturesRefreshIfCurrentOrg(currentOrgId, row.id);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao atualizar status.");
    } finally {
      setRowActionId(null);
    }
  }

  async function confirmDeleteChild(row: ChildWorkspaceOperationsRow) {
    if (
      !window.confirm(
        `Excluir "${row.name}"? A empresa será arquivada e ocultada (soft delete). Não é possível se houver filiais vinculadas.`
      )
    ) {
      return;
    }
    setRowActionId(row.id);
    setActionError(null);
    try {
      await resellerDeleteChild(row.id);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setRowActionId(null);
    }
  }

  async function confirmDetachChild(row: ChildWorkspaceOperationsRow) {
    if (
      !window.confirm(
        `Desvincular "${row.name}" da matriz?\n\n` +
          "Esta empresa fica independente e sai desta lista; as outras agências e clientes da matriz continuam visíveis aqui. " +
          "Deixa de seguir plano e regras da matriz. Quem só enxergava ela pela matriz perde o acesso; quem é membro direto mantém o login. " +
          "Não pode haver filiais vinculadas a ela."
      )
    ) {
      return;
    }
    setRowActionId(row.id);
    setActionError(null);
    try {
      await resellerDetachChildAsStandalone(row.id);
      const matrixId = matrixOrg?.id;
      if (matrixId && currentOrgId === row.id) {
        try {
          const r = await switchWorkspaceOrganization(matrixId);
          setAuth(r.user, r.accessToken, r.refreshToken, {
            memberships: r.memberships,
            managedOrganizations: r.managedOrganizations,
          });
        } catch {
          /* contexto já pode ser a matriz */
        }
      }
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Falha ao desvincular.");
    } finally {
      setRowActionId(null);
    }
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
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Contas da rede</h2>
            <PageHint>
              Clientes finais e agências filiais da sua rede. Clientes têm CNPJ/contrato próprio; agências têm equipe e podem cadastrar clientes abaixo.
            </PageHint>
          </div>
          <p className="text-xs text-muted-foreground">
            {activeCount} ativas · {pausedCount} pausadas · {rows.length} contas no total
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setCreateParentId(null);
            setClientCadastro({ ...EMPTY_CLIENT_CADASTRO });
            setCreateOpen(true);
          }}
          className="h-10 shrink-0 gap-2 rounded-xl px-4 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Nova {kind === "AGENCY" ? "agência" : "empresa"}
        </Button>
      </header>

      {actionError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <div
        className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1"
        role="tablist"
        aria-label="Tipo de conta"
      >
        {[
          { value: "CLIENT" as const, label: "Clientes", icon: Building2, count: kindCounts.clients, hint: "Contas finais com CNPJ/contrato próprio" },
          { value: "AGENCY" as const, label: "Agências", icon: Store, count: kindCounts.agencies, hint: "Filiais com equipe e clientes por baixo" },
        ].map((t) => {
          const active = kind === t.value;
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`${t.label} (${t.count})`}
              title={t.hint}
              onClick={() => setKind(t.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-primary/25"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 opacity-80" aria-hidden />
              <span>{t.label}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                  active ? "bg-primary/15 text-primary" : "bg-muted-foreground/10 text-muted-foreground"
                )}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {kind === "AGENCY" ? "Agências" : "Clientes"} ({filtered.length})
          </CardTitle>
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
                    <th className="py-2 pr-3">Vinculada a</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Plano</th>
                    <th className="py-2 pr-3">Membros</th>
                    <th className="py-2 pr-3">Integrações</th>
                    <th className="py-2 text-right min-w-[280px]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-3 pr-3 font-medium">{r.name}</td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {r.parentOrganization?.name ?? "—"}
                      </td>
                      <td className="py-3 pr-3">{STATUS_PT[r.workspaceStatus]}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{r.plan?.name ?? "—"}</td>
                      <td className="py-3 pr-3 tabular-nums">{r.memberCount}</td>
                      <td className="py-3 pr-3 tabular-nums">{r.connectedIntegrations}</td>
                      <td className="py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
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
                            Acessar como admin
                          </Button>
                          <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          {r.workspaceStatus === "ACTIVE" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              disabled={rowActionId === r.id}
                              onClick={() => void quickSetStatus(r, "PAUSED")}
                            >
                              {rowActionId === r.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Ban className="h-3.5 w-3.5" />
                              )}
                              Inativar
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              disabled={rowActionId === r.id}
                              onClick={() => void quickSetStatus(r, "ACTIVE")}
                            >
                              {rowActionId === r.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <PlayCircle className="h-3.5 w-3.5" />
                              )}
                              Ativar
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            disabled={rowActionId === r.id}
                            onClick={() => void confirmDetachChild(r)}
                            title="Organização independente da matriz"
                          >
                            {rowActionId === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Link2Off className="h-3.5 w-3.5" />
                            )}
                            Desvincular
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-destructive hover:text-destructive"
                            disabled={rowActionId === r.id}
                            onClick={() => void confirmDeleteChild(r)}
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
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setClientCadastro({ ...EMPTY_CLIENT_CADASTRO });
        }}
      >
        <DialogContent
          alignTop
          className="flex w-[min(100vw-1rem,40rem)] max-w-2xl flex-col gap-3 overflow-hidden p-4 sm:gap-4 sm:p-6"
          title={`Nova ${kind === "AGENCY" ? "agência" : "empresa"}`}
        >
          <form autoComplete="off" className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => e.preventDefault()}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] sm:space-y-5">
            <div className="space-y-2">
              <Label htmlFor="cn">
                {kind === "CLIENT" ? "Nome fantasia / marca" : kind === "AGENCY" ? "Nome da agência" : "Nome"}
              </Label>
              <Input
                id="cn"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={
                  kind === "CLIENT"
                    ? "Como a empresa aparece no painel"
                    : kind === "AGENCY"
                      ? "Nome exibido no painel da agência"
                      : "Nome exibido"
                }
              />
            </div>

            {needsOwnerBootstrap ? (
              <>
                <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {kind === "AGENCY" ? "Dados da agência (opcional)" : "Dados da empresa"}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="c-legal">Razão social (opcional)</Label>
                      <Input
                        id="c-legal"
                        value={clientCadastro.legalName}
                        onChange={(e) => setClientCadastro((c) => ({ ...c, legalName: e.target.value }))}
                        placeholder="Nome jurídico"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-cnpj">CNPJ (opcional)</Label>
                      <Input
                        id="c-cnpj"
                        inputMode="numeric"
                        value={clientCadastro.taxId}
                        onChange={(e) => setClientCadastro((c) => ({ ...c, taxId: e.target.value }))}
                        placeholder="Opcional · 14 dígitos se preencher"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-wa">WhatsApp</Label>
                      <Input
                        id="c-wa"
                        inputMode="tel"
                        value={clientCadastro.phoneWhatsapp}
                        onChange={(e) => setClientCadastro((c) => ({ ...c, phoneWhatsapp: e.target.value }))}
                        placeholder="DDD + número"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {kind === "AGENCY" ? "Responsável pela agência (primeiro acesso)" : "Administrador (primeiro acesso)"}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="c-mail">E-mail de login</Label>
                      <Input
                        id="c-mail"
                        type="email"
                        autoComplete="off"
                        value={clientCadastro.ownerEmail}
                        onChange={(e) => setClientCadastro((c) => ({ ...c, ownerEmail: e.target.value }))}
                        placeholder="nome@empresa.com.br"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="c-oname">Nome do responsável</Label>
                      <Input
                        id="c-oname"
                        value={clientCadastro.ownerName}
                        onChange={(e) => setClientCadastro((c) => ({ ...c, ownerName: e.target.value }))}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="c-pw">Senha inicial</Label>
                      <Input
                        id="c-pw"
                        type="password"
                        autoComplete="new-password"
                        value={clientCadastro.ownerPassword}
                        onChange={(e) => setClientCadastro((c) => ({ ...c, ownerPassword: e.target.value }))}
                        placeholder="Mínimo 8 caracteres · deverá trocar no 1º login"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-sm font-semibold text-foreground">Endereço (opcional)</p>
                  <div className="grid gap-3 sm:grid-cols-6">
                    <div className="space-y-2 sm:col-span-4">
                      <Label htmlFor="c-rua">Logradouro</Label>
                      <Input
                        id="c-rua"
                        value={clientCadastro.addressLine1}
                        onChange={(e) => setClientCadastro((c) => ({ ...c, addressLine1: e.target.value }))}
                        placeholder="Rua, avenida…"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="c-num">Número</Label>
                      <Input
                        id="c-num"
                        value={clientCadastro.addressNumber}
                        onChange={(e) => setClientCadastro((c) => ({ ...c, addressNumber: e.target.value }))}
                        placeholder="Nº"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="c-bairro">Bairro (opcional)</Label>
                      <Input
                        id="c-bairro"
                        value={clientCadastro.addressDistrict}
                        onChange={(e) => setClientCadastro((c) => ({ ...c, addressDistrict: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="c-cidade">Cidade</Label>
                      <Input
                        id="c-cidade"
                        value={clientCadastro.addressCity}
                        onChange={(e) => setClientCadastro((c) => ({ ...c, addressCity: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-1">
                      <Label htmlFor="c-uf">UF</Label>
                      <Input
                        id="c-uf"
                        maxLength={2}
                        value={clientCadastro.addressState}
                        onChange={(e) =>
                          setClientCadastro((c) => ({
                            ...c,
                            addressState: e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2),
                          }))
                        }
                        placeholder="SP"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-1">
                      <Label htmlFor="c-cep">CEP</Label>
                      <Input
                        id="c-cep"
                        inputMode="numeric"
                        value={clientCadastro.addressPostalCode}
                        onChange={(e) => setClientCadastro((c) => ({ ...c, addressPostalCode: e.target.value }))}
                        placeholder="00000-000"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : null}

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
          </form>
          <DialogFooter className="shrink-0 border-t border-border/50 bg-background pt-4">
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={
                  createSubmitting ||
                  !createName.trim() ||
                  (needsOwnerBootstrap && !isClientCreateFormValid(clientCadastro)) ||
                  (!createInherit && !createPlanId)
                }
                onClick={() => void submitCreate()}
              >
                {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent
          alignTop
          className="flex max-h-[calc(100dvh-2rem)] w-[min(100vw-1rem,42rem)] max-w-2xl flex-col overflow-y-auto"
          title="Editar conta"
        >
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
