import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma.js";

/**
 * Lead público capturado pela LP em ativadash.com.
 *
 * Sem `organizationId`: o solicitante ainda não é um tenant. Apenas o staff Ativa Dash
 * (`platformAdmin`, ver utils/platform-admin.ts) lista, qualifica e arquiva.
 */

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST";
export type LeadProfile = "AGENCY" | "CLIENT" | "FREELANCER" | "UNKNOWN";
export type LeadAdsBudget =
  | "UNDER_5K"
  | "FROM_5K_TO_25K"
  | "FROM_25K_TO_100K"
  | "OVER_100K"
  | "UNKNOWN";

export type CreateLeadInput = {
  fullName: string;
  email: string;
  whatsapp: string;
  companyName?: string | null;
  websiteUrl?: string | null;
  profile?: LeadProfile;
  monthlyAdsBudget?: LeadAdsBudget;
  monthlyRevenueBrl?: number | null;
  managedAccountsCount?: number | null;
  teamSize?: number | null;
  primaryChannel?: string | null;
  goal?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  referrer?: string | null;
  pageUrl?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type UpdateLeadInput = {
  status?: LeadStatus;
  assignedToUserId?: string | null;
  notes?: string | null;
  lostReason?: string | null;
};

export type ListLeadsParams = {
  status?: LeadStatus | "ALL";
  search?: string | null;
  assignedToUserId?: string | "UNASSIGNED" | null;
  limit?: number;
  offset?: number;
};

const MAX_LIMIT = 200;

/** Normaliza WhatsApp para apenas dígitos (com DDI quando possível). */
export function normalizeWhatsapp(value: string): string {
  const digits = value.replace(/\D+/g, "");
  // Se vier com 11 ou 10 dígitos (Brasil sem DDI), prefixa 55
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Cria lead a partir do formulário público — sanitiza valores e aplica defaults. */
export async function createLead(input: CreateLeadInput) {
  const data: Prisma.LeadCreateInput = {
    fullName: input.fullName.trim(),
    email: normalizeEmail(input.email),
    whatsapp: normalizeWhatsapp(input.whatsapp),
    companyName: input.companyName?.trim() || null,
    websiteUrl: input.websiteUrl?.trim() || null,
    profile: input.profile ?? "UNKNOWN",
    monthlyAdsBudget: input.monthlyAdsBudget ?? "UNKNOWN",
    monthlyRevenueBrl:
      input.monthlyRevenueBrl != null && Number.isFinite(input.monthlyRevenueBrl)
        ? new Prisma.Decimal(input.monthlyRevenueBrl)
        : null,
    managedAccountsCount: input.managedAccountsCount ?? null,
    teamSize: input.teamSize ?? null,
    primaryChannel: input.primaryChannel?.trim() || null,
    goal: input.goal?.trim() || null,
    utmSource: input.utmSource?.trim() || null,
    utmMedium: input.utmMedium?.trim() || null,
    utmCampaign: input.utmCampaign?.trim() || null,
    utmTerm: input.utmTerm?.trim() || null,
    utmContent: input.utmContent?.trim() || null,
    referrer: input.referrer?.trim() || null,
    pageUrl: input.pageUrl?.trim() || null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  };

  return prisma.lead.create({ data });
}

export async function listLeads(params: ListLeadsParams = {}) {
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? 50));
  const offset = Math.max(0, params.offset ?? 0);

  const where: Prisma.LeadWhereInput = {};
  if (params.status && params.status !== "ALL") where.status = params.status;
  if (params.assignedToUserId === "UNASSIGNED") {
    where.assignedToUserId = null;
  } else if (params.assignedToUserId) {
    where.assignedToUserId = params.assignedToUserId;
  }
  if (params.search) {
    const q = params.search.trim();
    if (q.length > 0) {
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { whatsapp: { contains: q.replace(/\D+/g, "") } },
        { companyName: { contains: q, mode: "insensitive" } },
        { goal: { contains: q, mode: "insensitive" } },
      ];
    }
  }

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        assignedToUser: { select: { id: true, name: true, email: true } },
      },
      take: limit,
      skip: offset,
    }),
    prisma.lead.count({ where }),
  ]);

  return { items, total, limit, offset };
}

export async function getLead(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      assignedToUser: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function updateLead(id: string, input: UpdateLeadInput) {
  const data: Prisma.LeadUpdateInput = {};

  if (input.status !== undefined) {
    data.status = input.status;
    const now = new Date();
    if (input.status === "CONTACTED") data.contactedAt = now;
    if (input.status === "QUALIFIED") data.qualifiedAt = now;
    if (input.status === "WON") data.wonAt = now;
    if (input.status === "LOST") data.lostAt = now;
  }
  if (input.assignedToUserId !== undefined) {
    data.assignedToUser =
      input.assignedToUserId === null
        ? { disconnect: true }
        : { connect: { id: input.assignedToUserId } };
  }
  if (input.notes !== undefined) data.notes = input.notes ?? null;
  if (input.lostReason !== undefined) data.lostReason = input.lostReason ?? null;

  return prisma.lead.update({
    where: { id },
    data,
    include: {
      assignedToUser: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function deleteLead(id: string) {
  await prisma.lead.delete({ where: { id } });
}

/** Indicadores rápidos para o painel — totais por status. */
export async function leadsStats() {
  const grouped = await prisma.lead.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const out: Record<LeadStatus | "TOTAL", number> = {
    NEW: 0,
    CONTACTED: 0,
    QUALIFIED: 0,
    WON: 0,
    LOST: 0,
    TOTAL: 0,
  };
  for (const g of grouped) {
    out[g.status as LeadStatus] = g._count._all;
    out.TOTAL += g._count._all;
  }
  return out;
}
