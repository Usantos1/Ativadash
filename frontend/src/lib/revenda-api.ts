import { api } from "./api";
import type { ChildrenOperationsDashboard, ChildWorkspaceOperationsRow, ChildOperationsAlert } from "./organization-api";
import type { EnabledFeatures, OrganizationContext, PlanLimits } from "./organization-api";

export async function fetchResellerOverview(): Promise<ChildrenOperationsDashboard> {
  return api.get<ChildrenOperationsDashboard>("/reseller/overview");
}

export type ResellerOperationalHealth = {
  summary: ChildrenOperationsDashboard["summary"];
  organizationsNeedingAttention: ChildWorkspaceOperationsRow[];
  prioritizedAlerts: ChildOperationsAlert[];
};

export async function fetchResellerOperationalHealth(): Promise<ResellerOperationalHealth> {
  return api.get<ResellerOperationalHealth>("/reseller/operational-health");
}

export type ResellerPlanRow = {
  id: string;
  name: string;
  slug: string;
  planType: string;
  active: boolean;
  features: unknown;
  maxIntegrations: number;
  maxDashboards: number;
  maxUsers: number | null;
  maxClientAccounts: number | null;
  maxChildOrganizations: number | null;
  descriptionInternal?: string | null;
};

export async function fetchResellerPlans(): Promise<{ plans: ResellerPlanRow[] }> {
  return api.get<{ plans: ResellerPlanRow[] }>("/reseller/plans");
}

export async function fetchResellerPlansCatalog(): Promise<{ plans: ResellerPlanRow[] }> {
  return api.get<{ plans: ResellerPlanRow[] }>("/reseller/plans/catalog");
}

export type ResellerPlanCreateBody = {
  name: string;
  slug: string;
  maxIntegrations: number;
  maxDashboards: number;
  maxUsers?: number | null;
  maxClientAccounts?: number | null;
  maxChildOrganizations?: number | null;
  descriptionInternal?: string | null;
  active?: boolean;
  planType?: string;
  features?: Record<string, boolean | string | number>;
};

export async function resellerCreatePlan(body: ResellerPlanCreateBody): Promise<{ plan: ResellerPlanRow }> {
  return api.post("/reseller/plans", body);
}

export async function resellerUpdatePlan(
  planId: string,
  body: Partial<ResellerPlanCreateBody>
): Promise<{ plan: ResellerPlanRow }> {
  return api.patch(`/reseller/plans/${planId}`, body);
}

export async function resellerDeletePlan(planId: string): Promise<void> {
  await api.delete(`/reseller/plans/${planId}`);
}

export async function resellerDuplicatePlan(body: {
  sourcePlanId: string;
  newSlug: string;
  newName: string;
}): Promise<{ plan: ResellerPlanRow }> {
  return api.post("/reseller/plans/duplicate", body);
}

export type ResellerEcosystemOrgRow = {
  id: string;
  name: string;
  slug: string;
  parentOrganizationId: string | null;
  workspaceStatus: string;
  resellerOrgKind: string | null;
  inheritPlanFromParent: boolean;
  planId: string | null;
  plan: { id: string; name: string; slug: string } | null;
  createdAt: string;
  isMatrix: boolean;
};

export async function fetchResellerEcosystemOrganizations(): Promise<{ organizations: ResellerEcosystemOrgRow[] }> {
  return api.get("/reseller/ecosystem/organizations");
}

export async function resellerCreateChild(body: {
  name: string;
  parentOrganizationId?: string;
  inheritPlanFromParent?: boolean;
  planId?: string | null;
  workspaceNote?: string | null;
  resellerOrgKind?: "AGENCY" | "CLIENT";
}): Promise<{
  organization: {
    id: string;
    name: string;
    slug: string;
    inheritPlanFromParent: boolean;
    planId: string | null;
    workspaceStatus: string;
    workspaceNote: string | null;
    resellerOrgKind: string | null;
  };
}> {
  return api.post("/reseller/children", body);
}

export async function resellerPatchChildGovernance(
  childId: string,
  body: Record<string, unknown>
): Promise<{ organization: unknown }> {
  return api.patch(`/reseller/children/${childId}/governance`, body);
}

export type ResellerChildDetail = {
  context: OrganizationContext;
  limitsOverride: {
    organizationId: string;
    maxUsers: number | null;
    maxClientAccounts: number | null;
    maxIntegrations: number | null;
    maxDashboards: number | null;
    maxChildOrganizations: number | null;
    notes: string | null;
  } | null;
};

export async function fetchResellerChildDetail(childId: string): Promise<ResellerChildDetail> {
  return api.get(`/reseller/children/${childId}/detail`);
}

export type EcosystemUserRow = {
  membershipId: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    suspended: boolean;
    suspendedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    resellerOrgKind: string | null;
    isMatrix: boolean;
  };
};

