import type { Request, Response } from "express";
import { z } from "zod";
import * as platform from "../services/platform.service.js";

const featuresSchema = z
  .object({
    marketingDashboard: z.boolean().optional(),
    performanceAlerts: z.boolean().optional(),
    multiUser: z.boolean().optional(),
    multiOrganization: z.boolean().optional(),
    integrations: z.boolean().optional(),
    webhooks: z.boolean().optional(),
  })
  .optional();

const createPlanSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  maxIntegrations: z.number().int().min(0),
  maxDashboards: z.number().int().min(0),
  maxUsers: z.number().int().min(0).nullable().optional(),
  maxClientAccounts: z.number().int().min(0).nullable().optional(),
  maxChildOrganizations: z.number().int().min(0).nullable().optional(),
  descriptionInternal: z.string().max(4000).nullable().optional(),
  active: z.boolean().optional(),
  planType: z.string().min(1).max(64).optional(),
  features: featuresSchema,
});

const updatePlanSchema = createPlanSchema.partial();

const assignOrgPlanSchema = z.object({
  planId: z.string().min(1).nullable(),
});

const updateSubscriptionSchema = z.object({
  planId: z.string().min(1).optional(),
  billingMode: z.enum(["monthly", "quarterly", "annual", "trial", "custom"]).optional(),
  status: z.enum(["active", "trialing", "past_due", "canceled"]).optional(),
  renewsAt: z.string().datetime().nullable().optional(),
  endedAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

const limitsOverrideSchema = z.object({
  maxUsers: z.number().int().min(0).nullable(),
  maxClientAccounts: z.number().int().min(0).nullable(),
  maxIntegrations: z.number().int().min(0).nullable(),
  maxDashboards: z.number().int().min(0).nullable(),
  maxChildOrganizations: z.number().int().min(0).nullable(),
  notes: z.string().max(4000).nullable().optional(),
});

const organizationPatchSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/).optional(),
    workspaceStatus: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Envie ao menos um campo" });

/** Empresa raiz na plataforma; slug/plano/proprietário opcionais. */
const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().max(64).optional(),
  planId: z.union([z.string().min(1), z.null()]).optional(),
  ownerEmail: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPassword: z.string().optional(),
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
      descriptionInternal: parsed.data.descriptionInternal ?? null,
      active: parsed.data.active,
      planType: parsed.data.planType,
      features: parsed.data.features ?? {},
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
    const row = await platform.updatePlan(id, {
      ...parsed.data,
      features: parsed.data.features !== undefined ? parsed.data.features ?? {} : undefined,
    });
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

export async function organizationCreate(req: Request, res: Response) {
  const parsed = createOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  const slugRaw = (parsed.data.slug ?? "").trim().toLowerCase();
  if (slugRaw.length > 0 && !/^[a-z0-9-]+$/.test(slugRaw)) {
    return res.status(400).json({ message: "Slug: apenas letras minúsculas, números e hífens" });
  }
  const planId =
    parsed.data.planId === undefined
      ? undefined
      : parsed.data.planId === null
        ? null
        : parsed.data.planId;
  try {
    const organization = await platform.createRootOrganization({
      name: parsed.data.name.trim(),
      slug: slugRaw.length > 0 ? slugRaw : undefined,
      planId,
      ownerEmail: (parsed.data.ownerEmail ?? "").trim() || undefined,
      ownerName: (parsed.data.ownerName ?? "").trim() || undefined,
      ownerPassword: parsed.data.ownerPassword ?? undefined,
    });
    return res.status(201).json({ organization });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro ao criar empresa" });
  }
}

export async function organizationPatch(req: Request, res: Response) {
  const { organizationId } = req.params;
  const parsed = organizationPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  try {
    const organization = await platform.updateOrganizationProfile(organizationId, parsed.data);
    return res.json({ organization });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}

export async function organizationDelete(req: Request, res: Response) {
  const { organizationId } = req.params;
  try {
    await platform.softDeleteOrganization(organizationId);
    return res.status(204).send();
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
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

export async function subscriptionsList(_req: Request, res: Response) {
  const list = await platform.listSubscriptions();
  return res.json({ subscriptions: list });
}

export async function organizationSubscriptionPatch(req: Request, res: Response) {
  const { organizationId } = req.params;
  const parsed = updateSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  try {
    const row = await platform.updateSubscriptionForOrganization(organizationId, {
      planId: parsed.data.planId,
      billingMode: parsed.data.billingMode,
      status: parsed.data.status,
      renewsAt: parsed.data.renewsAt === undefined ? undefined : parsed.data.renewsAt ? new Date(parsed.data.renewsAt) : null,
      endedAt: parsed.data.endedAt === undefined ? undefined : parsed.data.endedAt ? new Date(parsed.data.endedAt) : null,
      notes: parsed.data.notes,
    });
    return res.json({ subscription: row });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}

export async function organizationOverrideGet(req: Request, res: Response) {
  const { organizationId } = req.params;
  try {
    const row = await platform.getLimitsOverride(organizationId);
    return res.json({ override: row });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}

export async function organizationOverridePut(req: Request, res: Response) {
  const { organizationId } = req.params;
  const parsed = limitsOverrideSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  try {
    const row = await platform.putLimitsOverride(organizationId, {
      maxUsers: parsed.data.maxUsers,
      maxClientAccounts: parsed.data.maxClientAccounts,
      maxIntegrations: parsed.data.maxIntegrations,
      maxDashboards: parsed.data.maxDashboards,
      maxChildOrganizations: parsed.data.maxChildOrganizations,
      notes: parsed.data.notes ?? null,
    });
    return res.json({ override: row });
  } catch (e) {
    return res.status(400).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}

export async function maintenanceSyncSubscriptions(_req: Request, res: Response) {
  try {
    const out = await platform.syncAllSubscriptionsFromOrgPlans();
    return res.json(out);
  } catch (e) {
    return res.status(500).json({ message: e instanceof Error ? e.message : "Erro" });
  }
}
