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

export type AuditLogRow = {
  id: string;
  actorUserId: string;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: Date;
};

export async function listOrganizationAuditLogs(
  organizationId: string,
  query: {
    limit?: number;
    offset?: number;
    actorUserId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<{ items: AuditLogRow[]; total: number }> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  const offset = Math.max(query.offset ?? 0, 0);

  const where: Record<string, unknown> = { organizationId };
  if (query.actorUserId) where.actorUserId = query.actorUserId;
  if (query.action) where.action = query.action;
  if (query.startDate || query.endDate) {
    const cr: Record<string, Date> = {};
    if (query.startDate) cr.gte = new Date(query.startDate);
    if (query.endDate) {
      const ed = new Date(query.endDate);
      ed.setHours(23, 59, 59, 999);
      cr.lte = ed;
    }
    where.createdAt = cr;
  }

  const [rawItems, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where: where as any }),
  ]);

  const userIds = [...new Set(rawItems.map((r) => r.actorUserId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const items: AuditLogRow[] = rawItems.map((r) => {
    const actor = userMap.get(r.actorUserId);
    return {
      id: r.id,
      actorUserId: r.actorUserId,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: r.metadata,
      ip: r.ip,
      createdAt: r.createdAt,
    };
  });

  return { items, total };
}
