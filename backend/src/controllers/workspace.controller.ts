import type { Request, Response } from "express";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  listGoals,
  listOrganizationMembers,
  createWorkspaceDirectMember,
  patchWorkspaceMember,
  resetWorkspaceMemberPassword,
} from "../services/workspace.service.js";
import {
  createClientSchema,
  updateClientSchema,
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
import { appendAuditLog } from "../services/audit-log.service.js";

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

// —— Clients ——

export async function clientsList(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const list = await listClients(organizationId);
  return res.json(list);
}

export async function clientsCreate(req: Request, res: Response) {
  const { organizationId, userId } = (req as AuthRequest).user;
  const parsed = createClientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  try {
    const row = await createClient(organizationId, parsed.data.name);
    await appendAuditLog({ actorUserId: userId, organizationId, action: "client.created", entityType: "ClientAccount", entityId: row.id, metadata: { name: parsed.data.name } });
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
  const { organizationId, userId } = (req as AuthRequest).user;
  const { id } = req.params;
  const parsed = updateClientSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.name) {
    return res.status(400).json({ message: "Nome é obrigatório" });
  }
  const row = await updateClient(organizationId, id, parsed.data.name);
  if (!row) return res.status(404).json({ message: "Cliente não encontrado" });
  await appendAuditLog({ actorUserId: userId, organizationId, action: "client.updated", entityType: "ClientAccount", entityId: id, metadata: { name: parsed.data.name } });
  return res.json(row);
}

export async function clientsDelete(req: Request, res: Response) {
  const { organizationId, userId } = (req as AuthRequest).user;
  const { id } = req.params;
  const ok = await deleteClient(organizationId, id);
  if (!ok) return res.status(404).json({ message: "Cliente não encontrado" });
  await appendAuditLog({ actorUserId: userId, organizationId, action: "client.deleted", entityType: "ClientAccount", entityId: id });
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
    const out = await createInvitation(targetOrg, userId, parsed.data.email, {
      legacyRole: parsed.data.role,
      accessLevel: parsed.data.accessLevel,
      jobTitle: parsed.data.jobTitle,
      whatsappNumber: parsed.data.whatsappNumber,
    });
    await appendAuditLog({ actorUserId: userId, organizationId: targetOrg, action: "invitation.created", entityType: "Invitation", metadata: { email: parsed.data.email, role: parsed.data.role } });
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
    await appendAuditLog({ actorUserId: userId, organizationId: invOrg, action: "invitation.revoked", entityType: "Invitation", entityId: id });
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
    await appendAuditLog({ actorUserId: userId, organizationId: orgId, action: "member.created", entityType: "Membership", metadata: { email: parsed.data.email, accessLevel: parsed.data.accessLevel } });
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
    await appendAuditLog({ actorUserId: userId, organizationId: orgId, action: "member.updated", entityType: "Membership", entityId: targetUserId, metadata: { keys: Object.keys(parsed.data) } });
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
    await appendAuditLog({ actorUserId: userId, organizationId: orgId, action: "member.password_reset", entityType: "User", entityId: targetUserId });
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
    await appendAuditLog({ actorUserId: userId, organizationId: orgId, action: "member.removed", entityType: "Membership", entityId: targetUserId });
    return res.status(204).send();
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}
