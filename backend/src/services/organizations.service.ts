import type { ResellerOrgKind, WorkspaceStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { getRootResellerPartnerFlag } from "../utils/org-hierarchy.js";
import { computeMatrizNavEligible } from "../utils/matriz-nav-eligible.js";
import { isPlatformAdminEmail } from "../utils/platform-admin.js";
import { slugifyOrganizationName, uniqueOrganizationSlug } from "../utils/org-slug.js";
import { assertDirectOrgAdmin, assertOrgAdminOrParentAgency, canManageOrganization } from "./auth.service.js";
import { isResellerMatrixAdminRole, isWorkspaceAdminRole } from "../constants/roles.js";
import { teamAccessLevelToRole } from "../constants/team-job-titles.js";
import { userHasEffectiveAccess } from "./tenancy-access.service.js";
import {
  assertCanAddChildOrganization,
  getOrganizationPlanContext,
  resolveBillingOrganizationId,
  resolveEffectivePlan,
} from "./plan-limits.service.js";
import { mergePlanFeaturesWithOverrides } from "../utils/plan-features.js";
import { syncSubscriptionFromOrgPlan } from "./platform.service.js";
import { appendAuditLog } from "./audit-log.service.js";
import { rollupMarketing30dForChildren, type ChildMarketingRollup30d } from "./child-workspace-marketing-rollup.service.js";

/** Raiz autorizada a revenda (painel matriz, APIs /reseller, filhos). Platform admin ignora. */
export async function assertRootMayResellPlans(rootOrganizationId: string, actorUserId: string): Promise<void> {
  const actor = await prisma.user.findFirst({
    where: { id: actorUserId, deletedAt: null },
    select: { email: true },
  });
  if (actor?.email && isPlatformAdminEmail(actor.email)) return;
  const row = await prisma.organization.findFirst({
    where: { id: rootOrganizationId, deletedAt: null, parentOrganizationId: null },
    select: { resellerPartner: true },
  });
  if (!row) {
    throw new Error("Organização raiz não encontrada");
  }
  if (!row.resellerPartner) {
    throw new Error(
      "Esta conta não está habilitada para revenda de planos e gestão de agências. Entre em contato com a Ativa Dash."
    );
  }
}

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

  const enabledFeatures = mergePlanFeaturesWithOverrides(templatePlan, org.featureOverrides);
  const rootResellerPartner = await getRootResellerPartnerFlag(organizationId);
  const actor = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { email: true },
  });
  const matrizNavEligible = actor?.email
    ? await computeMatrizNavEligible(organizationId, actor.email)
    : false;

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    featureOverrides: org.featureOverrides ?? null,
    parentOrganization: org.parentOrganization,
    plan: planContext.plan,
    planSource: planContext.planSource,
    limits: planContext.limits,
    limitsHaveOverrides: planContext.limitsHaveOverrides,
    usage: planContext.usage,
    subscription,
    enabledFeatures,
    rootResellerPartner,
    matrizNavEligible,
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
  const { visibleIds } = await resolveVisibleChildOrganizationIds(organizationId, userId);
  if (visibleIds.length === 0) return [];
  return prisma.organization.findMany({
    where: { id: { in: visibleIds }, deletedAt: null },
    select: { id: true, name: true, slug: true, createdAt: true },
    orderBy: { name: "asc" },
  });
}

export async function createChildOrganization(
  parentOrganizationId: string,
  userId: string,
  name: string,
  options?: {
    inheritPlanFromParent?: boolean;
    planId?: string | null;
    workspaceNote?: string | null;
    resellerOrgKind?: ResellerOrgKind;
  }
) {
  await assertDirectOrgAdmin(userId, parentOrganizationId);
  await assertCanAddChildOrganization(parentOrganizationId, userId);
  const inherit = options?.inheritPlanFromParent !== false;
  const parent = await prisma.organization.findFirst({
    where: { id: parentOrganizationId, deletedAt: null },
    select: { planId: true },
  });
  const slug = await uniqueOrganizationSlug(slugifyOrganizationName(name));
  const planId = inherit ? (parent?.planId ?? null) : (options?.planId ?? null);
  const note = options?.workspaceNote?.trim();
  const org = await prisma.organization.create({
    data: {
      name: name.trim(),
      slug,
      parentOrganizationId,
      inheritPlanFromParent: inherit,
      planId,
      workspaceNote: note && note.length > 0 ? note : null,
      resellerOrgKind: options?.resellerOrgKind ?? "CLIENT",
      organizationKind: "CLIENT_WORKSPACE",
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
    workspaceStatus: org.workspaceStatus,
    workspaceNote: org.workspaceNote,
    resellerOrgKind: org.resellerOrgKind,
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

export async function updateChildOrganizationByParent(
  parentOrganizationId: string,
  userId: string,
  childId: string,
  data: {
    name?: string;
    workspaceStatus?: WorkspaceStatus;
    workspaceNote?: string | null;
    resellerOrgKind?: ResellerOrgKind;
    featureOverrides?: Record<string, boolean> | null;
  }
) {
  await assertDirectOrgAdmin(userId, parentOrganizationId);
  const child = await prisma.organization.findFirst({
    where: { id: childId, parentOrganizationId, deletedAt: null },
  });
  if (!child) {
    throw new Error("Workspace filho não encontrado");
  }
  const patch: Prisma.OrganizationUpdateInput = {};
  if (data.name !== undefined) {
    patch.name = data.name.trim();
  }
  if (data.workspaceStatus !== undefined) {
    patch.workspaceStatus = data.workspaceStatus;
  }
  if (data.workspaceNote !== undefined) {
    const n = data.workspaceNote?.trim();
    patch.workspaceNote = n && n.length > 0 ? n : null;
  }
  if (data.resellerOrgKind !== undefined) {
    patch.resellerOrgKind = data.resellerOrgKind;
  }
  if (data.featureOverrides !== undefined) {
    // JsonNull (não DbNull): compatível com OrganizationUpdateInput em todas as versões do client gerado.
    patch.featureOverrides =
      data.featureOverrides === null ? Prisma.JsonNull : (data.featureOverrides as Prisma.InputJsonValue);
  }
  const updated = await prisma.organization.update({
    where: { id: childId },
    data: patch,
    select: {
      id: true,
      name: true,
      slug: true,
      inheritPlanFromParent: true,
      workspaceStatus: true,
      workspaceNote: true,
      resellerOrgKind: true,
      featureOverrides: true,
      createdAt: true,
    },
  });
  return updated;
}

export async function softDeleteChildOrganization(
  parentOrganizationId: string,
  userId: string,
  childId: string
) {
  await assertDirectOrgAdmin(userId, parentOrganizationId);
  const child = await prisma.organization.findFirst({
    where: { id: childId, parentOrganizationId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!child) {
    throw new Error("Workspace filho não encontrado");
  }
  await prisma.organization.update({
    where: { id: childId },
    data: { deletedAt: new Date(), workspaceStatus: "ARCHIVED" },
  });
  return { id: child.id, name: child.name };
}

/** Verifica se `orgId` é a própria matriz ou um descendente na hierarquia. */
export async function isOrganizationUnderMatrix(orgId: string, matrixId: string): Promise<boolean> {
  let walk: string | null = orgId;
  for (let i = 0; i < 32 && walk; i++) {
    if (walk === matrixId) return true;
    const parentLink: { parentOrganizationId: string | null } | null = await prisma.organization.findFirst({
      where: { id: walk, deletedAt: null },
      select: { parentOrganizationId: true },
    });
    walk = parentLink?.parentOrganizationId ?? null;
  }
  return false;
}

/** Matriz + todos os descendentes (BFS). */
export async function collectDescendantOrganizationIds(matrixId: string): Promise<string[]> {
  const seen = new Set<string>([matrixId]);
  let frontier = [matrixId];
  for (let d = 0; d < 32 && frontier.length > 0; d++) {
    const children = await prisma.organization.findMany({
      where: { parentOrganizationId: { in: frontier }, deletedAt: null },
      select: { id: true },
    });
    frontier = [];
    for (const c of children) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        frontier.push(c.id);
      }
    }
  }
  return [...seen];
}

/** Admin da agência (contexto JWT = parent): vê e gere todos os workspaces na subárvore. */
export async function isParentAgencyAdminUser(userId: string, parentOrganizationId: string): Promise<boolean> {
  const m = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: parentOrganizationId } },
  });
  if (!m) return false;
  return isResellerMatrixAdminRole(m.role) || isWorkspaceAdminRole(m.role);
}

