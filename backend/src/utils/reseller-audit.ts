import { prisma } from "./prisma.js";

export async function appendResellerAudit(
  matrixOrgId: string,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown> | null
): Promise<void> {
  await prisma.resellerAuditLog.create({
    data: {
      matrixOrgId,
      actorUserId,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata: metadata === undefined || metadata === null ? undefined : (metadata as object),
    },
  });
}
