import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { appendResellerAudit } from "../utils/reseller-audit.js";
import { assertDirectOrgAdmin } from "./auth.service.js";
import {
  createChildOrganization,
  listChildOrganizationsOperationsDashboard,
  updateChildOrganizationByParent,
  updateOrganizationPlanSettings,
} from "./organizations.service.js";
import {
  getLimitsOverride,
  putLimitsOverride,
  updateSubscriptionForOrganization,
} from "./platform.service.js";
import { removeMember, updateMemberRole } from "./members.service.js";
import { resellerGovernancePatchSchema } from "../validators/reseller.validator.js";
import type { z } from "zod";

const SALT_ROUNDS = 10;

type GovernanceBody = z.infer<typeof resellerGovernancePatchSchema>;

/**
 * JWT e contexto ativo podem estar na matriz ou numa filial (após "entrar" na empresa).
 * O painel master sempre opera sobre a matriz: resolve o ID raiz e exige admin/owner nela.
 */
export async function resolveResellerMatrixOrganizationId(
  userId: string,
  activeOrganizationId: string
): Promise<string> {
  const org = await prisma.organization.findFirst({
    where: { id: activeOrganizationId, deletedAt: null },
    select: { id: true, parentOrganizationId: true },
  });
  if (!org) {
    throw new Error("Organização não encontrada");
  }

  if (org.parentOrganizationId === null) {
    await assertDirectOrgAdmin(userId, org.id);
    return org.id;
  }

  const parent = await prisma.organization.findFirst({
    where: { id: org.parentOrganizationId, deletedAt: null },
    select: { id: true, parentOrganizationId: true },
  });
  if (!parent || parent.parentOrganizationId !== null) {
    throw new Error(
      "O painel master de revenda exige hierarquia matriz → filiais. Esta organização não é filha direta da matriz."
    );
  }

  await assertDirectOrgAdmin(userId, parent.id);
  return parent.id;
}

async function ecosystemOrganizationIds(matrixId: string): Promise<string[]> {
  const children = await prisma.organization.findMany({
    where: { parentOrganizationId: matrixId, deletedAt: null },
    select: { id: true },
  });
  return [matrixId, ...children.map((c) => c.id)];
}

async function applyLimitsOverridePatch(
  childId: string,
  patch: NonNullable<GovernanceBody["limitsOverride"]>
): Promise<void> {
  const existing = await getLimitsOverride(childId);
  const merged = {
    maxUsers: patch.maxUsers !== undefined ? patch.maxUsers : (existing?.maxUsers ?? null),
    maxClientAccounts:
      patch.maxClientAccounts !== undefined ? patch.maxClientAccounts : (existing?.maxClientAccounts ?? null),
    maxIntegrations:
      patch.maxIntegrations !== undefined ? patch.maxIntegrations : (existing?.maxIntegrations ?? null),
    maxDashboards:
      patch.maxDashboards !== undefined ? patch.maxDashboards : (existing?.maxDashboards ?? null),
    maxChildOrganizations:
      patch.maxChildOrganizations !== undefined
        ? patch.maxChildOrganizations
        : (existing?.maxChildOrganizations ?? null),
    notes: patch.notes !== undefined ? patch.notes : (existing?.notes ?? null),
  };
  await putLimitsOverride(childId, merged);
}

export async function resellerGetOverview(activeOrganizationId: string, userId: string) {
  const matrixId = await resolveResellerMatrixOrganizationId(userId, activeOrganizationId);
  return listChildOrganizationsOperationsDashboard(matrixId, userId);
}

export async function resellerGetOperationalHealth(activeOrganizationId: string, userId: string) {
  const dash = await resellerGetOverview(activeOrganizationId, userId);
  const severityRank = { critical: 0, warning: 1, info: 2 };
  const prioritizedAlerts = [...dash.alerts].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity]
  );
  return {
    summary: dash.summary,
    organizationsNeedingAttention: dash.organizations.filter((o) => o.needsAttention),
    prioritizedAlerts,
  };
}

