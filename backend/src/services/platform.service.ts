import { prisma } from "../utils/prisma.js";

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
}) {
  return prisma.plan.create({ data });
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
  }>
) {
  return prisma.plan.update({ where: { id }, data });
}

export async function deletePlan(id: string) {
  const n = await prisma.organization.count({ where: { planId: id } });
  if (n > 0) {
    throw new Error("Plano em uso por empresas; atribua outro plano antes de excluir");
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
      createdAt: true,
    },
  });
}

export async function assignOrganizationPlan(organizationId: string, planId: string | null) {
  return prisma.organization.update({
    where: { id: organizationId },
    data: { planId },
  });
}
