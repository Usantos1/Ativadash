import { api } from "./api";

export type PlanFeaturesPayload = {
  marketingDashboard?: boolean;
  performanceAlerts?: boolean;
  multiUser?: boolean;
  multiOrganization?: boolean;
  integrations?: boolean;
  webhooks?: boolean;
  campaignWrite?: boolean;
};

export type PlanRow = {
  id: string;
  name: string;
  slug: string;
  descriptionInternal: string | null;
  active: boolean;
  planType: string;
  features: PlanFeaturesPayload;
  maxIntegrations: number;
  maxDashboards: number;
  maxUsers: number | null;
  maxClientAccounts: number | null;
  maxChildOrganizations: number | null;
};

export async function fetchPlatformPlans(): Promise<{ plans: PlanRow[] }> {
  return api.get("/platform/plans");
}

export type CreatePlanBody = {
  name: string;
  slug: string;
  maxIntegrations: number;
  maxDashboards: number;
  maxUsers: number | null;
  maxClientAccounts: number | null;
  maxChildOrganizations: number | null;
  descriptionInternal?: string | null;
  active?: boolean;
  planType?: string;
  features?: PlanFeaturesPayload;
};

export async function createPlatformPlan(body: CreatePlanBody): Promise<{ plan: PlanRow }> {
  return api.post("/platform/plans", body);
}

export async function updatePlatformPlan(
  id: string,
  body: Partial<CreatePlanBody>
): Promise<{ plan: PlanRow }> {
  return api.patch(`/platform/plans/${id}`, body);
}

export async function deletePlatformPlan(id: string): Promise<void> {
  await api.delete(`/platform/plans/${id}`);
}

export type WorkspaceStatusDto = "ACTIVE" | "PAUSED" | "ARCHIVED";

export type PlatformOrgRow = {
  id: string;
  name: string;
  slug: string;
  workspaceStatus: WorkspaceStatusDto;
  inheritPlanFromParent: boolean;
  parentOrganizationId: string | null;
  planId: string | null;
  plan: { id: string; name: string; slug: string } | null;
  subscription: {
    id: string;
    billingMode: string;
    status: string;
    startedAt: string;
    renewsAt: string | null;
    planId: string;
  } | null;
  limitsOverride: {
    maxUsers: number | null;
    maxIntegrations: number | null;
    maxDashboards: number | null;
    maxClientAccounts: number | null;
    maxChildOrganizations: number | null;
  } | null;
  createdAt: string;
};

export async function fetchPlatformOrganizations(): Promise<{ organizations: PlatformOrgRow[] }> {
  return api.get("/platform/organizations");
}

export type CreatePlatformOrganizationBody = {
  name: string;
  slug?: string;
  planId?: string | null;
  ownerEmail?: string;
  ownerName?: string;
  ownerPassword?: string;
};

export async function createPlatformOrganization(
  body: CreatePlatformOrganizationBody
): Promise<{ organization: PlatformOrgRow }> {
  return api.post("/platform/organizations", body);
}

export async function patchPlatformOrganization(
  organizationId: string,
  body: { name?: string; slug?: string; workspaceStatus?: WorkspaceStatusDto }
): Promise<{ organization: PlatformOrgRow }> {
  return api.patch(`/platform/organizations/${organizationId}`, body);
}

export async function deletePlatformOrganization(organizationId: string): Promise<void> {
  await api.delete(`/platform/organizations/${organizationId}`);
}

export async function assignOrgPlan(organizationId: string, planId: string | null): Promise<unknown> {
  return api.patch(`/platform/organizations/${organizationId}/plan`, { planId });
}

export type PlatformSubscriptionRow = {
  id: string;
  billingMode: string;
  status: string;
  startedAt: string;
  renewsAt: string | null;
  endedAt: string | null;
  notes: string | null;
  organization: { id: string; name: string; slug: string };
  plan: { id: string; name: string; slug: string };
};

export async function fetchPlatformSubscriptions(): Promise<{ subscriptions: PlatformSubscriptionRow[] }> {
  return api.get("/platform/subscriptions");
}

export async function patchOrgSubscription(
  organizationId: string,
  body: {
    planId?: string;
    billingMode?: "monthly" | "quarterly" | "annual" | "trial" | "custom";
    status?: "active" | "trialing" | "past_due" | "canceled";
    renewsAt?: string | null;
    endedAt?: string | null;
    notes?: string | null;
  }
): Promise<{ subscription: unknown }> {
  return api.patch(`/platform/organizations/${organizationId}/subscription`, body);
}

export type LimitsOverrideDto = {
  maxUsers: number | null;
  maxClientAccounts: number | null;
  maxIntegrations: number | null;
  maxDashboards: number | null;
  maxChildOrganizations: number | null;
  notes?: string | null;
};

export async function fetchOrgLimitsOverride(
  organizationId: string
): Promise<{ override: LimitsOverrideDto | null }> {
  return api.get(`/platform/organizations/${organizationId}/limits-override`);
}

export async function putOrgLimitsOverride(
  organizationId: string,
  body: LimitsOverrideDto
): Promise<{ override: LimitsOverrideDto | null }> {
  return api.put(`/platform/organizations/${organizationId}/limits-override`, body);
}

export async function syncPlatformSubscriptions(): Promise<{ synced: number }> {
  return api.post("/platform/maintenance/sync-subscriptions", {} as Record<string, never>);
}

export type PlatformAuditLogItem = {
  id: string;
  actorUserId: string;
  organizationId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export async function fetchPlatformAuditLogs(params?: {
  limit?: number;
  cursor?: string;
  action?: string;
}): Promise<{ items: PlatformAuditLogItem[]; nextCursor: string | null }> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.cursor) q.set("cursor", params.cursor);
  if (params?.action?.trim()) q.set("action", params.action.trim());
  const qs = q.toString();
  return api.get(`/platform/audit${qs ? `?${qs}` : ""}`);
}
