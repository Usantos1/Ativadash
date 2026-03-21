import { prisma } from "../utils/prisma.js";
import { slugifyOrganizationName, uniqueOrganizationSlug } from "../utils/org-slug.js";
import {
  assertDirectOrgAdmin,
  canManageOrganization,
  userHasEffectiveAccess,
} from "./auth.service.js";

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
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    parentOrganization: org.parentOrganization,
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

export async function createChildOrganization(parentOrganizationId: string, userId: string, name: string) {
  await assertDirectOrgAdmin(userId, parentOrganizationId);
  const slug = await uniqueOrganizationSlug(slugifyOrganizationName(name));
  const org = await prisma.organization.create({
    data: {
      name: name.trim(),
      slug,
      parentOrganizationId,
    },
  });
  return { id: org.id, name: org.name, slug: org.slug };
}
