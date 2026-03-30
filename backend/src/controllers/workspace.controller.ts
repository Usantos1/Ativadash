import type { Request, Response } from "express";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  listLaunches,
  createLaunch,
  updateLaunch,
  deleteLaunch,
  listGoals,
  listOrganizationMembers,
  createWorkspaceDirectMember,
  patchWorkspaceMember,
  resetWorkspaceMemberPassword,
} from "../services/workspace.service.js";
import {
  createClientSchema,
  updateClientSchema,
  createProjectSchema,
  updateProjectSchema,
  createLaunchSchema,
  updateLaunchSchema,
  createInvitationSchema,
  createWorkspaceMemberSchema,
  patchWorkspaceMemberSchema,
  resetWorkspaceMemberPasswordSchema,
} from "../validators/workspace.validator.js";
import {
  createInvitation,
  listPendingInvitations,
  revokeInvitation,
  getPendingInvitationOrganizationId,
} from "../services/invitations.service.js";
import { removeMember } from "../services/members.service.js";
import { assertManagedDescendantOrganization } from "../services/organizations.service.js";

type AuthRequest = Request & { user: JwtPayload };

/** Query `organizationId`: org alvo (filha); padrão = org do JWT. */
async function scopedWorkspaceOrganizationId(req: AuthRequest): Promise<string> {
  const jwtOrg = req.user.organizationId;
  const raw = typeof req.query.organizationId === "string" ? req.query.organizationId.trim() : "";
  const target = raw.length > 0 ? raw : jwtOrg;
  if (target !== jwtOrg) {
    await assertManagedDescendantOrganization(jwtOrg, target);
  }
  return target;
}

function parseDateInput(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Data inválida");
  }
  return d;
}

// —— Clients ——

export async function clientsList(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const list = await listClients(organizationId);
  return res.json(list);
}

export async function clientsCreate(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const parsed = createClientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  try {
    const row = await createClient(organizationId, parsed.data.name);
    return res.status(201).json(row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar cliente";
    if (msg.includes("Limite de clientes")) {
      return res.status(403).json({ message: msg });
    }
    console.error(e);
    return res.status(500).json({ message: "Erro ao criar cliente" });
  }
}

export async function clientsUpdate(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  const parsed = updateClientSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.name) {
    return res.status(400).json({ message: "Nome é obrigatório" });
  }
  const row = await updateClient(organizationId, id, parsed.data.name);
  if (!row) return res.status(404).json({ message: "Cliente não encontrado" });
  return res.json(row);
}

export async function clientsDelete(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  const ok = await deleteClient(organizationId, id);
  if (!ok) return res.status(404).json({ message: "Cliente não encontrado" });
  return res.status(204).send();
}

// —— Projects ——

export async function projectsList(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const clientId = req.query.clientAccountId as string | undefined;
  const list = await listProjects(organizationId, clientId || undefined);
  return res.json(list);
}

export async function projectsCreate(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  const cid = parsed.data.clientAccountId === "" ? null : parsed.data.clientAccountId ?? null;
  try {
    const row = await createProject(organizationId, parsed.data.name, cid);
    return res.status(201).json(row);
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro ao criar projeto" });
  }
}

export async function projectsUpdate(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  const body = parsed.data;
  const data: { name?: string; clientAccountId?: string | null } = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.clientAccountId !== undefined) {
    data.clientAccountId = body.clientAccountId === "" ? null : body.clientAccountId;
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "Nada para atualizar" });
  }
  try {
    const row = await updateProject(organizationId, id, data);
    if (!row) return res.status(404).json({ message: "Projeto não encontrado" });
    return res.json(row);
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro ao atualizar" });
  }
}

export async function projectsDelete(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  const ok = await deleteProject(organizationId, id);
  if (!ok) return res.status(404).json({ message: "Projeto não encontrado" });
  return res.status(204).send();
}

// —— Launches ——

export async function launchesList(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const projectId = req.query.projectId as string | undefined;
  const list = await listLaunches(organizationId, projectId);
  return res.json(list);
}

export async function launchesCreate(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const parsed = createLaunchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  try {
    startDate = parseDateInput(parsed.data.startDate) ?? null;
    endDate = parseDateInput(parsed.data.endDate) ?? null;
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Data inválida" });
  }
  try {
    const row = await createLaunch(
      organizationId,
      parsed.data.projectId,
      parsed.data.name,
      startDate,
      endDate
    );
    return res.status(201).json(row);
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro ao criar lançamento" });
  }
}

