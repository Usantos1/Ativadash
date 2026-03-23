import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { appendResellerAudit } from "../utils/reseller-audit.js";
import { assertDirectOrgAdmin } from "./auth.service.js";
import {
  collectDescendantOrganizationIds,
  createDescendantByMatrixAdmin,
  type OrganizationClientProfile,
  getOrganizationContext,
  isOrganizationUnderMatrix,
  listChildOrganizationsOperationsDashboard,
  updateDescendantByMatrixAdmin,
  updateOrganizationPlanSettings,
} from "./organizations.service.js";
import {
  createPlan,
  deletePlan,
  duplicatePlan as platformDuplicatePlan,
  getLimitsOverride,
  listPlans,
  putLimitsOverride,
  updatePlan,
  updateSubscriptionForOrganization,
} from "./platform.service.js";
import { createInvitation } from "./invitations.service.js";
import { assertCanAddDirectMemberOrInvitation } from "./plan-limits.service.js";
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
  let walk: string | null = activeOrganizationId;
  for (let i = 0; i < 32 && walk; i++) {
    const row: { id: string; parentOrganizationId: string | null } | null = await prisma.organization.findFirst({
      where: { id: walk, deletedAt: null },
      select: { id: true, parentOrganizationId: true },
    });
    if (!row) {
      throw new Error("Organização não encontrada");
    }
    if (row.parentOrganizationId === null) {
      await assertDirectOrgAdmin(userId, row.id);
      return row.id;
    }
    walk = row.parentOrganizationId;
  }
  throw new Error("Hierarquia de organizações inválida ou muito profunda");
}

