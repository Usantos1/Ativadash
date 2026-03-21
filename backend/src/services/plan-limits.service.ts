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
  pendingInvitations: number;
  integrations: number;
  dashboards: number;
  clientAccounts: number;
  childOrganizations: number;
};

export type OrganizationPlanContextDto = {
  plan: { id: string; name: string; slug: string } | null;
  /** Plano aplicado aos limites (pode ser o da matriz se inheritPlanFromParent) */
  planSource: "own" | "parent";
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

type ResolvedPlan = { plan: Plan | null; planSource: "own" | "parent" };

/** Plano efetivo para limites e exibição (herança da matriz). */
export async function resolveEffectivePlan(organizationId: string): Promise<ResolvedPlan> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    include: { plan: true },
  });
  if (!org) {
    throw new Error("Empresa não encontrada");
  }
  if (org.parentOrganizationId && org.inheritPlanFromParent) {
    const parent = await prisma.organization.findFirst({
      where: { id: org.parentOrganizationId, deletedAt: null },
      include: { plan: true },
    });
    if (parent) {
      return { plan: parent.plan, planSource: "parent" };
    }
  }
  return { plan: org.plan, planSource: "own" };
}

export async function getEffectivePlanLimits(organizationId: string): Promise<EffectivePlanLimits> {
  const { plan } = await resolveEffectivePlan(organizationId);
  return effectiveLimits(plan);
}

async function countUsage(organizationId: string): Promise<PlanUsageDto> {
  const [
    directMembers,
    pendingInvitations,
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
    prisma.invitation.count({
      where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
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
    pendingInvitations,
    integrations,
    dashboards,
    clientAccounts,
    childOrganizations,
  };
}

export async function getOrganizationPlanContext(organizationId: string): Promise<OrganizationPlanContextDto> {
  const { plan, planSource } = await resolveEffectivePlan(organizationId);
  const limits = effectiveLimits(plan);
  const usage = await countUsage(organizationId);
  return {
    plan: plan ? { id: plan.id, name: plan.name, slug: plan.slug } : null,
    planSource,
    limits,
    usage,
  };
}

export async function assertCanAddClientAccount(organizationId: string): Promise<void> {
  const limits = await getEffectivePlanLimits(organizationId);
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
  const limits = await getEffectivePlanLimits(parentOrganizationId);
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
  const limits = await getEffectivePlanLimits(organizationId);
  const n = await prisma.integration.count({
    where: { organizationId, status: "connected" },
  });
  if (n >= limits.maxIntegrations) {
    throw new Error(
      `Limite de integrações do plano atingido (${limits.maxIntegrations}). Desvincule uma integração ou atualize o plano.`
    );
  }
}

export async function assertCanAddDirectMemberOrInvitation(organizationId: string): Promise<void> {
  const limits = await getEffectivePlanLimits(organizationId);
  if (limits.maxUsers == null) return;
  const [direct, pending] = await Promise.all([
    prisma.membership.count({
      where: { organizationId, user: { deletedAt: null } },
    }),
    prisma.invitation.count({
      where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);
  if (direct + pending >= limits.maxUsers) {
    throw new Error(
      `Limite de usuários do plano atingido (${limits.maxUsers}). Revogue convites pendentes ou atualize o plano.`
    );
  }
}
