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

export type ProjectRow = {
  id: string;
  organizationId: string;
  name: string;
  clientAccountId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  clientAccount: { id: string; name: string } | null;
};

export type LaunchRow = {
  id: string;
  projectId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  project: { id: string; name: string };
};

export type MemberRow = {
  membershipId: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  joinedAt: string;
  /** direct = membro da org; agency = admin/owner da agência com acesso à empresa cliente */
  source?: "direct" | "agency";
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

export async function fetchProjects(clientAccountId?: string): Promise<ProjectRow[]> {
  const q = clientAccountId ? `?clientAccountId=${encodeURIComponent(clientAccountId)}` : "";
  return api.get<ProjectRow[]>(`/workspace/projects${q}`);
}

export async function createProject(name: string, clientAccountId?: string | null): Promise<ProjectRow> {
  return api.post<ProjectRow>("/workspace/projects", {
    name,
    ...(clientAccountId ? { clientAccountId } : {}),
  });
}

export async function updateProject(
  id: string,
  data: { name?: string; clientAccountId?: string | null }
): Promise<ProjectRow> {
  return api.patch<ProjectRow>(`/workspace/projects/${id}`, data);
}

export async function deleteProject(id: string): Promise<void> {
  return api.delete(`/workspace/projects/${id}`);
}

export async function fetchLaunches(projectId?: string): Promise<LaunchRow[]> {
  const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api.get<LaunchRow[]>(`/workspace/launches${q}`);
}

export async function createLaunch(body: {
  projectId: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<LaunchRow> {
  return api.post<LaunchRow>("/workspace/launches", body);
}

export async function updateLaunch(
  id: string,
  data: { name?: string; startDate?: string | null; endDate?: string | null }
): Promise<LaunchRow> {
  return api.patch<LaunchRow>(`/workspace/launches/${id}`, data);
}

export async function deleteLaunch(id: string): Promise<void> {
  return api.delete(`/workspace/launches/${id}`);
}

export async function fetchMembers(): Promise<MemberRow[]> {
  return api.get<MemberRow[]>("/workspace/members");
}

export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
};

export async function fetchPendingInvitations(): Promise<InvitationRow[]> {
  return api.get<InvitationRow[]>("/workspace/invitations");
}

export async function createInvitation(
  email: string,
  role: "admin" | "member" | "media_manager" | "analyst" = "member"
): Promise<{ invitation: InvitationRow; inviteLink: string }> {
  return api.post("/workspace/invitations", { email, role });
}

export async function revokeInvitation(id: string): Promise<void> {
  return api.delete(`/workspace/invitations/${id}`);
}

export async function patchMemberRole(userId: string, role: string): Promise<void> {
  await api.patch(`/workspace/members/${userId}`, { role });
}

export async function removeMember(userId: string): Promise<void> {
  await api.delete(`/workspace/members/${userId}`);
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
