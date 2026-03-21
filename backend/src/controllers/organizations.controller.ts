import type { Request, Response } from "express";
import {
  getOrganizationContext,
  updateOrganizationName,
  listChildOrganizations,
  createChildOrganization,
} from "../services/organizations.service.js";
import {
  patchOrganizationSchema,
  createChildOrganizationSchema,
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
    const org = await createChildOrganization(user.organizationId, user.userId, parsed.data.name);
    return res.status(201).json({ organization: org });
  } catch (e) {
    return res.status(403).json({
      message: e instanceof Error ? e.message : "Sem permissão",
    });
  }
}
