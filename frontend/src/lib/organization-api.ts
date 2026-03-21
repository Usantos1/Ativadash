import { api } from "./api";
import type { OrganizationSummary, User, MembershipSummary } from "@/stores/auth-store";

export type PlanLimits = {
  maxUsers: number | null;
  maxIntegrations: number;
  maxDashboards: number;
  maxClientAccounts: number | null;
  maxChildOrganizations: number | null;
};

export type PlanUsage = {
  directMembers: number;
  pendingInvitations?: number;
  integrations: number;
  dashboards: number;
  clientAccounts: number;
  childOrganizations: number;
  projects: number;
  launches: number;
};

export type EnabledFeatures = {
  marketingDashboard: boolean;
  performanceAlerts: boolean;
  multiUser: boolean;
  multiOrganization: boolean;
  integrations: boolean;
  webhooks: boolean;
};

export type SubscriptionView = {
  billingMode: string;
  status: string;
  startedAt: string;
  renewsAt: string | null;
  endedAt: string | null;
  notes: string | null;
  plan: {
    id: string;
    name: string;
    slug: string;
    planType: string;
    active: boolean;
  };
  billingOrganization: { id: string; name: string } | null;
  inherited: boolean;
};

/** Exibe limite numérico ou "Ilimitado" quando null. */
export function formatPlanCap(n: number | null | undefined): string {
  if (n === null || n === undefined) return "Ilimitado";
  return String(n);
}

export type OrganizationContext = {
  id: string;
  name: string;
  slug: string;
  parentOrganization: OrganizationSummary | null;
  plan: { id: string; name: string; slug: string; planType: string; active: boolean } | null;
  planSource?: "own" | "parent";
  limits: PlanLimits;
  limitsHaveOverrides?: boolean;
  usage: PlanUsage;
  subscription: SubscriptionView | null;
  enabledFeatures: EnabledFeatures;
};

export async function fetchOrganizationContext(): Promise<OrganizationContext> {
  return api.get<OrganizationContext>("/organization");
}

export async function patchOrganizationName(name: string): Promise<{ organization: OrganizationSummary }> {
  return api.patch<{ organization: OrganizationSummary }>("/organization", { name });
}

export async function fetchManagedOrganizations(): Promise<OrganizationSummary[]> {
  const res = await api.get<{ organizations: OrganizationSummary[] }>("/organization/children");
  return res.organizations;
}

export async function createManagedOrganization(
  name: string,
  options?: { inheritPlanFromParent?: boolean; planId?: string | null }
): Promise<{ organization: OrganizationSummary & { inheritPlanFromParent?: boolean; planId?: string | null } }> {
  return api.post("/organization/children", {
    name,
    ...(options?.inheritPlanFromParent !== undefined
      ? { inheritPlanFromParent: options.inheritPlanFromParent }
      : {}),
    ...(options?.planId !== undefined ? { planId: options.planId } : {}),
  });
}

export async function fetchChildrenPortfolio(): Promise<{
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    inheritPlanFromParent: boolean;
    connectedIntegrations: number;
    lastIntegrationSyncAt: string | null;
    createdAt: string;
  }>;
}> {
  return api.get("/organization/children/portfolio");
}

export async function patchOrganizationPlanSettings(body: {
  inheritPlanFromParent?: boolean;
  planId?: string | null;
}): Promise<{ organization: { id: string; inheritPlanFromParent: boolean; planId: string | null } }> {
  return api.patch("/organization/plan-settings", body);
}

export type SwitchOrganizationResponse = {
  user: User & { organization: OrganizationSummary };
  memberships: MembershipSummary[];
  managedOrganizations: OrganizationSummary[];
  accessToken: string;
  refreshToken: string;
};

export async function switchWorkspaceOrganization(
  organizationId: string
): Promise<SwitchOrganizationResponse> {
  return api.post<SwitchOrganizationResponse>("/auth/switch-organization", { organizationId });
}
