import { api } from "@/lib/api";
import type { User, OrganizationSummary, MembershipSummary } from "@/stores/auth-store";

export type ImpersonationStartResponse = {
  user: User & { organization: OrganizationSummary };
  memberships: MembershipSummary[];
  managedOrganizations: OrganizationSummary[];
  accessToken: string;
  refreshToken: string;
  impersonation: {
    isImpersonating: true;
    impersonationSessionId: string;
    sourceOrganizationId: string;
    targetOrganizationId: string;
    targetOrganizationName: string;
    assumedRole: string;
    startedAt: string;
  };
};

export type ImpersonationStopResponse = {
  user: User & { organization: OrganizationSummary };
  memberships: MembershipSummary[];
  managedOrganizations: OrganizationSummary[];
  accessToken: string;
  refreshToken: string;
  impersonation: { isImpersonating: false };
};

export type ImpersonationStatus = {
  isImpersonating: boolean;
  actorUserId?: string;
  sourceOrganizationId?: string;
  sourceOrganizationName?: string;
  targetOrganizationId?: string;
  targetOrganizationName?: string;
  assumedRole?: string;
  startedAt?: string;
  impersonationSessionId?: string;
};

export async function startImpersonation(
  targetOrganizationId: string,
  reason?: string
): Promise<ImpersonationStartResponse> {
  return api.post<ImpersonationStartResponse>("/impersonation/start", {
    targetOrganizationId,
    reason,
  });
}

export async function stopImpersonation(): Promise<ImpersonationStopResponse> {
  return api.post<ImpersonationStopResponse>("/impersonation/stop", {});
}

export async function getImpersonationStatus(): Promise<ImpersonationStatus> {
  return api.get<ImpersonationStatus>("/impersonation/me");
}