export async function assertCanViewAgencyChildrenDashboard(
  userId: string,
  parentOrganizationId: string
): Promise<void> {
  const allowed = await userHasEffectiveAccess(userId, parentOrganizationId);
  if (!allowed) {
    throw new Error("Sem acesso a esta empresa");
  }
}

/**
 * Descendentes do parent visíveis ao utilizador: admin vê toda a subárvore;
 * Operador/Viewer só workspaces onde tem `Membership` ativa.
 */
export async function resolveVisibleChildOrganizationIds(
  parentOrganizationId: string,
  userId: string
): Promise<{ visibleIds: string[]; isAgencyAdmin: boolean }> {
  await assertCanViewAgencyChildrenDashboard(userId, parentOrganizationId);
  const subtree = await collectDescendantOrganizationIds(parentOrganizationId);
  const candidateIds = subtree.filter((id) => id !== parentOrganizationId);
  const isAgencyAdmin = await isParentAgencyAdminUser(userId, parentOrganizationId);
  if (isAgencyAdmin) {
    return { visibleIds: candidateIds, isAgencyAdmin: true };
  }
  const mem = await prisma.membership.findMany({
    where: { userId, organizationId: { in: candidateIds } },
    select: { organizationId: true },
  });
  return {
    visibleIds: [...new Set(mem.map((x) => x.organizationId))],
    isAgencyAdmin: false,
  };
}

/**
 * Contexto JWT em `managerOrganizationId`: `target` deve ser a própria org ou um descendente
 * (ex.: agência/matriz gerindo workspace cliente sem trocar de empresa no token).
 */
export async function assertManagedDescendantOrganization(
  managerOrganizationId: string,
  targetOrganizationId: string
): Promise<void> {
  if (targetOrganizationId === managerOrganizationId) return;
  const descendants = await collectDescendantOrganizationIds(managerOrganizationId);
  if (!descendants.includes(targetOrganizationId)) {
    throw new Error("Empresa fora da hierarquia que você gerencia");
  }
}

/** Dados fiscais/contato/endereço da empresa cliente (revenda). */
export type OrganizationClientProfile = {
  legalName?: string | null;
  taxId?: string | null;
  contactEmail?: string | null;
  phoneWhatsapp?: string | null;
  addressLine1?: string | null;
  addressNumber?: string | null;
  addressDistrict?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostalCode?: string | null;
};

/**
 * Admin da matriz cria workspace cliente como filho direto da matriz (sem agência intermediária).
 */
