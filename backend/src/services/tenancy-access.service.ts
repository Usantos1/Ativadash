import { prisma } from "../utils/prisma.js";
import {
  isAgencyOpsStyleRole,
  isMatrixWideAdminRole,
  isWorkspaceAdminRole,
} from "../constants/roles.js";

/** `targetOrgId` está na subárvore cuja raiz do recorte é `ancestorId` (inclusive)? */
export async function isOrganizationUnderAncestor(ancestorId: string, targetOrgId: string): Promise<boolean> {
  let walk: string | null = targetOrgId;
  for (let i = 0; i < 32 && walk; i++) {
    if (walk === ancestorId) return true;
    const row: { parentOrganizationId: string | null } | null = await prisma.organization.findFirst({
      where: { id: walk, deletedAt: null },
      select: { parentOrganizationId: true },
    });
    walk = row?.parentOrganizationId ?? null;
  }
  return false;
}

async function matrixMemberAllowsDescendantWorkspace(
  userId: string,
  matrixOrgId: string,
  targetOrgId: string,
  role: string
): Promise<boolean> {
  const under = await isOrganizationUnderAncestor(matrixOrgId, targetOrgId);
  if (!under) return false;

  if (isAgencyOpsStyleRole(role)) {
    const g = await prisma.matrixWorkspaceGrant.findFirst({
      where: {
        userId,
        matrixOrganizationId: matrixOrgId,
        workspaceOrganizationId: targetOrgId,
      },
    });
    return !!g;
  }

  if (isMatrixWideAdminRole(role)) {
    const n = await prisma.matrixWorkspaceGrant.count({
      where: { userId, matrixOrganizationId: matrixOrgId },
    });
    if (n === 0) return true;
    const g = await prisma.matrixWorkspaceGrant.findFirst({
      where: {
        userId,
        matrixOrganizationId: matrixOrgId,
        workspaceOrganizationId: targetOrgId,
      },
    });
    return !!g;
  }

  return false;
}

/**
 * Acesso ao tenant: membership direta ou matriz (com grants) / ancestral com papel elevado (legado).
 * Workspace arquivado não pode ser usado como contexto ativo (JWT / rotas do app).
 */
export async function userHasEffectiveAccess(userId: string, organizationId: string): Promise<boolean> {
  const targetOrg = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { workspaceStatus: true, agencyMemberExcludedUserIds: true },
  });
  if (!targetOrg) return false;
  if (targetOrg.workspaceStatus === "ARCHIVED") return false;

  const excludedFromInheritedAgencyAccess = new Set(targetOrg.agencyMemberExcludedUserIds ?? []);

  const direct = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { organization: true },
  });
  if (direct && !direct.organization.deletedAt) return true;

  let walk: string | null = organizationId;
  for (let depth = 0; depth < 32 && walk; depth++) {
    const org: { parentOrganizationId: string | null } | null = await prisma.organization.findFirst({
      where: { id: walk, deletedAt: null },
      select: { parentOrganizationId: true },
    });
    const parentId: string | null = org?.parentOrganizationId ?? null;
    if (!parentId) break;

    const mem = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: parentId } },
    });
    if (mem) {
      const parentRow = await prisma.organization.findFirst({
        where: { id: parentId, deletedAt: null },
        select: { organizationKind: true },
      });
      if (!parentRow) break;

      if (parentRow.organizationKind === "MATRIX") {
        const ok = await matrixMemberAllowsDescendantWorkspace(userId, parentId, organizationId, mem.role);
        if (ok && !excludedFromInheritedAgencyAccess.has(userId)) return true;
      } else if (isMatrixWideAdminRole(mem.role) || isWorkspaceAdminRole(mem.role)) {
        const under = await isOrganizationUnderAncestor(parentId, organizationId);
        if (under && !excludedFromInheritedAgencyAccess.has(userId)) return true;
      }
    }
    walk = parentId;
  }
  return false;
}
