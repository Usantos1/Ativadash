import { api } from "./api";
import type { OrganizationSummary, User, MembershipSummary } from "@/stores/auth-store";

export type OrganizationContext = {
  id: string;
  name: string;
  slug: string;
  parentOrganization: OrganizationSummary | null;
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
  accessToken: string;
  refreshToken: string;
};

export async function switchWorkspaceOrganization(
  organizationId: string
): Promise<SwitchOrganizationResponse> {
  return api.post<SwitchOrganizationResponse>("/auth/switch-organization", { organizationId });
}
