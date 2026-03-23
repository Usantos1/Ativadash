import type { Request, Response } from "express";
import {
  getOrganizationContext,
  updateOrganizationName,
  listChildOrganizations,
  createChildOrganization,
  listChildOrganizationsPortfolio,
  listChildOrganizationsOperationsDashboard,
  updateChildOrganizationByParent,
  updateOrganizationPlanSettings,
} from "../services/organizations.service.js";
import {
  patchOrganizationSchema,
  createChildOrganizationSchema,
  patchChildOrganizationSchema,
  organizationPlanSettingsSchema,
} from "../validators/organization.validator.js";

type AuthRequest = Request & { user: { userId: string; organizationId: string } };

export async function getCurrentOrganization(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  try {
    const ctx = await getOrganizationContext(user.organizationId, user.userId);
    return res.json(ctx);
  } catch (e) {
    return res.status(403).json({
      message: e instanceof Error ? e.message : "Sem acesso",
    });
  }
}

export async function patchCurrentOrganization(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const parsed = patchOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "Dados inválidos",
    });
  }
  try {
    const org = await updateOrganizationName(user.organizationId, user.userId, parsed.data.name);
    return res.json({ organization: org });
  } catch (e) {
    return res.status(403).json({
      message: e instanceof Error ? e.message : "Sem permissão",
    });
  }
}

export async function listManagedOrganizations(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  try {
    const list = await listChildOrganizations(user.organizationId, user.userId);
    return res.json({ organizations: list });
  } catch (e) {
    return res.status(403).json({
      message: e instanceof Error ? e.message : "Sem permissão",
    });
  }
}

export async function createManagedOrganization(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const parsed = createChildOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "Dados inválidos",
    });
  }
  try {
    const org = await createChildOrganization(user.organizationId, user.userId, parsed.data.name, {
      inheritPlanFromParent: parsed.data.inheritPlanFromParent,
      planId: parsed.data.planId ?? undefined,
      workspaceNote: parsed.data.workspaceNote ?? undefined,
      resellerOrgKind: parsed.data.resellerOrgKind,
    });
    return res.status(201).json({ organization: org });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sem permissão";
    return res.status(403).json({ message: msg });
  }
}

export async function listChildrenPortfolioHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  try {
    const rows = await listChildOrganizationsPortfolio(user.organizationId, user.userId);
    return res.json({ organizations: rows });
  } catch (e) {
    return res.status(403).json({
      message: e instanceof Error ? e.message : "Sem permissão",
    });
  }
}

export async function listChildrenOperationsHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  try {
    const data = await listChildOrganizationsOperationsDashboard(user.organizationId, user.userId);
    return res.json(data);
  } catch (e) {
    return res.status(403).json({
      message: e instanceof Error ? e.message : "Sem permissão",
    });
  }
}

export async function patchChildOrganizationHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const { childId } = req.params;
  if (!childId) {
    return res.status(400).json({ message: "ID do workspace obrigatório" });
  }
  const parsed = patchChildOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "Dados inválidos",
    });
  }
  try {
    const organization = await updateChildOrganizationByParent(
      user.organizationId,
      user.userId,
      childId,
      parsed.data
    );
    return res.json({ organization });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sem permissão";
    const status = msg.includes("não encontrado") ? 404 : 403;
    return res.status(status).json({ message: msg });
  }
}

export async function patchOrganizationPlanSettingsHandler(req: Request, res: Response) {
  const { user } = req as AuthRequest;
  const parsed = organizationPlanSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.errors[0]?.message ?? "Dados inválidos",
    });
  }
  try {
    const org = await updateOrganizationPlanSettings(user.organizationId, user.userId, parsed.data);
    return res.json({ organization: org });
  } catch (e) {
    return res.status(403).json({
      message: e instanceof Error ? e.message : "Sem permissão",
    });
  }
}
