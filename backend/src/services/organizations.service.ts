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
} from "./plan-limits.service.js";

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
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    parentOrganization: org.parentOrganization,
    plan: planContext.plan,
    limits: planContext.limits,
    usage: planContext.usage,
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
