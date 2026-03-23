import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma.js";
import type { Prisma, WorkspaceStatus } from "@prisma/client";
import { slugifyOrganizationName, uniqueOrganizationSlug } from "../utils/org-slug.js";
import { appendAuditLog } from "./audit-log.service.js";

const PLATFORM_ORG_CREATE_SALT = 10;

const ORGANIZATION_PLATFORM_SELECT = {
  id: true,
  name: true,
  slug: true,
  workspaceStatus: true,
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
} satisfies Prisma.OrganizationSelect;

export async function syncSubscriptionFromOrgPlan(organizationId: string): Promise<void> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { planId: true, organizationKind: true },
  });
  if (org?.organizationKind === "CLIENT_WORKSPACE") {
    await prisma.subscription.deleteMany({ where: { organizationId } });
    return;
  }
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
    where: { deletedAt: null, planId: { not: null }, organizationKind: { not: "CLIENT_WORKSPACE" } },
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

export async function duplicatePlan(sourcePlanId: string, newSlug: string, newName: string) {
  const p = await prisma.plan.findUnique({ where: { id: sourcePlanId } });
  if (!p) {
    throw new Error("Plano não encontrado");
  }
  const slugTaken = await prisma.plan.findUnique({ where: { slug: newSlug } });
  if (slugTaken) {
    throw new Error("Slug já em uso");
  }
  return prisma.plan.create({
    data: {
      name: newName.trim(),
      slug: newSlug.trim().toLowerCase(),
      descriptionInternal: p.descriptionInternal ? `Cópia — ${p.descriptionInternal}` : "Cópia",
      active: false,
      planType: p.planType,
      features: (p.features ?? {}) as Prisma.InputJsonValue,
      maxIntegrations: p.maxIntegrations,
      maxDashboards: p.maxDashboards,
      maxUsers: p.maxUsers,
      maxClientAccounts: p.maxClientAccounts,
      maxChildOrganizations: p.maxChildOrganizations,
    },
  });
}

export async function listAllOrganizations() {
  return prisma.organization.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: ORGANIZATION_PLATFORM_SELECT,
  });
}

/**
 * Cria empresa raiz (sem matriz): uso pela administração da plataforma.
 * Opcionalmente atribui plano e cria o primeiro usuário proprietário.
 */
export async function createRootOrganization(data: {
  name: string;
  slug?: string;
  planId?: string | null;
  ownerEmail?: string;
  ownerName?: string;
  ownerPassword?: string;
}) {
  const name = data.name.trim();
  if (name.length < 2) {
    throw new Error("Nome muito curto");
  }

  let slug: string;
  const rawSlug = data.slug?.trim().toLowerCase();
  if (rawSlug && rawSlug.length > 0) {
    const taken = await prisma.organization.findFirst({ where: { slug: rawSlug, deletedAt: null } });
    if (taken) {
      throw new Error("Slug já em uso");
    }
    slug = rawSlug;
  } else {
    slug = await uniqueOrganizationSlug(slugifyOrganizationName(name));
  }

  const planId = data.planId && data.planId.length > 0 ? data.planId : null;
  if (planId) {
    const p = await prisma.plan.findUnique({ where: { id: planId } });
    if (!p) {
      throw new Error("Plano não encontrado");
    }
  }

  const em = (data.ownerEmail ?? "").trim().toLowerCase();
  const on = (data.ownerName ?? "").trim();
  const pw = data.ownerPassword ?? "";
  const wantsOwner = em.length > 0 || on.length > 0 || pw.length > 0;
  if (wantsOwner) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      throw new Error("E-mail do proprietário inválido");
    }
    if (on.length < 2) {
      throw new Error("Nome do proprietário é obrigatório (mín. 2 caracteres)");
    }
    if (pw.length < 8) {
      throw new Error("Senha do proprietário: mínimo 8 caracteres");
    }
    const dup = await prisma.user.findUnique({ where: { email: em } });
    if (dup) {
      throw new Error("Já existe usuário com este e-mail");
    }
  }

  const orgId = await prisma.$transaction(async (tx) => {
    const o = await tx.organization.create({
      data: {
        name,
        slug,
        parentOrganizationId: null,
        inheritPlanFromParent: false,
        planId,
        resellerOrgKind: null,
        workspaceStatus: "ACTIVE",
        organizationKind: "MATRIX",
      },
    });

    if (planId) {
      await tx.subscription.create({
        data: {
          organizationId: o.id,
          planId,
          billingMode: "custom",
          status: "active",
        },
      });
    }

    if (wantsOwner) {
      const hashed = await bcrypt.hash(pw, PLATFORM_ORG_CREATE_SALT);
      const user = await tx.user.create({
        data: {
          email: em,
          name: on,
          password: hashed,
          mustChangePassword: true,
        },
      });
      await tx.membership.create({
        data: { userId: user.id, organizationId: o.id, role: "agency_owner" },
      });
    }

    return o.id;
  });

  const row = await prisma.organization.findFirst({
    where: { id: orgId },
    select: ORGANIZATION_PLATFORM_SELECT,
  });
  if (!row) {
    throw new Error("Falha ao carregar empresa criada");
  }
  return row;
}