export async function fetchResellerEcosystemUsers(params: {
  organizationId?: string;
  resellerOrgKind?: "AGENCY" | "CLIENT";
  suspended?: "true" | "false";
  role?: string;
  q?: string;
}): Promise<{ users: EcosystemUserRow[] }> {
  const qs = new URLSearchParams();
  if (params.organizationId) qs.set("organizationId", params.organizationId);
  if (params.resellerOrgKind) qs.set("resellerOrgKind", params.resellerOrgKind);
  if (params.suspended) qs.set("suspended", params.suspended);
  if (params.role) qs.set("role", params.role);
  if (params.q) qs.set("q", params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<{ users: EcosystemUserRow[] }>(`/reseller/ecosystem/users${suffix}`);
}

export async function resellerCreateEcosystemUser(body: {
  email: string;
  name: string;
  password: string;
  organizationId: string;
  role: "owner" | "admin" | "member" | "media_manager" | "analyst";
}): Promise<{ user: EcosystemUserRow["user"] }> {
  return api.post("/reseller/ecosystem/users", body);
}

export async function resellerCreateInvitation(body: {
  organizationId: string;
  email: string;
  role: "admin" | "member" | "media_manager" | "analyst";
}): Promise<{ invitation: { id: string; email: string; role: string }; inviteLink: string }> {
  return api.post("/reseller/ecosystem/invitations", body);
}

export async function patchResellerEcosystemUser(
  userId: string,
  body: { email?: string; name?: string; suspended?: boolean }
): Promise<{ user: EcosystemUserRow["user"] }> {
  return api.patch(`/reseller/ecosystem/users/${userId}`, body);
}

export async function postResellerUserPassword(
  userId: string,
  newPassword: string,
  options?: { forcePasswordChange?: boolean }
): Promise<{ ok: true }> {
  return api.post(`/reseller/ecosystem/users/${userId}/password`, {
    newPassword,
    forcePasswordChange: options?.forcePasswordChange,
  });
}

export async function postResellerMembershipRole(body: {
  organizationId: string;
  targetUserId: string;
  role: string;
}): Promise<{ ok: true }> {
  return api.post("/reseller/ecosystem/membership/role", body);
}

export async function postResellerRemoveMember(body: {
  organizationId: string;
  targetUserId: string;
}): Promise<{ ok: true }> {
  return api.post("/reseller/ecosystem/membership/remove", body);
}

export async function postResellerEnterChild(organizationId: string): Promise<{ ok: true }> {
  return api.post("/reseller/enter-child", { organizationId });
}

export type ResellerAuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  actorUserId: string;
  createdAt: string;
};

export async function fetchResellerAudit(params: {
  limit?: number;
  action?: string;
  entityType?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
}): Promise<{ logs: ResellerAuditRow[] }> {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.action?.trim()) qs.set("action", params.action.trim());
  if (params.entityType?.trim()) qs.set("entityType", params.entityType.trim());
  if (params.actorUserId?.trim()) qs.set("actorUserId", params.actorUserId.trim());
  if (params.from?.trim()) qs.set("from", params.from.trim());
  if (params.to?.trim()) qs.set("to", params.to.trim());
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<{ logs: ResellerAuditRow[] }>(`/reseller/audit${suffix}`);
}

/** Chaves de módulo alinhadas ao merge do backend (plan-features). */
export const REVENDA_PLAN_FEATURE_KEYS = [
  { key: "marketingDashboard", label: "Dashboard marketing" },
  { key: "performanceAlerts", label: "Alertas de performance" },
  { key: "multiUser", label: "Multiusuário" },
  { key: "multiOrganization", label: "Multiorganização" },
  { key: "integrations", label: "Integrações" },
  { key: "webhooks", label: "Webhooks" },
  { key: "marketing", label: "Marketing" },
  { key: "captacao", label: "Captação" },
  { key: "conversao", label: "Conversão" },
  { key: "receita", label: "Receita" },
  { key: "whatsappcrm", label: "WhatsApp CRM" },
  { key: "revenda", label: "Revenda" },
  { key: "auditoria", label: "Auditoria" },
  { key: "relatorios_avancados", label: "Relatórios avançados" },
  { key: "dashboards_premium", label: "Dashboards premium" },
  { key: "api", label: "API" },
  { key: "automacoes", label: "Automações" },
] as const satisfies ReadonlyArray<{ key: keyof EnabledFeatures; label: string }>;

export type PlanLimitFieldKey = keyof PlanLimits;

export const REVENDA_LIMIT_FIELDS: { key: PlanLimitFieldKey; label: string }[] = [
  { key: "maxUsers", label: "Usuários" },
  { key: "maxClientAccounts", label: "Contas cliente" },
  { key: "maxIntegrations", label: "Integrações" },
  { key: "maxDashboards", label: "Dashboards" },
  { key: "maxChildOrganizations", label: "Empresas filhas" },
];