async function ecosystemOrganizationIds(matrixId: string): Promise<string[]> {
  return collectDescendantOrganizationIds(matrixId);
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
    parentOrganizationId?: string;
    inheritPlanFromParent?: boolean;
    planId?: string | null;
    workspaceNote?: string | null;
    resellerOrgKind?: "AGENCY" | "CLIENT";
    legalName?: string | null;
    taxId?: string;
    phoneWhatsapp?: string;
    ownerEmail?: string;
    ownerName?: string;
    ownerPassword?: string;
    addressLine1?: string;
    addressNumber?: string;
    addressDistrict?: string;
    addressCity?: string;
    addressState?: string;
    addressPostalCode?: string;
  }
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const parentId = data.parentOrganizationId ?? matrixId;
  const kind = data.resellerOrgKind ?? "CLIENT";

  let clientProfile: OrganizationClientProfile | null = null;
  let initialOwner: { email: string; name: string; passwordHash: string } | null = null;

  if (kind !== "AGENCY") {
    const email = (data.ownerEmail ?? "").trim().toLowerCase();
    const password = data.ownerPassword ?? "";
    clientProfile = {
      legalName: data.legalName?.trim() ? data.legalName.trim() : null,
      taxId: (data.taxId ?? "").replace(/\D/g, "") || null,
      contactEmail: email || null,
      phoneWhatsapp: (data.phoneWhatsapp ?? "").replace(/\D/g, "") || null,
      addressLine1: (data.addressLine1 ?? "").trim() || null,
      addressNumber: (data.addressNumber ?? "").trim() || null,
      addressDistrict: data.addressDistrict?.trim() ? data.addressDistrict.trim() : null,
      addressCity: (data.addressCity ?? "").trim() || null,
      addressState: (data.addressState ?? "").trim().toUpperCase() || null,
      addressPostalCode: (data.addressPostalCode ?? "").replace(/\D/g, "") || null,
    };
    initialOwner = {
      email,
      name: (data.ownerName ?? "").trim(),
      passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    };
  }

  const org = await createDescendantByMatrixAdmin(matrixId, actorUserId, parentId, data.name, {
    inheritPlanFromParent: data.inheritPlanFromParent,
    planId: data.planId,
    workspaceNote: data.workspaceNote,
    resellerOrgKind: data.resellerOrgKind,
    clientProfile,
    initialOwner,
  });
  await appendResellerAudit(matrixId, actorUserId, "CHILD_ORG_CREATED", "Organization", org.id, {
    name: data.name,
    resellerOrgKind: org.resellerOrgKind ?? "CLIENT",
    parentOrganizationId: parentId,
    hasInitialOwner: kind !== "AGENCY",
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
  if (childId === matrixId) {
    throw new Error("Use as configurações da empresa para alterar a matriz");
  }
  const under = await isOrganizationUnderMatrix(childId, matrixId);
  if (!under) {
    throw new Error("Empresa fora do ecossistema");
  }

  const hasOrgScalar =
    body.name !== undefined ||
    body.workspaceStatus !== undefined ||
    body.workspaceNote !== undefined ||
    body.resellerOrgKind !== undefined ||
    body.featureOverrides !== undefined;

  if (hasOrgScalar) {
    await updateDescendantByMatrixAdmin(matrixId, actorUserId, childId, {
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

export async function resellerSoftDeleteChild(
  activeOrganizationId: string,
  actorUserId: string,
  childId: string
): Promise<void> {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  if (childId === matrixId) {
    throw new Error("Não é possível excluir a matriz");
  }
  const under = await isOrganizationUnderMatrix(childId, matrixId);
  if (!under) {
    throw new Error("Empresa fora do ecossistema");
  }
  await assertDirectOrgAdmin(actorUserId, matrixId);
  const children = await prisma.organization.count({
    where: { parentOrganizationId: childId, deletedAt: null },
  });
  if (children > 0) {
    throw new Error("Remova ou exclua empresas vinculadas a esta organização antes");
  }
  await prisma.organization.update({
    where: { id: childId },
    data: { deletedAt: new Date(), workspaceStatus: "ARCHIVED" },
  });
  await appendResellerAudit(matrixId, actorUserId, "CHILD_ORG_SOFT_DELETED", "Organization", childId, {});
}

/**
 * Torna a empresa uma organização raiz (sem matriz): some do painel de revenda da Prime Camp
 * e passa a ter painel próprio; membros diretos mantêm acesso. Requer que não haja filiais.
 */
export async function resellerDetachChildAsStandalone(
  activeOrganizationId: string,
  actorUserId: string,
  childId: string
): Promise<{ id: string; name: string; slug: string }> {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  if (childId === matrixId) {
    throw new Error("Não é possível desvincular a matriz");
  }
  const under = await isOrganizationUnderMatrix(childId, matrixId);
  if (!under) {
    throw new Error("Empresa fora do ecossistema");
  }
  await assertDirectOrgAdmin(actorUserId, matrixId);

  const child = await prisma.organization.findFirst({
    where: { id: childId, deletedAt: null },
    select: { id: true, name: true, slug: true },
  });
  if (!child) {
    throw new Error("Empresa não encontrada");
  }

  const subCount = await prisma.organization.count({
    where: { parentOrganizationId: childId, deletedAt: null },
  });
  if (subCount > 0) {
    throw new Error(
      "Esta empresa possui filiais vinculadas. Transfira ou exclua-as antes de desvincular."
    );
  }

  const updated = await prisma.organization.update({
    where: { id: childId },
    data: {
      parentOrganizationId: null,
      inheritPlanFromParent: false,
      resellerOrgKind: null,
    },
    select: { id: true, name: true, slug: true },
  });

  await appendResellerAudit(matrixId, actorUserId, "CHILD_ORG_DETACHED_STANDALONE", "Organization", childId, {
    name: child.name,
  });

  return updated;
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
  newPassword: string,
  options?: { forcePasswordChange?: boolean }
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const orgIds = await ecosystemOrganizationIds(matrixId);
  const inEco = await prisma.membership.findFirst({
    where: { userId: targetUserId, organizationId: { in: orgIds } },
  });
  if (!inEco) {
    throw new Error("Usuário fora do ecossistema");
  }

  const forceNext = options?.forcePasswordChange !== false;
  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { password: hashed, mustChangePassword: forceNext },
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
  if (childOrganizationId === matrixId) {
    throw new Error("Já está no contexto da matriz");
  }
  const under = await isOrganizationUnderMatrix(childOrganizationId, matrixId);
  if (!under) {
    throw new Error("Empresa fora do ecossistema");
  }
  const child = await prisma.organization.findFirst({
    where: { id: childOrganizationId, deletedAt: null },
    select: { name: true },
  });
  await appendResellerAudit(matrixId, actorUserId, "ADMIN_ENTER_CHILD_ORG", "Organization", childOrganizationId, {
    childName: child?.name ?? "",
  });
  return { ok: true as const };
}

export async function resellerListAuditLogs(
  activeOrganizationId: string,
  userId: string,
  opts: {
    limit: number;
    action?: string;
    entityType?: string;
    actorUserId?: string;
    from?: Date;
    to?: Date;
  }
) {
  const matrixId = await resolveResellerMatrixOrganizationId(userId, activeOrganizationId);
  const where: Prisma.ResellerAuditLogWhereInput = { matrixOrgId: matrixId };
  if (opts.action) where.action = opts.action;
  if (opts.entityType) where.entityType = opts.entityType;
  if (opts.actorUserId) where.actorUserId = opts.actorUserId;
  if (opts.from || opts.to) {
    where.createdAt = {};
    if (opts.from) where.createdAt.gte = opts.from;
    if (opts.to) where.createdAt.lte = opts.to;
  }
  const rows = await prisma.resellerAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: opts.limit,
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

export async function resellerListEcosystemOrganizations(activeOrganizationId: string, userId: string) {
  const matrixId = await resolveResellerMatrixOrganizationId(userId, activeOrganizationId);
  const ids = await ecosystemOrganizationIds(matrixId);
  const rows = await prisma.organization.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      parentOrganizationId: true,
      workspaceStatus: true,
      resellerOrgKind: true,
      inheritPlanFromParent: true,
      planId: true,
      createdAt: true,
      plan: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ parentOrganizationId: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    parentOrganizationId: r.parentOrganizationId,
    workspaceStatus: r.workspaceStatus,
    resellerOrgKind: r.resellerOrgKind,
    inheritPlanFromParent: r.inheritPlanFromParent,
    planId: r.planId,
    plan: r.plan,
    createdAt: r.createdAt.toISOString(),
    isMatrix: r.id === matrixId,
  }));
}

export async function resellerGetChildDetail(activeOrganizationId: string, userId: string, childId: string) {
  const matrixId = await resolveResellerMatrixOrganizationId(userId, activeOrganizationId);
  if (childId === matrixId) {
    throw new Error("Use o contexto da organização para a matriz");
  }
  const under = await isOrganizationUnderMatrix(childId, matrixId);
  if (!under) {
    throw new Error("Empresa fora do ecossistema");
  }
  const ctx = await getOrganizationContext(childId, userId);
  const ov = await getLimitsOverride(childId);
  return { context: ctx, limitsOverride: ov };
}

export async function resellerListAllPlans(activeOrganizationId: string, userId: string) {
  await resolveResellerMatrixOrganizationId(userId, activeOrganizationId);
  return listPlans();
}

export async function resellerCreatePlan(
  activeOrganizationId: string,
  actorUserId: string,
  data: Parameters<typeof createPlan>[0]
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const plan = await createPlan(data);
  await appendResellerAudit(matrixId, actorUserId, "PLAN_CREATED", "Plan", plan.id, { slug: plan.slug });
  return plan;
}

export async function resellerUpdatePlan(
  activeOrganizationId: string,
  actorUserId: string,
  planId: string,
  data: Parameters<typeof updatePlan>[1]
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const plan = await updatePlan(planId, data);
  await appendResellerAudit(matrixId, actorUserId, "PLAN_UPDATED", "Plan", planId, {});
  return plan;
}

export async function resellerDeletePlan(activeOrganizationId: string, actorUserId: string, planId: string) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  await deletePlan(planId);
  await appendResellerAudit(matrixId, actorUserId, "PLAN_DELETED", "Plan", planId, {});
}

export async function resellerDuplicatePlan(
  activeOrganizationId: string,
  actorUserId: string,
  sourcePlanId: string,
  newSlug: string,
  newName: string
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const plan = await platformDuplicatePlan(sourcePlanId, newSlug, newName);
  await appendResellerAudit(matrixId, actorUserId, "PLAN_DUPLICATED", "Plan", plan.id, { from: sourcePlanId });
  return plan;
}

export async function resellerCreateUserWithMembership(
  activeOrganizationId: string,
  actorUserId: string,
  data: { email: string; name: string; password: string; organizationId: string; role: string }
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const orgIds = await ecosystemOrganizationIds(matrixId);
  if (!orgIds.includes(data.organizationId)) {
    throw new Error("Empresa fora do ecossistema");
  }
  const norm = data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: norm } });
  if (existing) {
    throw new Error("Já existe usuário com este e-mail");
  }
  await assertCanAddDirectMemberOrInvitation(data.organizationId);

  const hashed = await bcrypt.hash(data.password, SALT_ROUNDS);
  const role = data.role.trim();
  const allowed = new Set(["owner", "admin", "member", "media_manager", "analyst"]);
  if (!allowed.has(role)) {
    throw new Error("Papel inválido");
  }

  const user = await prisma.user.create({
    data: {
      email: norm,
      name: data.name.trim(),
      password: hashed,
      mustChangePassword: true,
    },
  });
  await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: data.organizationId,
      role,
    },
  });

  await appendResellerAudit(matrixId, actorUserId, "USER_CREATED", "User", user.id, {
    organizationId: data.organizationId,
    role,
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function resellerCreateInvitation(
  activeOrganizationId: string,
  actorUserId: string,
  organizationId: string,
  email: string,
  role: string
) {
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const orgIds = await ecosystemOrganizationIds(matrixId);
  if (!orgIds.includes(organizationId)) {
    throw new Error("Empresa fora do ecossistema");
  }
  const out = await createInvitation(organizationId, actorUserId, email, role);
  await appendResellerAudit(matrixId, actorUserId, "INVITATION_CREATED", "Invitation", out.invitation.id, {
    organizationId,
    email: out.invitation.email,
  });
  return out;
}