export async function updateOrganizationProfile(
  organizationId: string,
  data: { name?: string; slug?: string; workspaceStatus?: WorkspaceStatus },
  actorUserId?: string | null
) {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { id: true, workspaceStatus: true },
  });
  if (!org) {
    throw new Error("Organização não encontrada");
  }
  const previousWorkspaceStatus = org.workspaceStatus;
  const patch: Prisma.OrganizationUpdateInput = {};
  if (data.name !== undefined) {
    patch.name = data.name.trim();
  }
  if (data.slug !== undefined) {
    const s = data.slug.trim().toLowerCase();
    const clash = await prisma.organization.findFirst({
      where: { slug: s, id: { not: organizationId }, deletedAt: null },
    });
    if (clash) {
      throw new Error("Slug já em uso");
    }
    patch.slug = s;
  }
  if (data.workspaceStatus !== undefined) {
    patch.workspaceStatus = data.workspaceStatus;
  }
  await prisma.organization.update({ where: { id: organizationId }, data: patch });
  if (
    actorUserId &&
    data.workspaceStatus === "ARCHIVED" &&
    previousWorkspaceStatus !== "ARCHIVED"
  ) {
    await appendAuditLog({
      actorUserId,
      organizationId,
      action: "platform.organization.workspace_archived",
      entityType: "Organization",
      entityId: organizationId,
      metadata: { previousWorkspaceStatus },
    });
  }
  const row = await prisma.organization.findFirst({
    where: { id: organizationId },
    select: ORGANIZATION_PLATFORM_SELECT,
  });
  if (!row) {
    throw new Error("Organização não encontrada");
  }
  return row;
}

export async function softDeleteOrganization(organizationId: string) {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!org) {
    throw new Error("Organização não encontrada");
  }
  const n = await prisma.organization.count({
    where: { parentOrganizationId: organizationId, deletedAt: null },
  });
  if (n > 0) {
    throw new Error("Existem organizações filhas ativas; remova-as ou exclua-as antes.");
  }
  await prisma.organization.update({
    where: { id: organizationId },
    data: { deletedAt: new Date(), workspaceStatus: "ARCHIVED" },
  });
}

export async function listSubscriptions() {
  return prisma.subscription.findMany({
    where: { organization: { deletedAt: null } },
    orderBy: [{ organization: { name: "asc" } }, { organization: { slug: "asc" } }],
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
    select: { planId: true, organizationKind: true },
  });
  if (!org) throw new Error("Empresa não encontrada");
  if (org.organizationKind === "CLIENT_WORKSPACE") {
    throw new Error("Workspace cliente não possui assinatura própria; altere a matriz ou o plano herdado");
  }
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
