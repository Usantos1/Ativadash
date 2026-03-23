import { api } from "./api";
import type { ChildrenOperationsDashboard, ChildWorkspaceOperationsRow, ChildOperationsAlert } from "./organization-api";

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
};

export async function fetchResellerPlans(): Promise<{ plans: ResellerPlanRow[] }> {
  return api.get<{ plans: ResellerPlanRow[] }>("/reseller/plans");
}

export async function resellerCreateChild(body: {
  name: string;
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

export async function patchResellerEcosystemUser(
  userId: string,
  body: { email?: string; name?: string; suspended?: boolean }
): Promise<{ user: EcosystemUserRow["user"] }> {
  return api.patch(`/reseller/ecosystem/users/${userId}`, body);
}

export async function postResellerUserPassword(userId: string, newPassword: string): Promise<{ ok: true }> {
  return api.post(`/reseller/ecosystem/users/${userId}/password`, { newPassword });
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

export async function fetchResellerAudit(limit = 80): Promise<{ logs: ResellerAuditRow[] }> {
  return api.get<{ logs: ResellerAuditRow[] }>(`/reseller/audit?limit=${limit}`);
}
