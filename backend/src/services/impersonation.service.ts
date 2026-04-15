import { prisma } from "../utils/prisma.js";
import { isPlatformAdminEmail } from "../utils/platform-admin.js";
import { isMatrixWideAdminRole } from "../constants/roles.js";
import { isOrganizationUnderAncestor } from "./tenancy-access.service.js";
import { appendAuditLog } from "./audit-log.service.js";

export type StartImpersonationResult = {
  session: {
    id: string;
    sourceOrganizationId: string;
    targetOrganizationId: string;
    assumedRole: string;
    startedAt: Date;
  };
  targetOrganization: { id: string; name: string; slug: string };
};

export type ImpersonationStatus = {
  isImpersonating: boolean;
  actorUserId?: string;
  sourceOrganizationId?: string;
  sourceOrganizationName?: string;
  targetOrganizationId?: string;
  targetOrganizationName?: string;
  assumedRole?: string;
  startedAt?: Date;
  impersonationSessionId?: string;
};

/**
 * Quem pode impersonar:
 * 1. Platform admin (email em PLATFORM_ADMIN_EMAILS)
 * 2. OWNER/ADMIN da organização MATRIX/AGENCY com o target como descendente
 */
async function assertCanImpersonate(
  userId: string,
  userEmail: string,
  sourceOrgId: string,
  targetOrgId: string
): Promise<void> {
  if (isPlatformAdminEmail(userEmail)) return;

  const sourceOrg = await prisma.organization.findFirst({
    where: { id: sourceOrgId, deletedAt: null },
    select: { organizationKind: true, resellerPartner: true },
  });
  if (!sourceOrg) throw new Error("Organização de origem não encontrada");

  if (sourceOrg.organizationKind !== "MATRIX" && sourceOrg.organizationKind !== "DIRECT") {
    throw new Error("Só organizações raiz (matriz/agência) podem impersonar");
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: sourceOrgId } },
  });
  if (!membership || !isMatrixWideAdminRole(membership.role)) {
    throw new Error("Sem permissão: apenas OWNER ou ADMIN da organização podem impersonar");
  }

  const isDescendant = await isOrganizationUnderAncestor(sourceOrgId, targetOrgId);
  if (!isDescendant) {
    throw new Error("A organização alvo não pertence à sua hierarquia");
  }
}

export async function startImpersonation(params: {
  actorUserId: string;
  actorEmail: string;
  sourceOrganizationId: string;
  targetOrganizationId: string;
  reason?: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<StartImpersonationResult> {
  const { actorUserId, actorEmail, sourceOrganizationId, targetOrganizationId, reason, ip, userAgent } = params;

  if (sourceOrganizationId === targetOrganizationId) {
    throw new Error("Não é possível impersonar a própria organização");
  }

  const existing = await prisma.impersonationSession.findFirst({
    where: { actorUserId, isActive: true },
  });
  if (existing) {
    throw new Error("Já existe uma impersonação ativa. Encerre a sessão atual antes de iniciar outra.");
  }

  const targetOrg = await prisma.organization.findFirst({
    where: { id: targetOrganizationId, deletedAt: null },
    select: { id: true, name: true, slug: true, workspaceStatus: true },
  });
  if (!targetOrg) throw new Error("Organização alvo não encontrada");
  if (targetOrg.workspaceStatus === "ARCHIVED") throw new Error("Organização alvo está arquivada");

  await assertCanImpersonate(actorUserId, actorEmail, sourceOrganizationId, targetOrganizationId);

  const session = await prisma.impersonationSession.create({
    data: {
      actorUserId,
      sourceOrganizationId,
      targetOrganizationId,
      assumedRole: "admin",
      isActive: true,
      reason: reason ?? null,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
    },
  });

  await appendAuditLog({
    actorUserId,
    organizationId: targetOrganizationId,
    action: "impersonation.started",
    entityType: "ImpersonationSession",
    entityId: session.id,
    metadata: {
      sourceOrganizationId,
      targetOrganizationId,
      targetOrganizationName: targetOrg.name,
      reason: reason ?? null,
    },
    ip: ip ?? null,
    userAgent: userAgent ?? null,
  });

  return {
    session: {
      id: session.id,
      sourceOrganizationId: session.sourceOrganizationId,
      targetOrganizationId: session.targetOrganizationId,
      assumedRole: session.assumedRole,
      startedAt: session.startedAt,
    },
    targetOrganization: { id: targetOrg.id, name: targetOrg.name, slug: targetOrg.slug },
  };
}

export async function stopImpersonation(params: {
  actorUserId: string;
  impersonationSessionId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ sourceOrganizationId: string }> {
  const { actorUserId, impersonationSessionId, ip, userAgent } = params;

  const session = await prisma.impersonationSession.findFirst({
    where: { id: impersonationSessionId, actorUserId, isActive: true },
  });
  if (!session) {
    throw new Error("Nenhuma sessão de impersonação ativa encontrada");
  }

  await prisma.impersonationSession.update({
    where: { id: session.id },
    data: { isActive: false, endedAt: new Date() },
  });

  await appendAuditLog({
    actorUserId,
    organizationId: session.targetOrganizationId,
    action: "impersonation.stopped",
    entityType: "ImpersonationSession",
    entityId: session.id,
    metadata: {
      sourceOrganizationId: session.sourceOrganizationId,
      targetOrganizationId: session.targetOrganizationId,
      durationMs: Date.now() - session.startedAt.getTime(),
    },
    ip: ip ?? null,
    userAgent: userAgent ?? null,
  });

  return { sourceOrganizationId: session.sourceOrganizationId };
}

export async function getImpersonationStatus(
  actorUserId: string,
  impersonationSessionId?: string
): Promise<ImpersonationStatus> {
  if (!impersonationSessionId) {
    return { isImpersonating: false };
  }

  const session = await prisma.impersonationSession.findFirst({
    where: { id: impersonationSessionId, actorUserId, isActive: true },
    include: {
      sourceOrganization: { select: { id: true, name: true } },
      targetOrganization: { select: { id: true, name: true } },
    },
  });

  if (!session) {
    return { isImpersonating: false };
  }

  return {
    isImpersonating: true,
    actorUserId: session.actorUserId,
    sourceOrganizationId: session.sourceOrganizationId,
    sourceOrganizationName: session.sourceOrganization.name,
    targetOrganizationId: session.targetOrganizationId,
    targetOrganizationName: session.targetOrganization.name,
    assumedRole: session.assumedRole,
    startedAt: session.startedAt,
    impersonationSessionId: session.id,
  };
}