export async function resellerListActivePlans(activeOrganizationId: string, userId: string) {
  await resolveResellerMatrixOrganizationId(userId, activeOrganizationId);
  return prisma.plan.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      planType: true,
      active: true,
      features: true,
      maxIntegrations: true,
      maxDashboards: true,
      maxUsers: true,
      maxClientAccounts: true,
      maxChildOrganizations: true,
    },
  });
}

export async function resellerCreateChild(
  activeOrganizationId: string,
  actorUserId: string,
  data: {
    name: string;
    inheritPlanFromParent?: boolean;
    planId?: string | null;
    workspaceNote?: string | null;
    resellerOrgKind?: "AGENCY" | "CLIENT";
  }
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const org = await createChildOrganization(matrixId, actorUserId, data.name, {
    inheritPlanFromParent: data.inheritPlanFromParent,
    planId: data.planId,
    workspaceNote: data.workspaceNote,
    resellerOrgKind: data.resellerOrgKind,
  });
  await appendResellerAudit(matrixId, actorUserId, "CHILD_ORG_CREATED", "Organization", org.id, {
    name: data.name,
    resellerOrgKind: data.resellerOrgKind ?? "CLIENT",
  });
  return org;
}

export async function resellerPatchChildGovernance(
  activeOrganizationId: string,
  actorUserId: string,
  childId: string,
  body: GovernanceBody
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const child = await prisma.organization.findFirst({
    where: { id: childId, parentOrganizationId: matrixId, deletedAt: null },
  });
  if (!child) {
    throw new Error("Empresa filha não encontrada");
  }

  const hasOrgScalar =
    body.name !== undefined ||
    body.workspaceStatus !== undefined ||
    body.workspaceNote !== undefined ||
    body.resellerOrgKind !== undefined ||
    body.featureOverrides !== undefined;

  if (hasOrgScalar) {
    await updateChildOrganizationByParent(matrixId, actorUserId, childId, {
      name: body.name,
      workspaceStatus: body.workspaceStatus,
      workspaceNote: body.workspaceNote,
      resellerOrgKind: body.resellerOrgKind,
      featureOverrides: body.featureOverrides,
    });
  }

  if (body.inheritPlanFromParent !== undefined || body.planId !== undefined) {
    await updateOrganizationPlanSettings(childId, actorUserId, {
      inheritPlanFromParent: body.inheritPlanFromParent,
      planId: body.planId,
    });
  }

  if (body.subscription && Object.keys(body.subscription).length > 0) {
    const s = body.subscription;
    await updateSubscriptionForOrganization(childId, {
      planId: s.planId,
      billingMode: s.billingMode,
      status: s.status,
      renewsAt: s.renewsAt === undefined ? undefined : s.renewsAt ? new Date(s.renewsAt) : null,
      endedAt: s.endedAt === undefined ? undefined : s.endedAt ? new Date(s.endedAt) : null,
      notes: s.notes,
    });
  }

  if (body.limitsOverride && Object.keys(body.limitsOverride).length > 0) {
    await applyLimitsOverridePatch(childId, body.limitsOverride);
  }

  await appendResellerAudit(matrixId, actorUserId, "CHILD_GOVERNANCE_PATCH", "Organization", childId, {
    keys: Object.keys(body),
  });

  return prisma.organization.findFirst({
    where: { id: childId, deletedAt: null },
    include: {
      plan: { select: { id: true, name: true, slug: true } },
      subscription: true,
      limitsOverride: true,
    },
  });
}

