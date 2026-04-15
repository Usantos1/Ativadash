import { api } from "./api";
import type { AuthMeResponse } from "@/stores/auth-store";

export type ClientAccount = {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type MemberRow = {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  jobTitle?: string | null;
  whatsappNumber?: string | null;
  joinedAt: string;
  /** Último login bem-sucedido (quando disponível) */
  lastLoginAt?: string | null;
  /** Conta suspensa (login bloqueado) */
  suspended?: boolean;
  suspendedAt?: string | null;
  /** direct = membro da org; agency = herdado da agência; agency_excluded = bloqueado neste cliente */
  source?: "direct" | "agency" | "agency_excluded";
  receiveWhatsappAlerts?: boolean;
  alertStartHour?: string | null;
  alertEndHour?: string | null;
};

export async function fetchClients(): Promise<ClientAccount[]> {
  return api.get<ClientAccount[]>("/workspace/clients");
}

export async function createClient(name: string): Promise<ClientAccount> {
  return api.post<ClientAccount>("/workspace/clients", { name });
}

export async function updateClient(id: string, name: string): Promise<ClientAccount> {
  return api.patch<ClientAccount>(`/workspace/clients/${id}`, { name });
}

export async function deleteClient(id: string): Promise<void> {
  return api.delete(`/workspace/clients/${id}`);
}

export async function fetchMembers(organizationId?: string): Promise<MemberRow[]> {
  const q = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  return api.get<MemberRow[]>(`/workspace/members${q}`);
}

export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  jobTitle?: string | null;
  expiresAt: string;
  createdAt: string;
};

export async function fetchPendingInvitations(organizationId?: string): Promise<InvitationRow[]> {
  const q = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  return api.get<InvitationRow[]>(`/workspace/invitations${q}`);
}

export async function createInvitation(opts: {
  email: string;
  organizationId?: string;
  /** Fluxo legado (sem cargo / nível). */
  role?: "admin" | "member" | "media_manager" | "analyst";
  jobTitle?: string;
  accessLevel?: "ADMIN" | "OPERADOR" | "VIEWER";
  whatsappNumber?: string | null;
}): Promise<{ invitation: InvitationRow; inviteLink: string }> {
  return api.post("/workspace/invitations", {
    email: opts.email,
    ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
    ...(opts.role ? { role: opts.role } : {}),
    ...(opts.jobTitle ? { jobTitle: opts.jobTitle } : {}),
    ...(opts.accessLevel ? { accessLevel: opts.accessLevel } : {}),
    ...(opts.whatsappNumber !== undefined && opts.whatsappNumber !== ""
      ? { whatsappNumber: opts.whatsappNumber }
      : {}),
  });
}

export async function revokeInvitation(id: string): Promise<void> {
  return api.delete(`/workspace/invitations/${id}`);
}

export type PatchMemberPayload = {
  role?: string;
  email?: string;
  name?: string;
  suspended?: boolean;
  jobTitle?: string | null;
  accessLevel?: "ADMIN" | "OPERADOR" | "VIEWER";
  whatsappNumber?: string | null | "";
  receiveWhatsappAlerts?: boolean;
  alertStartHour?: string | null | "";
  alertEndHour?: string | null | "";
};

export async function patchMember(
  userId: string,
  data: PatchMemberPayload,
  organizationId?: string
): Promise<void> {
  const q = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  await api.patch(`/workspace/members/${userId}${q}`, data);
}

export async function patchMemberRole(userId: string, role: string, organizationId?: string): Promise<void> {
  await patchMember(userId, { role }, organizationId);
}

export async function createWorkspaceMember(
  body: {
    email: string;
    name: string;
    password: string;
    jobTitle: string;
    accessLevel: "ADMIN" | "OPERADOR" | "VIEWER";
    whatsappNumber?: string | null;
  },
  organizationId?: string
): Promise<MemberRow> {
  const q = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  return api.post<MemberRow>(`/workspace/members${q}`, body);
}

export async function resetMemberPassword(
  userId: string,
  body: { newPassword: string; forcePasswordChange?: boolean },
  organizationId?: string
): Promise<void> {
  const q = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  await api.post(`/workspace/members/${userId}/password${q}`, body);
}

export async function removeMember(userId: string, organizationId?: string): Promise<void> {
  const q = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  await api.delete(`/workspace/members/${userId}${q}`);
}

export type AcceptInviteResponse = AuthMeResponse & {
  accessToken: string;
  refreshToken: string;
};

export async function acceptInviteLoggedIn(token: string): Promise<AcceptInviteResponse> {
  return api.post("/auth/accept-invite", { token });
}

export type GoalRow = {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  targetValue: number;
  period: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchGoals(): Promise<GoalRow[]> {
  return api.get<GoalRow[]>("/workspace/goals");
}

export async function patchProfile(
  name: string
): Promise<{ id: string; email: string; name: string; firstName?: string | null }> {
  return api.patch("/auth/profile", { name });
}

/** Troca de senha com JWT (sem e-mail). */
export async function changeAuthenticatedPassword(body: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  await api.patch("/auth/password", body);
}
