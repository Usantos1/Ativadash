import type { Request, Response } from "express";
import { z } from "zod";
import * as platform from "../services/platform.service.js";

const createPlanSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  maxIntegrations: z.number().int().min(0),
  maxDashboards: z.number().int().min(0),
  maxUsers: z.number().int().min(0).nullable().optional(),
  maxClientAccounts: z.number().int().min(0).nullable().optional(),
  maxChildOrganizations: z.number().int().min(0).nullable().optional(),
});

const updatePlanSchema = createPlanSchema.partial();

const assignOrgPlanSchema = z.object({
  planId: z.string().min(1).nullable(),
});

export async function plansList(_req: Request, res: Response) {
  const list = await platform.listPlans();
  return res.json({ plans: list });
}

export async function plansCreate(req: Request, res: Response) {
  const parsed = createPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  try {
    const row = await platform.createPlan({
      ...parsed.data,
      maxUsers: parsed.data.maxUsers ?? null,
      maxClientAccounts: parsed.data.maxClientAccounts ?? null,
      maxChildOrganizations: parsed.data.maxChildOrganizations ?? null,
    });
    return res.status(201).json({ plan: row });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro ao criar plano" });
  }
}

export async function plansUpdate(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = updatePlanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  try {
    const row = await platform.updatePlan(id, parsed.data);
    return res.json({ plan: row });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro ao atualizar" });
  }
}

export async function plansDelete(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await platform.deletePlan(id);
    return res.status(204).send();
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro ao excluir" });
  }
}

export async function organizationsList(_req: Request, res: Response) {
  const organizations = await platform.listAllOrganizations();
  return res.json({ organizations });
}

export async function organizationAssignPlan(req: Request, res: Response) {
  const { organizationId } = req.params;
  const parsed = assignOrgPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos" });
  }
  try {
    const org = await platform.assignOrganizationPlan(organizationId, parsed.data.planId);
    return res.json({ organization: org });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}