export async function createDescendantByMatrixAdmin(
  matrixOrganizationId: string,
  actorUserId: string,
  parentOrganizationId: string,
  name: string,
  options?: {
    inheritPlanFromParent?: boolean;
    planId?: string | null;
    workspaceNote?: string | null;
    resellerOrgKind?: ResellerOrgKind;
    clientProfile?: OrganizationClientProfile | null;
    initialOwner?: { email: string; name: string; passwordHash: string } | null;
  }
) {
  await assertDirectOrgAdmin(actorUserId, matrixOrganizationId);
  await assertRootMayResellPlans(matrixOrganizationId, actorUserId);
  const matrixRow = await prisma.organization.findFirst({
    where: { id: matrixOrganizationId, deletedAt: null },
    select: { organizationKind: true },
  });
  if (matrixRow?.organizationKind !== "MATRIX" && matrixRow?.organizationKind !== "DIRECT") {
    throw new Error("Operação válida apenas para a empresa raiz (matriz ou conta principal)");
  }

  const parentOk = await isOrganizationUnderMatrix(parentOrganizationId, matrixOrganizationId);
  if (!parentOk) {
    throw new Error("Organização pai fora do ecossistema");
  }

  const parent = await prisma.organization.findFirst({
    where: { id: parentOrganizationId, deletedAt: null },
    select: { planId: true, resellerOrgKind: true, parentOrganizationId: true },
  });
  if (!parent) {
    throw new Error("Organização pai não encontrada");
  }

  const requestedKind: ResellerOrgKind = options?.resellerOrgKind ?? "CLIENT";
  if (requestedKind === "AGENCY") {
    if (parentOrganizationId !== matrixOrganizationId) {
      throw new Error("Agências devem ser criadas diretamente sob a matriz");
    }
  } else if (parentOrganizationId !== matrixOrganizationId) {
    if (parent.resellerOrgKind !== "AGENCY") {
      throw new Error("Empresas cliente só podem ser vinculadas à matriz ou a uma agência");
    }
  }

  const resellerOrgKind: ResellerOrgKind = requestedKind;

  await assertCanAddChildOrganization(parentOrganizationId, actorUserId);

  const inherit = options?.inheritPlanFromParent !== false;
  const planId = inherit ? (parent.planId ?? null) : (options?.planId ?? null);
  const note = options?.workspaceNote?.trim();
  const slug = await uniqueOrganizationSlug(slugifyOrganizationName(name));

  const cp = options?.clientProfile;
  const orgScalarData = {
    name: name.trim(),
    slug,
    parentOrganizationId,
    inheritPlanFromParent: inherit,
    planId,
    workspaceNote: note && note.length > 0 ? note : null,
    organizationKind: "CLIENT_WORKSPACE" as const,
    resellerOrgKind,
    legalName: cp?.legalName ?? null,
    taxId: cp?.taxId ?? null,
    contactEmail: cp?.contactEmail ?? null,
    phoneWhatsapp: cp?.phoneWhatsapp ?? null,
    addressLine1: cp?.addressLine1 ?? null,
    addressNumber: cp?.addressNumber ?? null,
    addressDistrict: cp?.addressDistrict ?? null,
    addressCity: cp?.addressCity ?? null,
    addressState: cp?.addressState ?? null,
    addressPostalCode: cp?.addressPostalCode ?? null,
  };

  const initialOwner = options?.initialOwner;

  const mapReturn = (org: {
    id: string;
    name: string;
    slug: string;
    inheritPlanFromParent: boolean;
    planId: string | null;
    workspaceStatus: WorkspaceStatus;
    workspaceNote: string | null;
    resellerOrgKind: ResellerOrgKind | null;
    parentOrganizationId: string | null;
  }) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    inheritPlanFromParent: org.inheritPlanFromParent,
    planId: org.planId,
    workspaceStatus: org.workspaceStatus,
    workspaceNote: org.workspaceNote,
    resellerOrgKind: org.resellerOrgKind,
    parentOrganizationId: org.parentOrganizationId,
  });

  if (initialOwner) {
    const norm = initialOwner.email.trim().toLowerCase();
    const dup = await prisma.user.findUnique({ where: { email: norm } });
    if (dup) {
      throw new Error("Já existe usuário com este e-mail");
    }

    const org = await prisma.$transaction(async (tx) => {
      const o = await tx.organization.create({ data: orgScalarData });
      const user = await tx.user.create({
        data: {
          email: norm,
          name: initialOwner.name.trim(),
          password: initialOwner.passwordHash,
          mustChangePassword: true,
        },
      });
      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: o.id,
          role: resellerOrgKind === "AGENCY" ? "agency_owner" : "workspace_owner",
        },
      });
      return o;
    });

    if (!inherit && planId) {
      await syncSubscriptionFromOrgPlan(org.id);
    }
    return mapReturn(org);
  }

  const org = await prisma.organization.create({ data: orgScalarData });
  if (!inherit && planId) {
    await syncSubscriptionFromOrgPlan(org.id);
  }
  return mapReturn(org);
}

/** Atualiza qualquer descendente da matriz (não exige ser filho direto). */
export async function updateDescendantByMatrixAdmin(
  matrixOrganizationId: string,
  actorUserId: string,
  descendantId: string,
  data: {
    name?: string;
    workspaceStatus?: WorkspaceStatus;
    workspaceNote?: string | null;
    resellerOrgKind?: ResellerOrgKind;
    featureOverrides?: Record<string, boolean> | null;
  }
) {
  await assertDirectOrgAdmin(actorUserId, matrixOrganizationId);
  if (descendantId === matrixOrganizationId) {
    throw new Error("Altere a matriz em Configurações da empresa");
  }
  const under = await isOrganizationUnderMatrix(descendantId, matrixOrganizationId);
  if (!under) {
    throw new Error("Organização fora do ecossistema");
  }
  const child = await prisma.organization.findFirst({
    where: { id: descendantId, deletedAt: null },
  });
  if (!child) {
    throw new Error("Organização não encontrada");
  }
  const previousWorkspaceStatus = child.workspaceStatus;

  const patch: Prisma.OrganizationUpdateInput = {};
  if (data.name !== undefined) {
    patch.name = data.name.trim();
  }
  if (data.workspaceStatus !== undefined) {
    patch.workspaceStatus = data.workspaceStatus;
  }
  if (data.workspaceNote !== undefined) {
    const n = data.workspaceNote?.trim();
    patch.workspaceNote = n && n.length > 0 ? n : null;
  }
  if (data.resellerOrgKind !== undefined) {
    patch.resellerOrgKind = data.resellerOrgKind;
  }
  if (data.featureOverrides !== undefined) {
    patch.featureOverrides =
      data.featureOverrides === null ? Prisma.JsonNull : (data.featureOverrides as Prisma.InputJsonValue);
  }

  const updated = await prisma.organization.update({
    where: { id: descendantId },
    data: patch,
    select: {
      id: true,
      name: true,
      slug: true,
      parentOrganizationId: true,
      inheritPlanFromParent: true,
      workspaceStatus: true,
      workspaceNote: true,
      resellerOrgKind: true,
      featureOverrides: true,
      planId: true,
      createdAt: true,
    },
  });

  if (
    data.workspaceStatus === "ARCHIVED" &&
    previousWorkspaceStatus !== "ARCHIVED"
  ) {
    await appendAuditLog({
      actorUserId,
      organizationId: descendantId,
      action: "matrix.workspace.archived",
      entityType: "Organization",
      entityId: descendantId,
      metadata: {
        matrixOrganizationId,
        previousWorkspaceStatus,
      },
    });
  }

  return updated;
}

