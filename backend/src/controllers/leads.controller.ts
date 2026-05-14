import type { Request, Response } from "express";
import { z } from "zod";
import * as leads from "../services/leads.service.js";

/**
 * Endpoint público (POST /api/leads) — chamado pelo formulário da LP em ativadash.com.
 * Endpoints administrativos (GET/PATCH/DELETE) ficam sob /api/platform/leads.
 */

/** Form da LP: campos obrigatórios mínimos + qualificação opcional + UTMs. */
const createLeadSchema = z
  .object({
    fullName: z.string().trim().min(2, "Nome muito curto").max(160),
    email: z.string().trim().toLowerCase().email("E-mail inválido").max(180),
    whatsapp: z
      .string()
      .trim()
      .min(8, "WhatsApp inválido")
      .max(40)
      .refine((v) => v.replace(/\D+/g, "").length >= 8, "WhatsApp inválido"),

    companyName: z.string().trim().max(160).optional().nullable(),
    websiteUrl: z.string().trim().max(300).optional().nullable(),

    profile: z.enum(["AGENCY", "CLIENT", "FREELANCER", "UNKNOWN"]).optional(),
    monthlyAdsBudget: z
      .enum(["UNDER_5K", "FROM_5K_TO_25K", "FROM_25K_TO_100K", "OVER_100K", "UNKNOWN"])
      .optional(),
    monthlyRevenueBrl: z.number().finite().min(0).max(1_000_000_000).optional().nullable(),
    managedAccountsCount: z.number().int().min(0).max(100_000).optional().nullable(),
    teamSize: z.number().int().min(0).max(100_000).optional().nullable(),
    primaryChannel: z.string().trim().max(40).optional().nullable(),
    goal: z.string().trim().max(2000).optional().nullable(),

    utmSource: z.string().trim().max(120).optional().nullable(),
    utmMedium: z.string().trim().max(120).optional().nullable(),
    utmCampaign: z.string().trim().max(160).optional().nullable(),
    utmTerm: z.string().trim().max(160).optional().nullable(),
    utmContent: z.string().trim().max(160).optional().nullable(),
    referrer: z.string().trim().max(500).optional().nullable(),
    pageUrl: z.string().trim().max(500).optional().nullable(),

    /** Honeypot anti-bot. Se vier preenchido, simulamos sucesso e descartamos. */
    company_website: z.string().optional(),
  })
  .strict();

const updateLeadSchema = z
  .object({
    status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]).optional(),
    assignedToUserId: z.string().min(1).nullable().optional(),
    notes: z.string().max(8000).nullable().optional(),
    lostReason: z.string().max(2000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Envie ao menos um campo" });

const listLeadsSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST", "ALL"]).optional(),
  search: z.string().max(160).optional(),
  assignedToUserId: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function createLeadPublic(req: Request, res: Response) {
  const parsed = createLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Dados inválidos",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { company_website: honeypot, ...data } = parsed.data;

  // Honeypot: bot preencheu — devolve sucesso silencioso para não revelar detecção.
  if (honeypot && honeypot.trim().length > 0) {
    return res.status(202).json({ ok: true });
  }

  const ipAddress =
    (req.headers["cf-connecting-ip"] as string | undefined) ||
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.ip ||
    null;
  const userAgent = req.get("user-agent") ?? null;

  try {
    const lead = await leads.createLead({
      ...data,
      ipAddress,
      userAgent,
    });
    return res.status(201).json({ ok: true, leadId: lead.id });
  } catch (e) {
    console.error("[leads.createLeadPublic]", e);
    return res.status(500).json({ message: "Não foi possível registrar agora. Tente novamente." });
  }
}

export async function listLeadsAdmin(req: Request, res: Response) {
  const parsed = listLeadsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Filtros inválidos" });
  }
  const { status, search, assignedToUserId, limit, offset } = parsed.data;

  const result = await leads.listLeads({
    status,
    search: search ?? null,
    assignedToUserId:
      assignedToUserId === "UNASSIGNED" ? "UNASSIGNED" : assignedToUserId ?? null,
    limit,
    offset,
  });
  const stats = await leads.leadsStats();
  return res.json({ ...result, stats });
}

export async function getLeadAdmin(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  if (!id) return res.status(400).json({ message: "ID ausente" });
  const lead = await leads.getLead(id);
  if (!lead) return res.status(404).json({ message: "Lead não encontrado" });
  return res.json({ lead });
}

export async function updateLeadAdmin(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  if (!id) return res.status(400).json({ message: "ID ausente" });
  const parsed = updateLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Dados inválidos",
      errors: parsed.error.flatten().fieldErrors,
    });
  }
  try {
    const lead = await leads.updateLead(id, parsed.data);
    return res.json({ lead });
  } catch (e) {
    console.error("[leads.updateLeadAdmin]", e);
    return res.status(500).json({ message: "Erro ao atualizar lead" });
  }
}

export async function deleteLeadAdmin(req: Request, res: Response) {
  const id = String(req.params.id ?? "");
  if (!id) return res.status(400).json({ message: "ID ausente" });
  try {
    await leads.deleteLead(id);
    return res.status(204).end();
  } catch (e) {
    console.error("[leads.deleteLeadAdmin]", e);
    return res.status(500).json({ message: "Erro ao remover lead" });
  }
}
