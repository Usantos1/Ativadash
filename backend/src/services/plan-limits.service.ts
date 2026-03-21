import { prisma } from "../utils/prisma.js";
import type { Plan } from "@prisma/client";

/** Limites quando a org nao tem plano (fallback tipo Starter). */
const FALLBACK_LIMITS = {
  maxUsers: 3,
  maxIntegrations: 3,
  maxDashboards: 10,
  maxClientAccounts: 15,
  maxChildOrganizations: 0,
} as const;

export type EffectivePlanLimits = {
  maxUsers: number | null;
  maxIntegrations: number;
  maxDashboards: number;
  maxClientAccounts: number | null;
  maxChildOrganizations: number | null;
};

export type PlanUsageDto = {
  directMembers: number;
  integrations: number;
  dashboards: number;
  clientAccounts: number;
  childOrganizations: number;
};

export type OrganizationPlanContextDto = {
  plan: { id: string; name: string; slug: string } | null;
  limits: EffectivePlanLimits;
  usage: PlanUsageDto;
};

function effectiveLimits(plan: Plan | null): EffectivePlanLimits {
  if (!plan) {
    return {
      maxUsers: FALLBACK_LIMITS.maxUsers,
      maxIntegrations: FALLBACK_LIMITS.maxIntegrations,
      maxDashboards: FALLBACK_LIMITS.maxDashboards,
      maxClientAccounts: FALLBACK_LIMITS.maxClientAccounts,
      maxChildOrganizations: FALLBACK_LIMITS.maxChildOrganizations,
    };
  }
  return {
    maxUsers: plan.maxUsers,
    maxIntegrations: plan.maxIntegrations,
    maxDashboards: plan.maxDashboards,
    maxClientAccounts: plan.maxClientAccounts,
    maxChildOrganizations: plan.maxChildOrganizations,
  };
}

async function countUsage(organizationId: string): Promise<PlanUsageDto> {
  const [
    directMembers,
    integrations,
    dashboards,
    clientAccounts,
    childOrganizations,
  ] = await Promise.all([
    prisma.membership.count({
      where: {
        organizationId,
        user: { deletedAt: null },
      },
    }),
    prisma.integration.count({ where: { organizationId } }),
    prisma.dashboard.count({
      where: { organizationId, deletedAt: null },
    }),
    prisma.clientAccount.count({
      where: { organizationId, deletedAt: null },
    }),
    prisma.organization.count({
      where: { parentOrganizationId: organizationId, deletedAt: null },
    }),
  ]);

  return {
    directMembers,
    integrations,
    dashboards,
    clientAccounts,
    childOrganizations,
  };
}

export async function getOrganizationPlanContext(organizationId: string): Promise<OrganizationPlanContextDto> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    include: { plan: true },
  });
  if (!org) {
    throw new Error("Empresa não encontrada");
  }
  const limits = effectiveLimits(org.plan);
  const usage = await countUsage(organizationId);
  return {
    plan: org.plan
      ? { id: org.plan.id, name: org.plan.name, slug: org.plan.slug }
      : null,
    limits,
    usage,
  };
}

export async function assertCanAddClientAccount(organizationId: string): Promise<void> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    include: { plan: true },
  });
  if (!org) throw new Error("Empresa não encontrada");
  const limits = effectiveLimits(org.plan);
  if (limits.maxClientAccounts == null) return;
  const n = await prisma.clientAccount.count({
    where: { organizationId, deletedAt: null },
  });
  if (n >= limits.maxClientAccounts) {
    throw new Error(
      `Limite de clientes do plano atingido (${limits.maxClientAccounts}). Atualize o plano ou remova clientes.`
    );
  }
}

export async function assertCanAddChildOrganization(parentOrganizationId: string): Promise<void> {
  const org = await prisma.organization.findFirst({
    where: { id: parentOrganizationId, deletedAt: null },
    include: { plan: true },
  });
  if (!org) throw new Error("Empresa não encontrada");
  const limits = effectiveLimits(org.plan);
  if (limits.maxChildOrganizations == null) return;
  if (limits.maxChildOrganizations <= 0) {
    throw new Error(
      "Seu plano não inclui empresas vinculadas (revenda). Fale com vendas para liberar multi-empresa."
    );
  }
  const n = await prisma.organization.count({
    where: { parentOrganizationId, deletedAt: null },
  });
  if (n >= limits.maxChildOrganizations) {
    throw new Error(
      `Limite de empresas vinculadas atingido (${limits.maxChildOrganizations}). Atualize o plano.`
    );
  }
}

export async function assertCanAddIntegration(organizationId: string): Promise<void> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    include: { plan: true },
  });
  if (!org) throw new Error("Empresa não encontrada");
  const limits = effectiveLimits(org.plan);
  const n = await prisma.integration.count({
    where: { organizationId, status: "connected" },
  });
  if (n >= limits.maxIntegrations) {
    throw new Error(
      `Limite de integrações do plano atingido (${limits.maxIntegrations}). Desvincule uma integração ou atualize o plano.`
    );
  }
}
