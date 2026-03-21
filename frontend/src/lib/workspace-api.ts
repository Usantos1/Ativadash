import { api } from "./api";

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

export async function patchProfile(name: string): Promise<{ id: string; email: string; name: string }> {
  return api.patch("/auth/profile", { name });
}