function maxDate(...dates: (Date | null | undefined)[]): Date | null {
  const valid = dates.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid.map((d) => d.getTime())));
}

const STALE_ACTIVITY_DAYS = 14;
const NEVER_USED_DAYS = 7;

/** Alerta CPL (30d) vs meta — alinhado ao portfolio dashboard. */
export type AgencyPortfolioAlertLevel = "CRITICAL" | "WARNING" | "HEALTHY" | "PENDING" | "NO_METRICS";

function fmtBrlPortfolio(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

/**
 * Compara CPL atual (rollup 30d) com meta em MarketingSettings.targetCpaBrl.
 */
export function computeAgencyPortfolioCplAlert(
  targetCpaBrl: number | null,
  cpl: number | null
): { alertLevel: AgencyPortfolioAlertLevel; alertDetail: string | null } {
  if (targetCpaBrl == null || targetCpaBrl <= 0 || !Number.isFinite(targetCpaBrl)) {
    return {
      alertLevel: "PENDING",
      alertDetail:
        "Defina a meta de CPL (CPA alvo) em Configurações → Marketing do workspace do cliente para ativar alertas.",
    };
  }
  const target = targetCpaBrl;
  if (cpl == null || !Number.isFinite(cpl)) {
    return {
      alertLevel: "NO_METRICS",
      alertDetail: `Meta ${fmtBrlPortfolio(target)} — sem CPL nos últimos 30 dias (sem leads ou sem dados de mídia agregados).`,
    };
  }
  if (cpl <= target) {
    return {
      alertLevel: "HEALTHY",
      alertDetail: `CPL ${fmtBrlPortfolio(cpl)} está na meta ou abaixo (meta ${fmtBrlPortfolio(target)}).`,
    };
  }
  const pctAbove = ((cpl - target) / target) * 100;
  if (cpl > target * 1.2) {
    return {
      alertLevel: "CRITICAL",
      alertDetail: `CPL ${fmtBrlPortfolio(cpl)} está ${pctAbove.toFixed(0)}% acima da meta de ${fmtBrlPortfolio(target)} (limite crítico: +20%).`,
    };
  }
  return {
    alertLevel: "WARNING",
    alertDetail: `CPL ${fmtBrlPortfolio(cpl)} está ${pctAbove.toFixed(0)}% acima da meta de ${fmtBrlPortfolio(target)} (faixa de atenção: até +20%).`,
  };
}

export type ChildOrganizationOperationsAlert = {
  type: string;
  severity: "info" | "warning" | "critical";
  organizationId: string;
  name: string;
  message: string;
};

export async function listChildOrganizationsOperationsDashboard(
  parentOrganizationId: string,
  userId: string
): Promise<{
  parent: {
    plan: Awaited<ReturnType<typeof getOrganizationPlanContext>>["plan"];
    planSource: Awaited<ReturnType<typeof getOrganizationPlanContext>>["planSource"];
    limits: Awaited<ReturnType<typeof getOrganizationPlanContext>>["limits"];
    limitsHaveOverrides: Awaited<ReturnType<typeof getOrganizationPlanContext>>["limitsHaveOverrides"];
    usage: Awaited<ReturnType<typeof getOrganizationPlanContext>>["usage"];
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    parentOrganizationId: string | null;
    parentOrganization: { id: string; name: string } | null;
    createdAt: string;
    inheritPlanFromParent: boolean;
    workspaceStatus: WorkspaceStatus;
    workspaceNote: string | null;
    resellerOrgKind: ResellerOrgKind | null;
    planId: string | null;
    plan: { id: string; name: string; slug: string } | null;
    featureOverrides: unknown;
    subscription: {
      id: string;
      billingMode: string;
      status: string;
      renewsAt: string | null;
      startedAt: string;
      planId: string;
    } | null;
    limitsOverride: {
      maxUsers: number | null;
      maxIntegrations: number | null;
      maxDashboards: number | null;
      maxClientAccounts: number | null;
      maxChildOrganizations: number | null;
      notes: string | null;
    } | null;
    memberCount: number;
    pendingInvitationsCount: number;
    dashboardCount: number;
    connectedIntegrations: number;
    lastIntegrationSyncAt: string | null;
    lastActivityAt: string | null;
    staleActivity: boolean;
    neverAccessed: boolean;
    needsAttention: boolean;
    metaAdsConnected: boolean;
    googleAdsConnected: boolean;
    marketing30d: ChildMarketingRollup30d | null;
    clientAccountCount: number;
    projectCount: number;
    launchCount: number;
    activeLaunchCount: number;
    targetCpaBrl: number | null;
    cplAlertLevel: AgencyPortfolioAlertLevel;
    cplAlertDetail: string | null;
  }>;
  capabilities: {
    canCreateChildWorkspaces: boolean;
    canManageChildWorkspaceMembers: boolean;
    canPatchChildWorkspace: boolean;
  };
  summary: {
    totalWorkspaces: number;
    activeWorkspaces: number;
    pausedWorkspaces: number;
    archivedWorkspaces: number;
    withoutIntegration: number;
    withoutMembers: number;
    staleActivityCount: number;
    integrationsTotalAcrossChildren: number;
    usersTotalAcrossChildren: number;
    dashboardsTotalAcrossChildren: number;
    childSlotsUsed: number;
    childSlotsCap: number | null;
    childrenWithActiveLaunches: number;
    totalProjectsAcrossChildren: number;
    totalLaunchesAcrossChildren: number;
  };
  alerts: ChildOrganizationOperationsAlert[];
}> {
  const { visibleIds, isAgencyAdmin } = await resolveVisibleChildOrganizationIds(
    parentOrganizationId,
    userId
  );
  const planContext = await getOrganizationPlanContext(parentOrganizationId);

  const children =
    visibleIds.length === 0
      ? []
      : await prisma.organization.findMany({
          where: { id: { in: visibleIds }, deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            parentOrganizationId: true,
            parentOrganization: { select: { id: true, name: true } },
            createdAt: true,
            updatedAt: true,
            inheritPlanFromParent: true,
            workspaceStatus: true,
            workspaceNote: true,
            resellerOrgKind: true,
            planId: true,
            featureOverrides: true,
            plan: { select: { id: true, name: true, slug: true } },
            subscription: {
              select: {
                id: true,
                billingMode: true,
                status: true,
                renewsAt: true,
                startedAt: true,
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
                notes: true,
              },
            },
          },
          orderBy: { name: "asc" },
        });

  const childIds = children.map((c) => c.id);
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_ACTIVITY_DAYS * 864e5);

  if (childIds.length === 0) {
    const cap = planContext.limits.maxChildOrganizations;
    return {
      parent: {
        plan: planContext.plan,
        planSource: planContext.planSource,
        limits: planContext.limits,
        limitsHaveOverrides: planContext.limitsHaveOverrides,
        usage: planContext.usage,
      },
      organizations: [],
      capabilities: {
        canCreateChildWorkspaces: isAgencyAdmin,
        canManageChildWorkspaceMembers: isAgencyAdmin,
        canPatchChildWorkspace: isAgencyAdmin,
      },
      summary: {
        totalWorkspaces: 0,
        activeWorkspaces: 0,
        pausedWorkspaces: 0,
        archivedWorkspaces: 0,
        withoutIntegration: 0,
        withoutMembers: 0,
        staleActivityCount: 0,
        integrationsTotalAcrossChildren: 0,
        usersTotalAcrossChildren: 0,
        dashboardsTotalAcrossChildren: 0,
        childSlotsUsed: planContext.usage.childOrganizations,
        childSlotsCap: cap,
        childrenWithActiveLaunches: 0,
        totalProjectsAcrossChildren: 0,
        totalLaunchesAcrossChildren: 0,
      },
      alerts: [],
    };
  }

  const [clientAccGroups, projectGroups, projectsForLaunches] = await Promise.all([
    prisma.clientAccount.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: childIds }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.project.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: childIds }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.project.findMany({
      where: { organizationId: { in: childIds }, deletedAt: null },
      select: { id: true, organizationId: true },
    }),
  ]);

  const projectIds = projectsForLaunches.map((p) => p.id);
  const launchRowsForAgg =
    projectIds.length === 0
      ? []
      : await prisma.launch.findMany({
          where: { deletedAt: null, projectId: { in: projectIds } },
          select: { projectId: true, startDate: true, endDate: true },
        });

  const clientAccCountMap = new Map(clientAccGroups.map((g) => [g.organizationId, g._count._all]));
  const projectCountMap = new Map(projectGroups.map((g) => [g.organizationId, g._count._all]));
  const projToOrgId = new Map(projectsForLaunches.map((p) => [p.id, p.organizationId]));

  const launchCountByOrg = new Map<string, number>();
  const activeLaunchCountByOrg = new Map<string, number>();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  function launchWindowActive(startDate: Date | null, endDate: Date | null): boolean {
    if (!startDate && !endDate) return true;
    if (startDate && todayEnd < startDate) return false;
    if (endDate && todayStart > endDate) return false;
    return true;
  }

  for (const l of launchRowsForAgg) {
    const oid = projToOrgId.get(l.projectId);
    if (!oid) continue;
    launchCountByOrg.set(oid, (launchCountByOrg.get(oid) ?? 0) + 1);
    if (launchWindowActive(l.startDate, l.endDate)) {
      activeLaunchCountByOrg.set(oid, (activeLaunchCountByOrg.get(oid) ?? 0) + 1);
    }
  }

  const [memberGroups, dashGroups, invRows, invPendingGroups, membershipsForMax] = await Promise.all([
    prisma.membership.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: childIds } },
      _count: { _all: true },
    }),
    prisma.dashboard.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: childIds }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.integration.findMany({
      where: { organizationId: { in: childIds }, status: "connected" },
      select: { organizationId: true, slug: true, lastSyncAt: true, updatedAt: true },
    }),
    prisma.invitation.groupBy({
      by: ["organizationId"],
      where: {
        organizationId: { in: childIds },
        acceptedAt: null,
        expiresAt: { gt: now },
      },
      _count: { _all: true },
    }),
    prisma.membership.findMany({
      where: { organizationId: { in: childIds } },
      select: { organizationId: true, updatedAt: true },
    }),
  ]);

  const memberCount = new Map(memberGroups.map((g) => [g.organizationId, g._count._all]));
  const dashCount = new Map(dashGroups.map((g) => [g.organizationId, g._count._all]));
  const pendingInv = new Map(invPendingGroups.map((g) => [g.organizationId, g._count._all]));

  const memMaxMap = new Map<string, Date>();
  for (const m of membershipsForMax) {
    const cur = memMaxMap.get(m.organizationId);
    if (!cur || m.updatedAt > cur) memMaxMap.set(m.organizationId, m.updatedAt);
  }

  type IntAgg = { count: number; lastSync: Date | null; lastIntUpdated: Date | null };
  const intAgg = new Map<string, IntAgg>();
  for (const r of invRows) {
    const cur = intAgg.get(r.organizationId) ?? { count: 0, lastSync: null, lastIntUpdated: null };
    cur.count += 1;
    if (r.lastSyncAt && (!cur.lastSync || r.lastSyncAt > cur.lastSync)) cur.lastSync = r.lastSyncAt;
    if (!cur.lastIntUpdated || r.updatedAt > cur.lastIntUpdated) cur.lastIntUpdated = r.updatedAt;
    intAgg.set(r.organizationId, cur);
  }

  const slugByOrg = new Map<string, Set<string>>();
  for (const r of invRows) {
    const s = slugByOrg.get(r.organizationId) ?? new Set<string>();
    s.add(r.slug);
    slugByOrg.set(r.organizationId, s);
  }

  const alerts: ChildOrganizationOperationsAlert[] = [];
  const organizations = children.map((c) => {
    const m = memberCount.get(c.id) ?? 0;
    const d = dashCount.get(c.id) ?? 0;
    const agg = intAgg.get(c.id) ?? { count: 0, lastSync: null, lastIntUpdated: null };
    const memUp = memMaxMap.get(c.id) ?? null;

    const lastActivity = maxDate(c.updatedAt, memUp, agg.lastSync, agg.lastIntUpdated);
    const lastActivityIso = lastActivity?.toISOString() ?? null;

    const stale = lastActivity ? lastActivity < staleBefore : true;
    const neverAccessed =
      m === 0 &&
      agg.count === 0 &&
      now.getTime() - c.createdAt.getTime() > NEVER_USED_DAYS * 864e5;

    if (c.workspaceStatus === "ACTIVE") {
      if (agg.count === 0) {
        alerts.push({
          type: "no_integration",
          severity: "warning",
          organizationId: c.id,
          name: c.name,
          message: "Sem integração conectada",
        });
      }
      if (m === 0) {
        alerts.push({
          type: "no_members",
          severity: "warning",
          organizationId: c.id,
          name: c.name,
          message: "Sem membros no workspace",
        });
      }
      if (neverAccessed) {
        alerts.push({
          type: "never_used",
          severity: "info",
          organizationId: c.id,
          name: c.name,
          message: "Criado há mais de uma semana sem membros nem integrações",
        });
      }
      if (stale) {
        alerts.push({
          type: "stale_activity",
          severity: "info",
          organizationId: c.id,
          name: c.name,
          message: "Sem atividade recente (integrações / equipe)",
        });
      }
    }

    if (c.workspaceStatus === "PAUSED") {
      alerts.push({
        type: "paused",
        severity: "info",
        organizationId: c.id,
        name: c.name,
        message: "Workspace pausado na matriz",
      });
    }

    if (c.workspaceStatus === "ARCHIVED") {
      alerts.push({
        type: "archived",
        severity: "warning",
        organizationId: c.id,
        name: c.name,
        message: "Workspace arquivado",
      });
    }

    const needsAttention =
      c.workspaceStatus === "PAUSED" ||
      c.workspaceStatus === "ARCHIVED" ||
      (c.workspaceStatus === "ACTIVE" &&
        (agg.count === 0 || m === 0 || stale || neverAccessed));

    const slugs = slugByOrg.get(c.id) ?? new Set<string>();
    const metaAdsConnected = slugs.has("meta");
    const googleAdsConnected = slugs.has("google-ads");

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentOrganizationId: c.parentOrganizationId,
      parentOrganization: c.parentOrganization,
      createdAt: c.createdAt.toISOString(),
      inheritPlanFromParent: c.inheritPlanFromParent,
      workspaceStatus: c.workspaceStatus,
      workspaceNote: c.workspaceNote,
      resellerOrgKind: c.resellerOrgKind,
      planId: c.planId,
      plan: c.plan,
      featureOverrides: c.featureOverrides ?? null,
      subscription: c.subscription
        ? {
            id: c.subscription.id,
            billingMode: c.subscription.billingMode,
            status: c.subscription.status,
            renewsAt: c.subscription.renewsAt?.toISOString() ?? null,
            startedAt: c.subscription.startedAt.toISOString(),
            planId: c.subscription.planId,
          }
        : null,
      limitsOverride: c.limitsOverride,
      memberCount: m,
      pendingInvitationsCount: pendingInv.get(c.id) ?? 0,
      dashboardCount: d,
      connectedIntegrations: agg.count,
      lastIntegrationSyncAt: agg.lastSync?.toISOString() ?? null,
      lastActivityAt: lastActivityIso,
      staleActivity: stale,
      neverAccessed,
      needsAttention,
      metaAdsConnected,
      googleAdsConnected,
      clientAccountCount: clientAccCountMap.get(c.id) ?? 0,
      projectCount: projectCountMap.get(c.id) ?? 0,
      launchCount: launchCountByOrg.get(c.id) ?? 0,
      activeLaunchCount: activeLaunchCountByOrg.get(c.id) ?? 0,
    };
  });

  const childIdsForRollup = organizations.map((x) => x.id);
  const [rollupMap, settingsForCpl] = await Promise.all([
    rollupMarketing30dForChildren(
      organizations.map((o) => ({
        id: o.id,
        workspaceStatus: o.workspaceStatus,
        metaAdsConnected: o.metaAdsConnected,
        googleAdsConnected: o.googleAdsConnected,
      }))
    ),
    prisma.marketingSettings.findMany({
      where: { organizationId: { in: childIdsForRollup } },
      select: { organizationId: true, targetCpaBrl: true },
    }),
  ]);
  const organizationsOutRaw = organizations.map((o) => ({
    ...o,
    marketing30d: rollupMap.get(o.id) ?? null,
  }));
  const targetCpaMap = new Map(
    settingsForCpl.map((s) => [s.organizationId, s.targetCpaBrl != null ? Number(s.targetCpaBrl) : null])
  );
  const organizationsOut = organizationsOutRaw.map((o) => {
    const target = targetCpaMap.get(o.id) ?? null;
    const cpl = o.marketing30d?.cpl ?? null;
    const { alertLevel, alertDetail } = computeAgencyPortfolioCplAlert(target, cpl);
    return {
      ...o,
      targetCpaBrl: target,
      cplAlertLevel: alertLevel,
      cplAlertDetail: alertDetail,
    };
  });

  const maxChild = planContext.limits.maxChildOrganizations;
  const usedChild = planContext.usage.childOrganizations;
  if (maxChild != null && maxChild > 0 && usedChild >= maxChild) {
    alerts.unshift({
      type: "at_child_limit",
      severity: "critical",
      organizationId: parentOrganizationId,
      name: "",
      message: `Limite de workspaces filhos atingido (${usedChild} / ${maxChild})`,
    });
  } else if (maxChild != null && maxChild > 0 && usedChild >= Math.ceil(maxChild * 0.9)) {
    alerts.unshift({
      type: "near_child_limit",
      severity: "warning",
      organizationId: parentOrganizationId,
      name: "",
      message: `Próximo do limite de workspaces filhos (${usedChild} / ${maxChild})`,
    });
  }

  const summary = {
    totalWorkspaces: children.length,
    activeWorkspaces: children.filter((c) => c.workspaceStatus === "ACTIVE").length,
    pausedWorkspaces: children.filter((c) => c.workspaceStatus === "PAUSED").length,
    archivedWorkspaces: children.filter((c) => c.workspaceStatus === "ARCHIVED").length,
    withoutIntegration: organizationsOut.filter(
      (o) => o.connectedIntegrations === 0 && o.workspaceStatus === "ACTIVE"
    ).length,
    withoutMembers: organizationsOut.filter((o) => o.memberCount === 0 && o.workspaceStatus === "ACTIVE").length,
    staleActivityCount: organizationsOut.filter((o) => o.staleActivity && o.workspaceStatus === "ACTIVE").length,
    integrationsTotalAcrossChildren: organizationsOut.reduce((s, o) => s + o.connectedIntegrations, 0),
    usersTotalAcrossChildren: organizationsOut.reduce((s, o) => s + o.memberCount, 0),
    dashboardsTotalAcrossChildren: organizationsOut.reduce((s, o) => s + o.dashboardCount, 0),
    childSlotsUsed: usedChild,
    childSlotsCap: maxChild,
    childrenWithActiveLaunches: organizationsOut.filter((o) => o.activeLaunchCount > 0).length,
    totalProjectsAcrossChildren: organizationsOut.reduce((s, o) => s + o.projectCount, 0),
    totalLaunchesAcrossChildren: organizationsOut.reduce((s, o) => s + o.launchCount, 0),
  };

  return {
    parent: {
      plan: planContext.plan,
      planSource: planContext.planSource,
      limits: planContext.limits,
      limitsHaveOverrides: planContext.limitsHaveOverrides,
      usage: planContext.usage,
    },
    organizations: organizationsOut,
    capabilities: {
      canCreateChildWorkspaces: isAgencyAdmin,
      canManageChildWorkspaceMembers: isAgencyAdmin,
      canPatchChildWorkspace: isAgencyAdmin,
    },
    summary,
    alerts,
  };
}

