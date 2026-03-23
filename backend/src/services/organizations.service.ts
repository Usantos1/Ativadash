import type { ResellerOrgKind, WorkspaceStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
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
import { mergePlanFeaturesWithOverrides } from "../utils/plan-features.js";
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

  const enabledFeatures = mergePlanFeaturesWithOverrides(templatePlan, org.featureOverrides);

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
  options?: {
    inheritPlanFromParent?: boolean;
    planId?: string | null;
    workspaceNote?: string | null;
    resellerOrgKind?: ResellerOrgKind;
  }
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
  const patch: {
    name?: string;
    workspaceStatus?: WorkspaceStatus;
    workspaceNote?: string | null;
    resellerOrgKind?: ResellerOrgKind;
    featureOverrides?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  } = {};
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
      data.featureOverrides === null ? Prisma.DbNull : (data.featureOverrides as Prisma.InputJsonValue);
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

function maxDate(...dates: (Date | null | undefined)[]): Date | null {
  const valid = dates.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid.map((d) => d.getTime())));
}

const STALE_ACTIVITY_DAYS = 14;
const NEVER_USED_DAYS = 7;

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
  }>;
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
  };
  alerts: ChildOrganizationOperationsAlert[];
}> {
  await assertDirectOrgAdmin(userId, parentOrganizationId);
  const planContext = await getOrganizationPlanContext(parentOrganizationId);

  const children = await prisma.organization.findMany({
    where: { parentOrganizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
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
      },
      alerts: [],
    };
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
      select: { organizationId: true, lastSyncAt: true, updatedAt: true },
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

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
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
    withoutIntegration: organizations.filter(
      (o) => o.connectedIntegrations === 0 && o.workspaceStatus === "ACTIVE"
    ).length,
    withoutMembers: organizations.filter((o) => o.memberCount === 0 && o.workspaceStatus === "ACTIVE").length,
    staleActivityCount: organizations.filter((o) => o.staleActivity && o.workspaceStatus === "ACTIVE").length,
    integrationsTotalAcrossChildren: organizations.reduce((s, o) => s + o.connectedIntegrations, 0),
    usersTotalAcrossChildren: organizations.reduce((s, o) => s + o.memberCount, 0),
    dashboardsTotalAcrossChildren: organizations.reduce((s, o) => s + o.dashboardCount, 0),
    childSlotsUsed: usedChild,
    childSlotsCap: maxChild,
  };

  return {
    parent: {
      plan: planContext.plan,
      planSource: planContext.planSource,
      limits: planContext.limits,
      limitsHaveOverrides: planContext.limitsHaveOverrides,
      usage: planContext.usage,
    },
    organizations,
    summary,
    alerts,
  };
}

export async function listChildOrganizationsPortfolio(parentOrganizationId: string, userId: string) {
  await assertDirectOrgAdmin(userId, parentOrganizationId);
  const children = await prisma.organization.findMany({
    where: { parentOrganizationId, deletedAt: null },
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
