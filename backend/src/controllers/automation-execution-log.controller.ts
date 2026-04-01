import type { Request, Response } from "express";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import { assertCan } from "../services/authorization.service.js";
import { userCanReadMarketing } from "../services/marketing-permissions.service.js";
import { orgPerformanceAlertsEnabled } from "../services/alert-rules.service.js";
import {
  appendAutomationExecutionLog,
  listAutomationExecutionLogs,
} from "../services/automation-execution-log.service.js";
import { CAP_MARKETING_SETTINGS_WRITE } from "../constants/capabilities.js";
import { postAutomationExecutionLogSchema } from "../validators/automation-execution-log.validator.js";

type AuthRequest = Request & { user: JwtPayload };

export async function getAutomationExecutionLogsHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  const okRead = await userCanReadMarketing(userId, organizationId);
  if (!okRead) {
    return res.status(403).json({ message: "Sem acesso aos dados de marketing desta empresa." });
  }
  const featureOn = await orgPerformanceAlertsEnabled(organizationId);
  if (!featureOn) {
    return res.json({ items: [] as const });
  }
  const limitRaw = req.query.limit;
  const limit =
    typeof limitRaw === "string" && /^\d+$/.test(limitRaw) ? parseInt(limitRaw, 10) : undefined;
  const items = await listAutomationExecutionLogs(organizationId, { limit });
  return res.json({ items });
}

/** Worker/cron ou testes: regista uma execução autónoma no ledger. */
export async function postAutomationExecutionLogHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  const parsed = postAutomationExecutionLogSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.flatten() });
  }
  try {
    await assertCan(userId, CAP_MARKETING_SETTINGS_WRITE, { organizationId });
  } catch (e) {
    return res.status(403).json({ message: e instanceof Error ? e.message : "Sem permissão" });
  }
  const featureOn = await orgPerformanceAlertsEnabled(organizationId);
  if (!featureOn) {
    return res.status(403).json({ message: "Alertas avançados não estão ativos no plano desta empresa." });
  }
  const item = await appendAutomationExecutionLog(organizationId, parsed.data);
  if (!item) {
    return res.status(404).json({ message: "Regra não encontrada" });
  }
  return res.status(201).json({ item });
}
