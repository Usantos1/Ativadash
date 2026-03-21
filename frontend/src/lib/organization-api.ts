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
  integrations: number;
  dashboards: number;
  clientAccounts: number;
  childOrganizations: number;
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
  plan: { id: string; name: string; slug: string } | null;
  limits: PlanLimits;
  usage: PlanUsage;
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
  name: string
): Promise<{ organization: OrganizationSummary }> {
  return api.post<{ organization: OrganizationSummary }>("/organization/children", { name });
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