export async function launchesUpdate(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  const parsed = updateLaunchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  const body = parsed.data;
  const data: {
    name?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    checklistJson?: string | null;
  } = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.checklistJson !== undefined) data.checklistJson = body.checklistJson;
  try {
    if (body.startDate !== undefined) data.startDate = parseDateInput(body.startDate) ?? null;
    if (body.endDate !== undefined) data.endDate = parseDateInput(body.endDate) ?? null;
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Data inválida" });
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "Nada para atualizar" });
  }
  const row = await updateLaunch(organizationId, id, data);
  if (!row) return res.status(404).json({ message: "Lançamento não encontrado" });
  return res.json(row);
}

export async function launchesDelete(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  const ok = await deleteLaunch(organizationId, id);
  if (!ok) return res.status(404).json({ message: "Lançamento não encontrado" });
  return res.status(204).send();
}

export async function goalsList(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const list = await listGoals(organizationId);
  return res.json(list);
}

// —— Members ——

export async function membersList(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  try {
    const orgId = await scopedWorkspaceOrganizationId(authReq);
    const list = await listOrganizationMembers(orgId);
    return res.json(list);
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}

export async function invitationsCreate(req: Request, res: Response) {
  const { organizationId: jwtOrg, userId } = (req as AuthRequest).user;
  const parsed = createInvitationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  const bodyOrg = parsed.data.organizationId?.trim();
  const targetOrg = bodyOrg && bodyOrg.length > 0 ? bodyOrg : jwtOrg;
  try {
    if (targetOrg !== jwtOrg) {
      await assertManagedDescendantOrganization(jwtOrg, targetOrg);
    }
    const out = await createInvitation(targetOrg, userId, parsed.data.email, parsed.data.role ?? "member");
    return res.status(201).json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao convidar";
    const code =
      msg.includes("Limite") || msg.includes("plano") || msg.includes("hierarquia") ? 403 : 400;
    return res.status(code).json({ message: msg });
  }
}

export async function invitationsList(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  const { userId } = authReq.user;
  try {
    const orgId = await scopedWorkspaceOrganizationId(authReq);
    const list = await listPendingInvitations(orgId, userId);
    return res.json(list);
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}

export async function invitationsRevoke(req: Request, res: Response) {
  const { organizationId: jwtOrg, userId } = (req as AuthRequest).user;
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: "ID obrigatório" });
  }
  try {
    const invOrg = await getPendingInvitationOrganizationId(id);
    if (!invOrg) {
      return res.status(404).json({ message: "Convite não encontrado" });
    }
    await assertManagedDescendantOrganization(jwtOrg, invOrg);
    const ok = await revokeInvitation(invOrg, userId, id);
    if (!ok) return res.status(404).json({ message: "Convite não encontrado" });
    return res.status(204).send();
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}

export async function membersCreate(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  const { userId } = authReq.user;
  const parsed = createWorkspaceMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  try {
    const orgId = await scopedWorkspaceOrganizationId(authReq);
    const row = await createWorkspaceDirectMember(orgId, userId, parsed.data);
    return res.status(201).json(row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar membro";
    const code =
      msg.includes("Limite") || msg.includes("plano") || msg.includes("hierarquia") ? 403 : 400;
    return res.status(code).json({ message: msg });
  }
}

export async function membersPatch(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  const { userId } = authReq.user;
  const { userId: targetUserId } = req.params;
  const parsed = patchWorkspaceMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  try {
    const orgId = await scopedWorkspaceOrganizationId(authReq);
    const result = await patchWorkspaceMember(orgId, userId, targetUserId, parsed.data);
    if (!result.ok) {
      return res.status(400).json({ message: result.message });
    }
    return res.json({ success: true });
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}

export async function membersResetPassword(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  const { userId } = authReq.user;
  const { userId: targetUserId } = req.params;
  const parsed = resetWorkspaceMemberPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  try {
    const orgId = await scopedWorkspaceOrganizationId(authReq);
    await resetWorkspaceMemberPassword(orgId, userId, targetUserId, parsed.data.newPassword, {
      forcePasswordChange: parsed.data.forcePasswordChange,
    });
    return res.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status =
      msg.includes("perfil") || msg.includes("não encontrado") || msg.includes("Membro não") ? 400 : 403;
    return res.status(status).json({ message: msg });
  }
}

export async function membersRemove(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  const { userId } = authReq.user;
  const { userId: targetUserId } = req.params;
  try {
    const orgId = await scopedWorkspaceOrganizationId(authReq);
    const result = await removeMember(orgId, userId, targetUserId);
    if (!result.ok) {
      return res.status(400).json({ message: result.message });
    }
    return res.status(204).send();
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}
