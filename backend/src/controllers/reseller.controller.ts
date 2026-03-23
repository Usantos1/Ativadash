import type { Request, Response } from "express";
import {
  resellerCreateChild,
  resellerGetOperationalHealth,
  resellerGetOverview,
  resellerListActivePlans,
  resellerListAuditLogs,
  resellerListEcosystemUsers,
  resellerLogEnterChild,
  resellerMoveMembership,
  resellerPatchChildGovernance,
  resellerPatchUser,
  resellerRemoveMembership,
  resellerResetUserPassword,
  resellerSetMembershipRole,
} from "../services/reseller.service.js";
import {
  resellerAuditQuerySchema,
  resellerCreateChildSchema,
  resellerEcosystemUsersQuerySchema,
  resellerEnterChildSchema,
  resellerGovernancePatchSchema,
  resellerMembershipRoleSchema,
  resellerMoveMembershipSchema,
  resellerPasswordResetSchema,
  resellerRemoveMemberSchema,
  resellerUserPatchSchema,
} from "../validators/reseller.validator.js";

type AuthRequest = Request & { user: { userId: string; organizationId: string } };

function firstErrorMessage(err: { errors: { message?: string }[] }): string {
  return err.errors[0]?.message ?? "Dados inválidos";
}

export async function resellerOverview(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  try {
    const data = await resellerGetOverview(user.organizationId, user.userId);
    return res.json(data);
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}

export async function resellerOperationalHealth(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  try {
    const data = await resellerGetOperationalHealth(user.organizationId, user.userId);
    return res.json(data);
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}

export async function resellerPlans(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  try {
    const plans = await resellerListActivePlans(user.organizationId, user.userId);
    return res.json({ plans });
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}

export async function resellerCreateChildHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const parsed = resellerCreateChildSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    const organization = await resellerCreateChild(user.organizationId, user.userId, parsed.data);
    return res.status(201).json({ organization });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sem permissão";
    return res.status(403).json({ message: msg });
  }
}

export async function resellerPatchGovernanceHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { childId } = req.params;
  if (!childId) {
    return res.status(400).json({ message: "ID da empresa obrigatório" });
  }
  const parsed = resellerGovernancePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    const organization = await resellerPatchChildGovernance(
      user.organizationId,
      user.userId,
      childId,
      parsed.data
    );
    return res.json({ organization });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sem permissão";
    const status = msg.includes("não encontrad") ? 404 : 403;
    return res.status(status).json({ message: msg });
  }
}

export async function resellerEcosystemUsers(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const parsed = resellerEcosystemUsersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    const users = await resellerListEcosystemUsers(user.organizationId, user.userId, parsed.data);
    return res.json({ users });
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}

export async function resellerPatchUserHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { userId: targetUserId } = req.params;
  if (!targetUserId) {
    return res.status(400).json({ message: "ID do usuário obrigatório" });
  }
  const parsed = resellerUserPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    const u = await resellerPatchUser(user.organizationId, user.userId, targetUserId, parsed.data);
    return res.json({ user: u });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sem permissão";
    const status = msg.includes("não encontrad") ? 404 : 400;
    return res.status(status).json({ message: msg });
  }
}

export async function resellerResetPasswordHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { userId: targetUserId } = req.params;
  if (!targetUserId) {
    return res.status(400).json({ message: "ID do usuário obrigatório" });
  }
  const parsed = resellerPasswordResetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    const result = await resellerResetUserPassword(
      user.organizationId,
      user.userId,
      targetUserId,
      parsed.data.newPassword
    );
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}

export async function resellerMembershipRoleHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const parsed = resellerMembershipRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    await resellerSetMembershipRole(
      user.organizationId,
      user.userId,
      parsed.data.organizationId,
      parsed.data.targetUserId,
      parsed.data.role
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}

export async function resellerRemoveMemberHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const parsed = resellerRemoveMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    await resellerRemoveMembership(
      user.organizationId,
      user.userId,
      parsed.data.organizationId,
      parsed.data.targetUserId
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}

export async function resellerMoveMembershipHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const parsed = resellerMoveMembershipSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    await resellerMoveMembership(
      user.organizationId,
      user.userId,
      parsed.data.targetUserId,
      parsed.data.fromOrganizationId,
      parsed.data.toOrganizationId
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}

export async function resellerEnterChildHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const parsed = resellerEnterChildSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    await resellerLogEnterChild(user.organizationId, user.userId, parsed.data.organizationId);
    return res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status = msg.includes("não encontrad") ? 404 : 403;
    return res.status(status).json({ message: msg });
  }
}

export async function resellerAuditHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const parsed = resellerAuditQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    const logs = await resellerListAuditLogs(user.organizationId, user.userId, parsed.data.limit);
    return res.json({ logs });
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}
