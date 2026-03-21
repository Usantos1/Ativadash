import { prisma } from "../utils/prisma.js";
import type { Prisma } from "@prisma/client";

export async function syncSubscriptionFromOrgPlan(organizationId: string): Promise<void> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { planId: true },
  });
  if (!org?.planId) {
    await prisma.subscription.deleteMany({ where: { organizationId } });
    return;
  }
  await prisma.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      planId: org.planId,
      billingMode: "custom",
      status: "active",
    },
    update: { planId: org.planId, endedAt: null },
  });
}

export async function syncAllSubscriptionsFromOrgPlans(): Promise<{ synced: number }> {
  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null, planId: { not: null } },
    select: { id: true },
  });
  for (const o of orgs) {
    await syncSubscriptionFromOrgPlan(o.id);
  }
  return { synced: orgs.length };
}

export async function listPlans() {
  return prisma.plan.findMany({ orderBy: { name: "asc" } });
}

export async function createPlan(data: {
  name: string;
  slug: string;
  maxIntegrations: number;
  maxDashboards: number;
  maxUsers: number | null;
  maxClientAccounts: number | null;
  maxChildOrganizations: number | null;
  descriptionInternal?: string | null;
  active?: boolean;
  planType?: string;
  features?: Prisma.InputJsonValue;
}) {
  return prisma.plan.create({
    data: {
      name: data.name,
      slug: data.slug,
      maxIntegrations: data.maxIntegrations,
      maxDashboards: data.maxDashboards,
      maxUsers: data.maxUsers,
      maxClientAccounts: data.maxClientAccounts,
      maxChildOrganizations: data.maxChildOrganizations,
      descriptionInternal: data.descriptionInternal ?? null,
      active: data.active ?? true,
      planType: data.planType ?? "standard",
      features: data.features ?? {},
    },
  });
}

export async function updatePlan(
  id: string,
  data: Partial<{
    name: string;
    slug: string;
    maxIntegrations: number;
    maxDashboards: number;
    maxUsers: number | null;
    maxClientAccounts: number | null;
    maxChildOrganizations: number | null;
    descriptionInternal: string | null;
    active: boolean;
    planType: string;
    features: Prisma.InputJsonValue;
  }>
) {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as Prisma.PlanUpdateInput;
  return prisma.plan.update({ where: { id }, data: clean });
}

export async function deletePlan(id: string) {
  const nOrg = await prisma.organization.count({ where: { planId: id } });
  if (nOrg > 0) {
    throw new Error("Plano em uso por empresas; atribua outro plano antes de excluir");
  }
  const nSub = await prisma.subscription.count({ where: { planId: id } });
  if (nSub > 0) {
    throw new Error("Plano vinculado a assinaturas; reatribua antes de excluir");
  }
  await prisma.plan.delete({ where: { id } });
}

export async function listAllOrganizations() {
  return prisma.organization.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      inheritPlanFromParent: true,
      parentOrganizationId: true,
      planId: true,
      plan: { select: { id: true, name: true, slug: true } },
      subscription: {
        select: {
          id: true,
          billingMode: true,
          status: true,
          startedAt: true,
          renewsAt: true,
          planId: true,
        },
      },
      limitsOverride: {
        select: {
          maxUsers: true,
          maxIntegrations: true,
          maxDashboards: true,
          maxClientAccounts: true,
          maxChildOrganizations: true,
        },
      },
      createdAt: true,
    },
  });
}

export async function listSubscriptions() {
  return prisma.subscription.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      plan: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function assignOrganizationPlan(organizationId: string, planId: string | null) {
  if (planId === null) {
    await prisma.subscription.deleteMany({ where: { organizationId } });
    return prisma.organization.update({
      where: { id: organizationId },
      data: { planId: null },
    });
  }
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: organizationId },
      data: { planId },
    }),
    prisma.subscription.upsert({
      where: { organizationId },
      create: { organizationId, planId, billingMode: "custom", status: "active" },
      update: { planId, status: "active", endedAt: null },
    }),
  ]);
  return prisma.organization.findFirst({
    where: { id: organizationId },
    include: { plan: true, subscription: true },
  });
}

export async function updateSubscriptionForOrganization(
  organizationId: string,
  data: {
    planId?: string;
    billingMode?: string;
    status?: string;
    renewsAt?: Date | null;
    endedAt?: Date | null;
    notes?: string | null;
  }
) {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { planId: true },
  });
  if (!org) throw new Error("Empresa não encontrada");
  let planId = org.planId;
  if (data.planId !== undefined) {
    const p = await prisma.plan.findUnique({ where: { id: data.planId } });
    if (!p) throw new Error("Plano não encontrado");
    planId = data.planId;
    await prisma.organization.update({
      where: { id: organizationId },
      data: { planId: data.planId },
    });
  }
  if (!planId) {
    throw new Error("Atribua um plano à empresa antes de editar a assinatura");
  }

  const existing = await prisma.subscription.findUnique({ where: { organizationId } });
  const patch: Prisma.SubscriptionUpdateInput = {};
  if (data.billingMode !== undefined) patch.billingMode = data.billingMode;
  if (data.status !== undefined) patch.status = data.status;
  if (data.renewsAt !== undefined) patch.renewsAt = data.renewsAt;
  if (data.endedAt !== undefined) patch.endedAt = data.endedAt;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.planId !== undefined) patch.plan = { connect: { id: data.planId } };

  if (!existing) {
    return prisma.subscription.create({
      data: {
        organizationId,
        planId,
        billingMode: (data.billingMode as string) ?? "custom",
        status: (data.status as string) ?? "active",
        renewsAt: data.renewsAt,
        endedAt: data.endedAt,
        notes: data.notes ?? null,
      },
      include: { plan: true, organization: { select: { id: true, name: true, slug: true } } },
    });
  }

  return prisma.subscription.update({
    where: { organizationId },
    data: patch,
    include: { plan: true, organization: { select: { id: true, name: true, slug: true } } },
  });
}

export async function putLimitsOverride(
  organizationId: string,
  data: {
    maxUsers: number | null;
    maxClientAccounts: number | null;
    maxIntegrations: number | null;
    maxDashboards: number | null;
    maxChildOrganizations: number | null;
    notes: string | null;
  }
) {
  const org = await prisma.organization.findFirst({ where: { id: organizationId, deletedAt: null } });
  if (!org) throw new Error("Empresa não encontrada");

  const allNull =
    data.maxUsers == null &&
    data.maxClientAccounts == null &&
    data.maxIntegrations == null &&
    data.maxDashboards == null &&
    data.maxChildOrganizations == null;

  if (allNull && (data.notes == null || data.notes === "")) {
    await prisma.subscriptionLimitsOverride.deleteMany({ where: { organizationId } });
    return null;
  }

  return prisma.subscriptionLimitsOverride.upsert({
    where: { organizationId },
    create: {
      organizationId,
      maxUsers: data.maxUsers,
      maxClientAccounts: data.maxClientAccounts,
      maxIntegrations: data.maxIntegrations,
      maxDashboards: data.maxDashboards,
      maxChildOrganizations: data.maxChildOrganizations,
      notes: data.notes,
    },
    update: {
      maxUsers: data.maxUsers,
      maxClientAccounts: data.maxClientAccounts,
      maxIntegrations: data.maxIntegrations,
      maxDashboards: data.maxDashboards,
      maxChildOrganizations: data.maxChildOrganizations,
      notes: data.notes,
    },
  });
}

export async function getLimitsOverride(organizationId: string) {
  return prisma.subscriptionLimitsOverride.findUnique({
    where: { organizationId },
  });
}
