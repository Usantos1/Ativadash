import type { Request, Response } from "express";
import type { ZodError } from "zod";
import {
  resellerCreateChild,
  resellerCreateInvitation,
  resellerCreatePlan,
  resellerCreateUserWithMembership,
  resellerDeletePlan,
  resellerDuplicatePlan,
  resellerGetChildDetail,
  resellerGetOperationalHealth,
  resellerGetOverview,
  resellerListActivePlans,
  resellerListAllPlans,
  resellerListAuditLogs,
  resellerListEcosystemOrganizations,
  resellerListEcosystemUsers,
  resellerLogEnterChild,
  resellerMoveMembership,
  resellerPatchChildGovernance,
  resellerDetachChildAsStandalone,
  resellerSoftDeleteChild,
  resellerPatchUser,
  resellerRemoveMembership,
  resellerResetUserPassword,
  resellerSetMembershipRole,
  resellerUpdatePlan,
} from "../services/reseller.service.js";
import {
  resellerAuditQuerySchema,
  resellerCreateChildSchema,
  resellerCreateUserSchema,
  resellerEcosystemUsersQuerySchema,
  resellerEnterChildSchema,
  resellerGovernancePatchSchema,
  resellerInvitationSchema,
  resellerMembershipRoleSchema,
  resellerMoveMembershipSchema,
  resellerPasswordResetSchema,
  resellerPlanCreateSchema,
  resellerPlanDuplicateSchema,
  resellerPlanUpdateSchema,
  resellerRemoveMemberSchema,
  resellerUserPatchSchema,
} from "../validators/reseller.validator.js";

type AuthRequest = Request & { user: { userId: string; organizationId: string } };

function firstErrorMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Dados inválidos";
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

export async function resellerDeleteChildHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { childId } = req.params;
  if (!childId) {
    return res.status(400).json({ message: "ID da empresa obrigatório" });
  }
  try {
    await resellerSoftDeleteChild(user.organizationId, user.userId, childId);
    return res.status(204).send();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status =
      msg.includes("fora") || msg.includes("matriz") || msg.includes("permissão") ? 403 : 400;
    return res.status(status).json({ message: msg });
  }
}

export async function resellerDetachChildHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { childId } = req.params;
  if (!childId) {
    return res.status(400).json({ message: "ID da empresa obrigatório" });
  }
  try {
    const organization = await resellerDetachChildAsStandalone(user.organizationId, user.userId, childId);
    return res.json({ organization });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status =
      msg.includes("fora") || msg.includes("matriz") || msg.includes("permissão") ? 403 : 400;
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
      parsed.data.newPassword,
      { forcePasswordChange: parsed.data.forcePasswordChange }
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
    const logs = await resellerListAuditLogs(user.organizationId, user.userId, {
      limit: parsed.data.limit,
      action: parsed.data.action,
      entityType: parsed.data.entityType,
      actorUserId: parsed.data.actorUserId,
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    });
    return res.json({ logs });
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}

export async function resellerPlansCatalog(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  try {
    const plans = await resellerListAllPlans(user.organizationId, user.userId);
    return res.json({ plans });
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}

export async function resellerPlansCreateHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const parsed = resellerPlanCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    const plan = await resellerCreatePlan(user.organizationId, user.userId, {
      name: parsed.data.name,
      slug: parsed.data.slug,
      maxIntegrations: parsed.data.maxIntegrations,
      maxDashboards: parsed.data.maxDashboards,
      maxUsers: parsed.data.maxUsers ?? null,
      maxClientAccounts: parsed.data.maxClientAccounts ?? null,
      maxChildOrganizations: parsed.data.maxChildOrganizations ?? null,
      descriptionInternal: parsed.data.descriptionInternal ?? null,
      active: parsed.data.active,
      planType: parsed.data.planType,
      features: parsed.data.features ?? {},
    });
    return res.status(201).json({ plan });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}

export async function resellerPlansUpdateHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { planId } = req.params;
  if (!planId) return res.status(400).json({ message: "ID obrigatório" });
  const parsed = resellerPlanUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    const plan = await resellerUpdatePlan(user.organizationId, user.userId, planId, {
      ...parsed.data,
      features: parsed.data.features !== undefined ? parsed.data.features ?? {} : undefined,
    });
    return res.json({ plan });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}

export async function resellerPlansDeleteHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { planId } = req.params;
  if (!planId) return res.status(400).json({ message: "ID obrigatório" });
  try {
    await resellerDeletePlan(user.organizationId, user.userId, planId);
    return res.status(204).send();
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}

export async function resellerPlansDuplicateHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const parsed = resellerPlanDuplicateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    const plan = await resellerDuplicatePlan(
      user.organizationId,
      user.userId,
      parsed.data.sourcePlanId,
      parsed.data.newSlug,
      parsed.data.newName
    );
    return res.status(201).json({ plan });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}

export async function resellerEcosystemOrganizations(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  try {
    const organizations = await resellerListEcosystemOrganizations(user.organizationId, user.userId);
    return res.json({ organizations });
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
}

export async function resellerChildDetailHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { childId } = req.params;
  if (!childId) return res.status(400).json({ message: "ID obrigatório" });
  try {
    const detail = await resellerGetChildDetail(user.organizationId, user.userId, childId);
    return res.json(detail);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status = msg.includes("fora") || msg.includes("matriz") ? 403 : 400;
    return res.status(status).json({ message: msg });
  }
}

export async function resellerCreateUserHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const parsed = resellerCreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    const u = await resellerCreateUserWithMembership(user.organizationId, user.userId, parsed.data);
    return res.status(201).json({ user: u });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}

export async function resellerCreateInvitationHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const parsed = resellerInvitationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: firstErrorMessage(parsed.error) });
  }
  try {
    const out = await resellerCreateInvitation(
      user.organizationId,
      user.userId,
      parsed.data.organizationId,
      parsed.data.email,
      parsed.data.role
    );
    return res.status(201).json(out);
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}
