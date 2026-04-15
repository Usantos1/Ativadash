import type { Request, Response } from "express";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import { listOrganizationAuditLogs } from "../services/audit-log.service.js";

type AuthRequest = Request & { user: JwtPayload };

export async function auditLogsList(req: Request, res: Response) {
  const { organizationId } = (req as AuthRequest).user;
  try {
    const data = await listOrganizationAuditLogs(organizationId, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
      actorUserId: req.query.actorUserId as string | undefined,
      action: req.query.action as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    return res.json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Erro ao listar logs de atividade" });
  }
}