export async function resellerListEcosystemUsers(
  activeOrganizationId: string,
  userId: string,
  filters: {
    organizationId?: string;
    resellerOrgKind?: "AGENCY" | "CLIENT";
    suspended?: "true" | "false";
    role?: string;
    q?: string;
  }
) {
  const matrixId = await resolveResellerMatrixOrganizationId(userId, activeOrganizationId);
  const orgIds = await ecosystemOrganizationIds(matrixId);
  if (filters.organizationId && !orgIds.includes(filters.organizationId)) {
    throw new Error("Empresa fora do ecossistema");
  }

  const orgFilter: Prisma.OrganizationWhereInput = { deletedAt: null };
  if (filters.organizationId) {
    orgFilter.id = filters.organizationId;
  }
  if (filters.resellerOrgKind) {
    orgFilter.resellerOrgKind = filters.resellerOrgKind;
  }

  const userWhere: Prisma.UserWhereInput = { deletedAt: null };
  if (filters.suspended === "true") {
    userWhere.suspendedAt = { not: null };
  }
  if (filters.suspended === "false") {
    userWhere.suspendedAt = null;
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    userWhere.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }

  const membershipWhere: Prisma.MembershipWhereInput = {
    organizationId: filters.organizationId ? filters.organizationId : { in: orgIds },
    organization: orgFilter,
    user: userWhere,
    ...(filters.role ? { role: filters.role } : {}),
  };

  const rows = await prisma.membership.findMany({
    where: membershipWhere,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          suspendedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          resellerOrgKind: true,
          parentOrganizationId: true,
        },
      },
    },
    orderBy: [{ user: { email: "asc" } }, { organizationId: "asc" }],
    take: 1000,
  });

  return rows.map((m) => ({
    membershipId: m.id,
    role: m.role,
    createdAt: m.createdAt.toISOString(),
    user: {
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      suspended: m.user.suspendedAt != null,
      suspendedAt: m.user.suspendedAt?.toISOString() ?? null,
      createdAt: m.user.createdAt.toISOString(),
      updatedAt: m.user.updatedAt.toISOString(),
    },
    organization: {
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      resellerOrgKind: m.organization.resellerOrgKind,
      isMatrix: m.organization.id === matrixId,
    },
  }));
}

export async function resellerPatchUser(
  activeOrganizationId: string,
  actorUserId: string,
  targetUserId: string,
  patch: { email?: string; name?: string; suspended?: boolean }
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const orgIds = await ecosystemOrganizationIds(matrixId);
  const inEco = await prisma.membership.findFirst({
    where: { userId: targetUserId, organizationId: { in: orgIds } },
  });
  if (!inEco) {
    throw new Error("Usuário fora do ecossistema");
  }

  const user = await prisma.user.findFirst({
    where: { id: targetUserId, deletedAt: null },
  });
  if (!user) {
    throw new Error("Usuário não encontrado");
  }

  if (patch.email !== undefined && patch.email.toLowerCase() !== user.email.toLowerCase()) {
    const taken = await prisma.user.findFirst({
      where: { email: patch.email, NOT: { id: targetUserId } },
    });
    if (taken) {
      throw new Error("E-mail já em uso");
    }
  }

  const data: Prisma.UserUpdateInput = {};
  if (patch.email !== undefined) {
    data.email = patch.email.trim().toLowerCase();
  }
  if (patch.name !== undefined) {
    data.name = patch.name.trim();
  }
  if (patch.suspended === true) {
    data.suspendedAt = new Date();
  } else if (patch.suspended === false) {
    data.suspendedAt = null;
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      suspendedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await appendResellerAudit(matrixId, actorUserId, "USER_UPDATED", "User", targetUserId, {
    fields: Object.keys(patch),
  });

  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    suspended: updated.suspendedAt != null,
    suspendedAt: updated.suspendedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function resellerResetUserPassword(
  activeOrganizationId: string,
  actorUserId: string,
  targetUserId: string,
  newPassword: string
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const orgIds = await ecosystemOrganizationIds(matrixId);
  const inEco = await prisma.membership.findFirst({
    where: { userId: targetUserId, organizationId: { in: orgIds } },
  });
  if (!inEco) {
    throw new Error("Usuário fora do ecossistema");
  }

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { password: hashed },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: targetUserId } }),
  ]);

  await appendResellerAudit(matrixId, actorUserId, "USER_PASSWORD_RESET", "User", targetUserId, {});

  return { ok: true as const };
}

