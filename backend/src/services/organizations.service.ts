import { prisma } from "../utils/prisma.js";
import { slugifyOrganizationName, uniqueOrganizationSlug } from "../utils/org-slug.js";
import {
  assertDirectOrgAdmin,
  canManageOrganization,
  userHasEffectiveAccess,
} from "./auth.service.js";
import {
  assertCanAddChildOrganization,
  getOrganizationPlanContext,
  resolveBillingOrganizationId,
  resolveEffectivePlan,
} from "./plan-limits.service.js";
import { mergePlanFeatures } from "../utils/plan-features.js";
import { syncSubscriptionFromOrgPlan } from "./platform.service.js";

export async function getOrganizationContext(organizationId: string, userId: string) {
  const allowed = await userHasEffectiveAccess(userId, organizationId);
  if (!allowed) {
    throw new Error("Sem acesso a esta empresa");
  }
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    include: {
      parentOrganization: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!org) {
    throw new Error("Empresa não encontrada");
  }
  const planContext = await getOrganizationPlanContext(organizationId);
  const billingId = await resolveBillingOrganizationId(organizationId);
  const { plan: templatePlan } = await resolveEffectivePlan(organizationId);

  const sub = await prisma.subscription.findUnique({
    where: { organizationId: billingId },
    include: { plan: true },
  });

  const billingOrg = await prisma.organization.findUnique({
    where: { id: billingId },
    select: { id: true, name: true, slug: true, createdAt: true },
  });

  let subscription: {
    billingMode: string;
    status: string;
    startedAt: string;
    renewsAt: string | null;
    endedAt: string | null;
    notes: string | null;
    plan: {
      id: string;
      name: string;
      slug: string;
      planType: string;
      active: boolean;
    };
    billingOrganization: { id: string; name: string } | null;
    inherited: boolean;
  } | null = null;

  if (sub) {
    subscription = {
      billingMode: sub.billingMode,
      status: sub.status,
      startedAt: sub.startedAt.toISOString(),
      renewsAt: sub.renewsAt?.toISOString() ?? null,
      endedAt: sub.endedAt?.toISOString() ?? null,
      notes: sub.notes,
      plan: {
        id: sub.plan.id,
        name: sub.plan.name,
        slug: sub.plan.slug,
        planType: sub.plan.planType,
        active: sub.plan.active,
      },
      billingOrganization: billingOrg ? { id: billingOrg.id, name: billingOrg.name } : null,
      inherited: planContext.planSource === "parent",
    };
  } else if (templatePlan) {
    subscription = {
      billingMode: "custom",
      status: "active",
      startedAt: (billingOrg?.createdAt ?? new Date()).toISOString(),
      renewsAt: null,
      endedAt: null,
      notes: null,
      plan: {
        id: templatePlan.id,
        name: templatePlan.name,
        slug: templatePlan.slug,
        planType: templatePlan.planType,
        active: templatePlan.active,
      },
      billingOrganization: billingOrg ? { id: billingOrg.id, name: billingOrg.name } : null,
      inherited: planContext.planSource === "parent",
    };
  }

  const enabledFeatures = mergePlanFeatures(templatePlan);

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    parentOrganization: org.parentOrganization,
    plan: planContext.plan,
    planSource: planContext.planSource,
    limits: planContext.limits,
    limitsHaveOverrides: planContext.limitsHaveOverrides,
    usage: planContext.usage,
    subscription,
    enabledFeatures,
  };
}

export async function updateOrganizationName(organizationId: string, userId: string, name: string) {
  const ok = await canManageOrganization(userId, organizationId);
  if (!ok) {
    throw new Error("Sem permissão para alterar esta empresa");
  }
  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: { name: name.trim() },
  });
  return { id: org.id, name: org.name, slug: org.slug };
}

export async function listChildOrganizations(organizationId: string, userId: string) {
  await assertDirectOrgAdmin(userId, organizationId);
  return prisma.organization.findMany({
    where: { parentOrganizationId: organizationId, deletedAt: null },
    select: { id: true, name: true, slug: true, createdAt: true },
    orderBy: { name: "asc" },
  });
}

export async function createChildOrganization(
  parentOrganizationId: string,
  userId: string,
  name: string,
  options?: { inheritPlanFromParent?: boolean; planId?: string | null }
) {
  await assertDirectOrgAdmin(userId, parentOrganizationId);
  await assertCanAddChildOrganization(parentOrganizationId);
  const inherit = options?.inheritPlanFromParent !== false;
  const parent = await prisma.organization.findFirst({
    where: { id: parentOrganizationId, deletedAt: null },
    select: { planId: true },
  });
  const slug = await uniqueOrganizationSlug(slugifyOrganizationName(name));
  const planId = inherit ? (parent?.planId ?? null) : (options?.planId ?? null);
  const org = await prisma.organization.create({
    data: {
      name: name.trim(),
      slug,
      parentOrganizationId,
      inheritPlanFromParent: inherit,
      planId,
    },
  });
  if (!inherit && planId) {
    await syncSubscriptionFromOrgPlan(org.id);
  }
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    inheritPlanFromParent: org.inheritPlanFromParent,
    planId: org.planId,
  };
}

export async function updateOrganizationPlanSettings(
  organizationId: string,
  userId: string,
  data: { inheritPlanFromParent?: boolean; planId?: string | null }
) {
  const ok = await canManageOrganization(userId, organizationId);
  if (!ok) {
    throw new Error("Sem permissão");
  }
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
  });
  if (!org) {
    throw new Error("Empresa não encontrada");
  }

  const patch: { inheritPlanFromParent?: boolean; planId?: string | null } = {};
  if (data.inheritPlanFromParent !== undefined) {
    patch.inheritPlanFromParent = org.parentOrganizationId ? data.inheritPlanFromParent : false;
  }
  if (data.planId !== undefined) {
    if (data.planId) {
      const p = await prisma.plan.findUnique({ where: { id: data.planId } });
      if (!p) throw new Error("Plano não encontrado");
    }
    patch.planId = data.planId;
  }

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: patch,
    select: { id: true, name: true, slug: true, inheritPlanFromParent: true, planId: true },
  });
  if (patch.planId !== undefined) {
    await syncSubscriptionFromOrgPlan(organizationId);
  }
  return updated;
}

export async function listChildOrganizationsPortfolio(parentOrganizationId: string, userId: string) {
  await assertDirectOrgAdmin(userId, parentOrganizationId);
  const children = await prisma.organization.findMany({
    where: { parentOrganizationId, deletedAt: null },
    select: { id: true, name: true, slug: true, createdAt: true, inheritPlanFromParent: true },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    children.map(async (c) => {
      const integrations = await prisma.integration.findMany({
        where: { organizationId: c.id, status: "connected" },
        select: { lastSyncAt: true },
      });
      let lastIntegrationSyncAt: string | null = null;
      for (const i of integrations) {
        if (!i.lastSyncAt) continue;
        const iso = i.lastSyncAt.toISOString();
        if (!lastIntegrationSyncAt || iso > lastIntegrationSyncAt) lastIntegrationSyncAt = iso;
      }
      return {
        ...c,
        createdAt: c.createdAt.toISOString(),
        connectedIntegrations: integrations.length,
        lastIntegrationSyncAt,
      };
    })
  );
}