export type AgencyPortfolioChildRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  inheritPlanFromParent: boolean;
  workspaceStatus: WorkspaceStatus;
  connectedIntegrations: number;
  lastIntegrationSyncAt: string | null;
  metaAdsConnected: boolean;
  googleAdsConnected: boolean;
  marketing30d: ChildMarketingRollup30d | null;
  /** Integração ligada mas rollup falhou (ex.: token/API). */
  metricsUnavailable: boolean;
  /** Última sync há mais de 72h (contas conectadas). */
  integrationStale: boolean;
  metricsOrSyncIssue: boolean;
  targetCpaBrl: number | null;
  alertLevel: AgencyPortfolioAlertLevel;
  /** Texto para tooltip (PT-BR), explicando o nível de alerta de CPL. */
  alertDetail: string | null;
};

export type AgencyPortfolioResponse = {
  organizations: AgencyPortfolioChildRow[];
  summary: {
    totalSpend30dBrl: number;
    totalLeads30d: number;
    portfolioHealth: { withinTarget: number; withGoal: number };
    /** Clientes com CPL > 20% acima da meta (30d). */
    cplCriticalCount: number;
    clientsWithIntegrationAttention: number;
  };
};

const INTEGRATION_STALE_MS = 72 * 3600 * 1000;

export async function listChildOrganizationsPortfolio(
  parentOrganizationId: string,
  userId: string
): Promise<AgencyPortfolioResponse> {
  const { visibleIds } = await resolveVisibleChildOrganizationIds(parentOrganizationId, userId);
  const children =
    visibleIds.length === 0
      ? []
      : await prisma.organization.findMany({
          where: { id: { in: visibleIds }, deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            inheritPlanFromParent: true,
            workspaceStatus: true,
          },
          orderBy: { name: "asc" },
        });

  const childIds = children.map((c) => c.id);
  if (childIds.length === 0) {
    return {
      organizations: [],
      summary: {
        totalSpend30dBrl: 0,
        totalLeads30d: 0,
        portfolioHealth: { withinTarget: 0, withGoal: 0 },
        cplCriticalCount: 0,
        clientsWithIntegrationAttention: 0,
      },
    };
  }

  const [adIntegrations, connectedCounts, settingsRows] = await Promise.all([
    prisma.integration.findMany({
      where: {
        organizationId: { in: childIds },
        slug: { in: ["meta", "google-ads"] },
      },
      select: { organizationId: true, slug: true, status: true, lastSyncAt: true },
    }),
    prisma.integration.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: childIds }, status: "connected" },
      _count: { _all: true },
    }),
    prisma.marketingSettings.findMany({
      where: { organizationId: { in: childIds } },
      select: { organizationId: true, targetCpaBrl: true },
    }),
  ]);

  const connectedMap = new Map(connectedCounts.map((r) => [r.organizationId, r._count._all]));
  const settingsMap = new Map(
    settingsRows.map((s) => [s.organizationId, s.targetCpaBrl != null ? Number(s.targetCpaBrl) : null])
  );

  function adRow(orgId: string, slug: string) {
    return adIntegrations.find((i) => i.organizationId === orgId && i.slug === slug);
  }

  const rollupInputs = children.map((c) => {
    const meta = adRow(c.id, "meta");
    const google = adRow(c.id, "google-ads");
    return {
      id: c.id,
      workspaceStatus: c.workspaceStatus,
      metaAdsConnected: meta?.status === "connected",
      googleAdsConnected: google?.status === "connected",
    };
  });

  const rollups = await rollupMarketing30dForChildren(rollupInputs, 4);
  const now = Date.now();

  const organizations: AgencyPortfolioChildRow[] = children.map((c) => {
    const metaInt = adRow(c.id, "meta");
    const googleInt = adRow(c.id, "google-ads");
    const metaAdsConnected = metaInt?.status === "connected";
    const googleAdsConnected = googleInt?.status === "connected";
    const rollup = rollups.get(c.id) ?? null;
    const metricsUnavailable =
      c.workspaceStatus === "ACTIVE" && (metaAdsConnected || googleAdsConnected) && rollup === null;

    let lastIntegrationSyncAt: string | null = null;
    for (const i of adIntegrations) {
      if (i.organizationId !== c.id || i.status !== "connected") continue;
      if (!i.lastSyncAt) continue;
      const iso = i.lastSyncAt.toISOString();
      if (!lastIntegrationSyncAt || iso > lastIntegrationSyncAt) lastIntegrationSyncAt = iso;
    }

    const staleSync =
      (metaAdsConnected || googleAdsConnected) &&
      lastIntegrationSyncAt != null &&
      now - new Date(lastIntegrationSyncAt).getTime() > INTEGRATION_STALE_MS;

    const metricsOrSyncIssue = metricsUnavailable || staleSync;
    const targetCpaBrl = settingsMap.get(c.id) ?? null;
    const cpl = rollup?.cpl ?? null;
    const { alertLevel, alertDetail } = computeAgencyPortfolioCplAlert(targetCpaBrl, cpl);

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      createdAt: c.createdAt.toISOString(),
      inheritPlanFromParent: c.inheritPlanFromParent,
      workspaceStatus: c.workspaceStatus,
      connectedIntegrations: connectedMap.get(c.id) ?? 0,
      lastIntegrationSyncAt,
      metaAdsConnected,
      googleAdsConnected,
      marketing30d: rollup,
      metricsUnavailable,
      integrationStale: staleSync,
      metricsOrSyncIssue,
      targetCpaBrl,
      alertLevel,
      alertDetail,
    };
  });

  let totalSpend30dBrl = 0;
  let totalLeads30d = 0;
  let withGoal = 0;
  let withinTarget = 0;
  let cplCriticalCount = 0;
  let clientsWithIntegrationAttention = 0;

  for (const o of organizations) {
    if (o.marketing30d) {
      totalSpend30dBrl += o.marketing30d.spend;
      totalLeads30d += o.marketing30d.leads;
    }
    if (o.targetCpaBrl != null && o.targetCpaBrl > 0 && o.marketing30d?.cpl != null) {
      withGoal += 1;
      if (o.alertLevel === "HEALTHY") withinTarget += 1;
    }
    if (o.alertLevel === "CRITICAL") cplCriticalCount += 1;
    if (o.metricsOrSyncIssue) clientsWithIntegrationAttention += 1;
  }

  return {
    organizations,
    summary: {
      totalSpend30dBrl,
      totalLeads30d,
      portfolioHealth: { withinTarget, withGoal },
      cplCriticalCount,
      clientsWithIntegrationAttention,
    },
  };
}

