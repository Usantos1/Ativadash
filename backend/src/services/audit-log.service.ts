import type { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma.js";

export type AuditLogInput = {
  actorUserId: string;
  organizationId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
};

export async function appendAuditLog(row: AuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: row.actorUserId,
      organizationId: row.organizationId ?? null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId ?? null,
      metadata: row.metadata === undefined ? undefined : row.metadata,
      ip: row.ip ?? null,
      userAgent: row.userAgent ?? null,
    },
  });
}
