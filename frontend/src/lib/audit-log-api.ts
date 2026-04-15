import { api } from "./api";

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
  createdAt: string;
};

export async function fetchOrganizationAuditLogs(params?: {
  limit?: number;
  offset?: number;
  actorUserId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ items: AuditLogRow[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  if (params?.actorUserId) q.set("actorUserId", params.actorUserId);
  if (params?.action) q.set("action", params.action);
  if (params?.startDate) q.set("startDate", params.startDate);
  if (params?.endDate) q.set("endDate", params.endDate);
  const qs = q.toString();
  return api.get<{ items: AuditLogRow[]; total: number }>(
    `/workspace/audit-logs${qs ? `?${qs}` : ""}`
  );
}
