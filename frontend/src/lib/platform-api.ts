import { api } from "./api";

export type PlanRow = {
  id: string;
  name: string;
  slug: string;
  maxIntegrations: number;
  maxDashboards: number;
  maxUsers: number | null;
  maxClientAccounts: number | null;
  maxChildOrganizations: number | null;
};

export async function fetchPlatformPlans(): Promise<{ plans: PlanRow[] }> {
  return api.get("/platform/plans");
}

export async function createPlatformPlan(body: Omit<PlanRow, "id">): Promise<{ plan: PlanRow }> {
  return api.post("/platform/plans", body);
}

export async function updatePlatformPlan(
  id: string,
  body: Partial<Omit<PlanRow, "id">>
): Promise<{ plan: PlanRow }> {
  return api.patch(`/platform/plans/${id}`, body);
}

export async function deletePlatformPlan(id: string): Promise<void> {
  await api.delete(`/platform/plans/${id}`);
}

export type PlatformOrgRow = {
  id: string;
  name: string;
  slug: string;
  inheritPlanFromParent: boolean;
  parentOrganizationId: string | null;
  planId: string | null;
  plan: { id: string; name: string; slug: string } | null;
  createdAt: string;
};

export async function fetchPlatformOrganizations(): Promise<{ organizations: PlatformOrgRow[] }> {
  return api.get("/platform/organizations");
}

export async function assignOrgPlan(organizationId: string, planId: string | null): Promise<unknown> {
  return api.patch(`/platform/organizations/${organizationId}/plan`, { planId });
}
