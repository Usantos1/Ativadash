import type { Request, Response } from "express";
import { z } from "zod";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import {
  listCheckoutEvents,
  getCheckoutRevenueSummary,
  getCheckoutRevenueByCampaign,
  listCheckoutProductMappings,
  upsertCheckoutProductMapping,
  deleteCheckoutProductMapping,
} from "../services/checkout-revenue.service.js";
import { resolveEffectivePlan, resolveBillingOrganizationId } from "../services/plan-limits.service.js";
import { mergePlanFeaturesWithOverrides } from "../utils/plan-features.js";
import { prisma } from "../utils/prisma.js";

type AuthRequest = Request & { user: JwtPayload };

async function assertCheckoutEnabled(organizationId: string): Promise<void> {
  const { plan } = await resolveEffectivePlan(organizationId);
  const billingId = await resolveBillingOrganizationId(organizationId);
  const billingOrg = await prisma.organization.findFirst({
    where: { id: billingId, deletedAt: null },
    select: { featureOverrides: true },
  });
  const features = mergePlanFeaturesWithOverrides(plan, billingOrg?.featureOverrides);
  if (!features.checkoutIntegrations && !features.webhooks) {
    throw new Error("Integrações de checkout não estão disponíveis no plano atual");
  }
}

export async function checkoutEventsList(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  try {
    const data = await listCheckoutEvents(organizationId, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
      source: req.query.source as string | undefined,
      eventType: req.query.eventType as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    return res.json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao listar eventos de checkout" });
  }
}

export async function checkoutRevenueSummary(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const startDate = (req.query.startDate as string) ?? "";
  const endDate = (req.query.endDate as string) ?? "";
  if (!startDate || !endDate) {
    return res.status(400).json({ message: "startDate e endDate são obrigatórios" });
  }
  try {
    const summary = await getCheckoutRevenueSummary(organizationId, startDate, endDate);
    return res.json(summary);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao calcular resumo de receita" });
  }
}

export async function checkoutRevenueByCampaign(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const startDate = (req.query.startDate as string) ?? "";
  const endDate = (req.query.endDate as string) ?? "";
  if (!startDate || !endDate) {
    return res.status(400).json({ message: "startDate e endDate são obrigatórios" });
  }
  try {
    const items = await getCheckoutRevenueByCampaign(organizationId, startDate, endDate);
    return res.json({ items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao calcular receita por campanha" });
  }
}

export async function checkoutMappingsList(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  try {
    const items = await listCheckoutProductMappings(organizationId);
    return res.json({ items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao listar mapeamentos" });
  }
}

const upsertSchema = z.object({
  source: z.string().min(1).max(50),
  productId: z.string().min(1).max(200),
  productName: z.string().max(200).optional(),
  campaignId: z.string().min(1).max(200),
  channel: z.enum(["facebook", "google"]),
});

export async function checkoutMappingsUpsert(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Dados inválidos" });
  }
  try {
    await assertCheckoutEnabled(organizationId);
    const item = await upsertCheckoutProductMapping(organizationId, parsed.data);
    return res.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar mapeamento";
    if (msg.includes("não estão disponíveis")) {
      return res.status(403).json({ message: msg });
    }
    console.error(e);
    return res.status(500).json({ message: msg });
  }
}

export async function checkoutMappingsDelete(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  try {
    await deleteCheckoutProductMapping(organizationId, id);
    return res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    return res.status(400).json({ message: msg });
  }
}
