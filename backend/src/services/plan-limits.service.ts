import { prisma } from "../utils/prisma.js";
import type { Plan, SubscriptionLimitsOverride } from "@prisma/client";
import { isPlatformAdminEmail } from "../utils/platform-admin.js";

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
  projects: number;
  launches: number;
};

export type OrganizationPlanContextDto = {
  plan: { id: string; name: string; slug: string; planType: string; active: boolean } | null;
  /** Plano aplicado aos limites (pode ser o da matriz se inheritPlanFromParent) */
  planSource: "own" | "parent";
  limits: EffectivePlanLimits;
  limitsHaveOverrides: boolean;
  usage: PlanUsageDto;
};

function effectiveLimitsFromPlan(plan: Plan | null): EffectivePlanLimits {
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

function mergeOverride(
  base: EffectivePlanLimits,
  override: SubscriptionLimitsOverride | null
): EffectivePlanLimits {
  if (!override) return base;
  return {
    maxUsers: override.maxUsers ?? base.maxUsers,
    maxIntegrations: override.maxIntegrations ?? base.maxIntegrations,
    maxDashboards: override.maxDashboards ?? base.maxDashboards,
    maxClientAccounts: override.maxClientAccounts ?? base.maxClientAccounts,
    maxChildOrganizations: override.maxChildOrganizations ?? base.maxChildOrganizations,
  };
}

function overrideIsEmpty(o: SubscriptionLimitsOverride | null): boolean {
  if (!o) return true;
  return (
    o.maxUsers == null &&
    o.maxClientAccounts == null &&
    o.maxIntegrations == null &&
    o.maxDashboards == null &&
    o.maxChildOrganizations == null
  );
}

/** Org cuja assinatura e overrides definem o plano efetivo (matriz se filho herda). */
export async function resolveBillingOrganizationId(organizationId: string): Promise<string> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { parentOrganizationId: true, inheritPlanFromParent: true },
  });
  if (!org) {
    throw new Error("Empresa não encontrada");
  }
  if (org.parentOrganizationId && org.inheritPlanFromParent) {
    return await resolveBillingOrganizationId(org.parentOrganizationId);
  }
  return organizationId;
}

type ResolvedPlan = {
  plan: Plan | null;
  planSource: "own" | "parent";
  billingOrganizationId: string;
};

/** Plano template (limites) efetivo + origem para exibição. */
export async function resolveEffectivePlan(organizationId: string): Promise<ResolvedPlan> {
  const billingOrganizationId = await resolveBillingOrganizationId(organizationId);
  const billingOrg = await prisma.organization.findFirst({
    where: { id: billingOrganizationId, deletedAt: null },
    include: {
      plan: true,
      subscription: { include: { plan: true } },
    },
  });
  if (!billingOrg) {
    throw new Error("Empresa não encontrada");
  }
  const templatePlan = billingOrg.subscription?.plan ?? billingOrg.plan;
  const planSource: "own" | "parent" = billingOrganizationId === organizationId ? "own" : "parent";
  return { plan: templatePlan, planSource, billingOrganizationId };
}

export async function getEffectivePlanLimits(organizationId: string): Promise<EffectivePlanLimits> {
  const { plan, billingOrganizationId } = await resolveEffectivePlan(organizationId);
  const base = effectiveLimitsFromPlan(plan);
  const override = await prisma.subscriptionLimitsOverride.findUnique({
    where: { organizationId: billingOrganizationId },
  });
  return mergeOverride(base, override);
}

async function countUsage(organizationId: string): Promise<PlanUsageDto> {
  const [
    directMembers,
    pendingInvitations,
    integrations,
    dashboards,
    clientAccounts,
    childOrganizations,
    projects,
    launches,
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
    prisma.project.count({
      where: { organizationId, deletedAt: null },
    }),
    prisma.launch.count({
      where: { project: { organizationId, deletedAt: null }, deletedAt: null },
    }),
  ]);

  return {
    directMembers,
    pendingInvitations,
    integrations,
    dashboards,
    clientAccounts,
    childOrganizations,
    projects,
    launches,
  };
}

export async function getOrganizationPlanContext(organizationId: string): Promise<OrganizationPlanContextDto> {
  const { plan, planSource, billingOrganizationId } = await resolveEffectivePlan(organizationId);
  const base = effectiveLimitsFromPlan(plan);
  const override = await prisma.subscriptionLimitsOverride.findUnique({
    where: { organizationId: billingOrganizationId },
  });
  const limits = mergeOverride(base, override);
  const usage = await countUsage(organizationId);
  return {
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          planType: plan.planType,
          active: plan.active,
        }
      : null,
    planSource,
    limits,
    limitsHaveOverrides: !overrideIsEmpty(override),
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

export async function assertCanAddChildOrganization(
  parentOrganizationId: string,
  actorUserId?: string
): Promise<void> {
  if (actorUserId) {
    const actor = await prisma.user.findFirst({
      where: { id: actorUserId, deletedAt: null },
      select: { email: true },
    });
    if (actor?.email && isPlatformAdminEmail(actor.email)) {
      return;
    }
  }

  const parentOrg = await prisma.organization.findFirst({
    where: { id: parentOrganizationId, deletedAt: null },
    select: { organizationKind: true },
  });
  if (!parentOrg) {
    throw new Error("Organização pai não encontrada");
  }
  if (parentOrg.organizationKind !== "MATRIX") {
    throw new Error("Apenas a matriz pode criar workspaces filhos");
  }

  const limits = await getEffectivePlanLimits(parentOrganizationId);
  if (limits.maxChildOrganizations == null) return;
  if (limits.maxChildOrganizations <= 0) {
    throw new Error(
      "Seu plano não inclui workspaces filhos (multiempresa / revenda). Ajuste o plano da organização para liberar."
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
