import { prisma } from "../utils/prisma.js";
import { appendAuditLog } from "./audit-log.service.js";
import { assertCan } from "./authorization.service.js";
import { CAP_MATRIX_WORKSPACE_GRANT_MANAGE } from "../constants/capabilities.js";
import { isOrganizationUnderMatrix } from "./organizations.service.js";
import { resolveResellerMatrixOrganizationId } from "./reseller.service.js";

export async function listMatrixWorkspaceGrants(actorUserId: string, activeOrganizationId: string) {
  await assertCan(actorUserId, CAP_MATRIX_WORKSPACE_GRANT_MANAGE, { organizationId: activeOrganizationId });
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  return prisma.matrixWorkspaceGrant.findMany({
    where: { matrixOrganizationId: matrixId },
    orderBy: { createdAt: "desc" },
  });
}

export async function upsertMatrixWorkspaceGrant(
  actorUserId: string,
  activeOrganizationId: string,
  body: {
    userId: string;
    workspaceOrganizationId: string;
    allowedChannels?: string[];
  },
  reqMeta?: { ip?: string | null; userAgent?: string | null }
) {
  await assertCan(actorUserId, CAP_MATRIX_WORKSPACE_GRANT_MANAGE, { organizationId: activeOrganizationId });
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const under = await isOrganizationUnderMatrix(body.workspaceOrganizationId, matrixId);
  if (!under || body.workspaceOrganizationId === matrixId) {
    throw new Error("Workspace deve ser descendente da matriz");
  }
  const targetOrg = await prisma.organization.findFirst({
    where: { id: body.workspaceOrganizationId, deletedAt: null },
    select: { organizationKind: true },
  });
  if (targetOrg?.organizationKind !== "CLIENT_WORKSPACE") {
    throw new Error("Grant só se aplica a workspaces cliente");
  }

  const row = await prisma.matrixWorkspaceGrant.upsert({
    where: {
      userId_workspaceOrganizationId: {
        userId: body.userId,
        workspaceOrganizationId: body.workspaceOrganizationId,
      },
    },
    create: {
      userId: body.userId,
      matrixOrganizationId: matrixId,
      workspaceOrganizationId: body.workspaceOrganizationId,
      allowedChannels: body.allowedChannels ?? [],
      createdByUserId: actorUserId,
    },
    update: {
      allowedChannels: body.allowedChannels ?? [],
    },
  });

  await appendAuditLog({
    actorUserId,
    organizationId: matrixId,
    action: "matrix.workspace_grant.upsert",
    entityType: "MatrixWorkspaceGrant",
    entityId: row.id,
    metadata: {
      userId: body.userId,
      workspaceOrganizationId: body.workspaceOrganizationId,
    },
    ip: reqMeta?.ip,
    userAgent: reqMeta?.userAgent,
  });

  return row;
}

export async function deleteMatrixWorkspaceGrant(
  actorUserId: string,
  activeOrganizationId: string,
  grantId: string,
  reqMeta?: { ip?: string | null; userAgent?: string | null }
) {
  await assertCan(actorUserId, CAP_MATRIX_WORKSPACE_GRANT_MANAGE, { organizationId: activeOrganizationId });
  const matrixId = await resolveResellerMatrixOrganizationId(actorUserId, activeOrganizationId);
  const existing = await prisma.matrixWorkspaceGrant.findFirst({
    where: { id: grantId, matrixOrganizationId: matrixId },
  });
  if (!existing) {
    throw new Error("Grant não encontrado");
  }
  await prisma.matrixWorkspaceGrant.delete({ where: { id: grantId } });
  await appendAuditLog({
    actorUserId,
    organizationId: matrixId,
    action: "matrix.workspace_grant.delete",
    entityType: "MatrixWorkspaceGrant",
    entityId: grantId,
    metadata: { userId: existing.userId, workspaceOrganizationId: existing.workspaceOrganizationId },
    ip: reqMeta?.ip,
    userAgent: reqMeta?.userAgent,
  });
}