/** Vincula membro existente da agência (`parentOrganizationId`) ao workspace cliente. */
export async function assignParentAgencyMemberToChildWorkspace(
  parentOrganizationId: string,
  actorUserId: string,
  childOrganizationId: string,
  targetUserId: string,
  clientAccessLevel: "ADMIN" | "OPERADOR" | "VIEWER"
): Promise<{ ok: true }> {
  await assertManagedDescendantOrganization(parentOrganizationId, childOrganizationId);
  await assertDirectOrgAdmin(actorUserId, parentOrganizationId);

  const parentMem = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId: parentOrganizationId } },
  });
  if (!parentMem) {
    throw new Error("O usuário precisa ser membro da agência para ser vinculado a este cliente.");
  }

  const role = teamAccessLevelToRole(clientAccessLevel);
  const jobTitle = parentMem.jobTitle ?? "traffic_manager";
  const existing = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId: childOrganizationId } },
  });
  if (existing) {
    await prisma.membership.update({
      where: { id: existing.id },
      data: { role, jobTitle },
    });
  } else {
    await prisma.membership.create({
      data: {
        userId: targetUserId,
        organizationId: childOrganizationId,
        role,
        jobTitle,
      },
    });
  }

  const childOrg = await prisma.organization.findFirst({
    where: { id: childOrganizationId, deletedAt: null },
    select: { agencyMemberExcludedUserIds: true },
  });
  const prevEx = childOrg?.agencyMemberExcludedUserIds ?? [];
  if (prevEx.includes(targetUserId)) {
    await prisma.organization.update({
      where: { id: childOrganizationId },
      data: { agencyMemberExcludedUserIds: prevEx.filter((id) => id !== targetUserId) },
    });
  }

  return { ok: true };
}