export async function resellerSetMembershipRole(
  activeOrganizationId: string,
  actorUserId: string,
  organizationId: string,
  targetUserId: string,
  role: string
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const orgIds = await ecosystemOrganizationIds(matrixId);
  if (!orgIds.includes(organizationId)) {
    throw new Error("Empresa fora do ecossistema");
  }
  const result = await updateMemberRole(organizationId, actorUserId, targetUserId, role);
  if (!result.ok) {
    throw new Error(result.message);
  }
  await appendResellerAudit(matrixId, actorUserId, "MEMBERSHIP_ROLE_CHANGED", "Membership", organizationId, {
    targetUserId,
    role,
  });
  return { ok: true as const };
}

export async function resellerRemoveMembership(
  activeOrganizationId: string,
  actorUserId: string,
  organizationId: string,
  targetUserId: string
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const orgIds = await ecosystemOrganizationIds(matrixId);
  if (!orgIds.includes(organizationId)) {
    throw new Error("Empresa fora do ecossistema");
  }
  const result = await removeMember(organizationId, actorUserId, targetUserId);
  if (!result.ok) {
    throw new Error(result.message);
  }
  await appendResellerAudit(matrixId, actorUserId, "MEMBERSHIP_REMOVED", "Membership", organizationId, {
    targetUserId,
  });
  return { ok: true as const };
}

export async function resellerMoveMembership(
  activeOrganizationId: string,
  actorUserId: string,
  targetUserId: string,
  fromOrganizationId: string,
  toOrganizationId: string
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const orgIds = await ecosystemOrganizationIds(matrixId);
  if (!orgIds.includes(fromOrganizationId) || !orgIds.includes(toOrganizationId)) {
    throw new Error("Empresa fora do ecossistema");
  }
  if (fromOrganizationId === toOrganizationId) {
    throw new Error("Origem e destino iguais");
  }

  const fromMem = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId: fromOrganizationId } },
  });
  if (!fromMem) {
    throw new Error("Usuário não é membro da empresa de origem");
  }

  const existingTo = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId: toOrganizationId } },
  });
  if (existingTo) {
    throw new Error("Usuário já é membro da empresa destino");
  }

  await prisma.$transaction([
    prisma.membership.delete({ where: { id: fromMem.id } }),
    prisma.membership.create({
      data: {
        userId: targetUserId,
        organizationId: toOrganizationId,
        role: fromMem.role === "owner" ? "admin" : fromMem.role,
      },
    }),
  ]);

  await appendResellerAudit(matrixId, actorUserId, "MEMBERSHIP_MOVED", "User", targetUserId, {
    fromOrganizationId,
    toOrganizationId,
    previousRole: fromMem.role,
  });

  return { ok: true as const };
}

export async function resellerLogEnterChild(
  activeOrganizationId: string,
  actorUserId: string,
  childOrganizationId: string
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const child = await prisma.organization.findFirst({
    where: { id: childOrganizationId, parentOrganizationId: matrixId, deletedAt: null },
  });
  if (!child) {
    throw new Error("Empresa filha não encontrada");
  }
  await appendResellerAudit(matrixId, actorUserId, "ADMIN_ENTER_CHILD_ORG", "Organization", childOrganizationId, {
    childName: child.name,
  });
  return { ok: true as const };
}

export async function resellerListAuditLogs(activeOrganizationId: string, userId: string, limit: number) {
  const matrixId = await resolveResellerMatrixOrganizationId(userId, activeOrganizationId);
  const rows = await prisma.resellerAuditLog.findMany({
    where: { matrixOrgId: matrixId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    metadata: r.metadata,
    actorUserId: r.actorUserId,
    createdAt: r.createdAt.toISOString(),
  }));
}