const CHILD_AGENCY_INHERIT_ROLES = [
  "owner",
  "admin",
  "agency_owner",
  "agency_admin",
  "workspace_owner",
  "workspace_admin",
] as const;

/** Oculta acesso herdado da agência a este cliente (não remove membership na agência). */
export async function addAgencyMemberExclusionOnChild(
  parentOrganizationId: string,
  actorUserId: string,
  childOrganizationId: string,
  targetUserId: string
): Promise<void> {
  await assertManagedDescendantOrganization(parentOrganizationId, childOrganizationId);
  await assertDirectOrgAdmin(actorUserId, parentOrganizationId);

  const child = await prisma.organization.findFirst({
    where: { id: childOrganizationId, deletedAt: null },
    select: { parentOrganizationId: true },
  });
  if (!child || child.parentOrganizationId !== parentOrganizationId) {
    throw new Error("Workspace cliente inválido para esta agência");
  }

  const direct = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId: childOrganizationId } },
  });
  if (direct) {
    throw new Error("Este usuário tem vínculo direto: use a remoção de acesso direto.");
  }

  const parentMem = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId: parentOrganizationId } },
  });
  if (!parentMem) {
    throw new Error("Usuário não é membro da agência");
  }
  if (!(CHILD_AGENCY_INHERIT_ROLES as readonly string[]).includes(parentMem.role)) {
    throw new Error("Só é possível ocultar membros da agência com papel administrativo neste cliente");
  }

  const row = await prisma.organization.findFirst({
    where: { id: childOrganizationId, deletedAt: null },
    select: { agencyMemberExcludedUserIds: true },
  });
  const cur = [...(row?.agencyMemberExcludedUserIds ?? [])];
  if (cur.includes(targetUserId)) return;
  cur.push(targetUserId);
  await prisma.organization.update({
    where: { id: childOrganizationId },
    data: { agencyMemberExcludedUserIds: cur },
  });
}

export async function removeAgencyMemberExclusionOnChild(
  parentOrganizationId: string,
  actorUserId: string,
  childOrganizationId: string,
  targetUserId: string
): Promise<void> {
  await assertManagedDescendantOrganization(parentOrganizationId, childOrganizationId);
  await assertDirectOrgAdmin(actorUserId, parentOrganizationId);

  const child = await prisma.organization.findFirst({
    where: { id: childOrganizationId, deletedAt: null },
    select: { parentOrganizationId: true, agencyMemberExcludedUserIds: true },
  });
  if (!child || child.parentOrganizationId !== parentOrganizationId) {
    throw new Error("Workspace cliente inválido para esta agência");
  }

  const next = (child.agencyMemberExcludedUserIds ?? []).filter((id) => id !== targetUserId);
  await prisma.organization.update({
    where: { id: childOrganizationId },
    data: { agencyMemberExcludedUserIds: next },
  });
}
