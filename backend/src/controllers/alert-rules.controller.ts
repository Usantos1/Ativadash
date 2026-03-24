import type { Request, Response } from "express";
import type { JwtPayload } from "../middlewares/auth.middleware.js";
import { assertCan } from "../services/authorization.service.js";
import { userCanReadMarketing } from "../services/marketing-permissions.service.js";
import {
  createAlertRule,
  deleteAlertRule,
  listAlertRules,
  orgPerformanceAlertsEnabled,
  updateAlertRule,
} from "../services/alert-rules.service.js";
import { appendAuditLog } from "../services/audit-log.service.js";
import { CAP_MARKETING_SETTINGS_WRITE } from "../constants/capabilities.js";
import { createAlertRuleSchema, patchAlertRuleSchema } from "../validators/alert-rules.validator.js";

type AuthRequest = Request & { user: JwtPayload };

export async function getAlertRulesHandler(req: Request, res: Response) {
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
    return res.json({ items: [] as const, performanceAlerts: false });
  }
  const items = await listAlertRules(organizationId);
  return res.json({ items, performanceAlerts: true });
}

export async function postAlertRuleHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  if (!organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  const parsed = createAlertRuleSchema.safeParse(req.body);
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
  const item = await createAlertRule(organizationId, parsed.data);
  await appendAuditLog({
    actorUserId: userId,
    organizationId,
    action: "marketing.alert_rule.create",
    entityType: "AlertRule",
    entityId: item.id,
    metadata: { name: item.name, metric: item.metric },
    ip: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  }).catch((err) => console.error("[audit] marketing.alert_rule.create", err));
  return res.status(201).json({ item });
}

export async function patchAlertRuleHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  if (!organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
  }
  const parsed = patchAlertRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Dados inválidos", issues: parsed.error.flatten() });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ message: "Nenhum campo para atualizar" });
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
  const item = await updateAlertRule(organizationId, id, parsed.data);
  if (!item) {
    return res.status(404).json({ message: "Regra não encontrada" });
  }
  await appendAuditLog({
    actorUserId: userId,
    organizationId,
    action: "marketing.alert_rule.update",
    entityType: "AlertRule",
    entityId: id,
    metadata: parsed.data,
    ip: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  }).catch((err) => console.error("[audit] marketing.alert_rule.update", err));
  return res.json({ item });
}

export async function deleteAlertRuleHandler(req: Request, res: Response) {
  const { userId, organizationId } = (req as AuthRequest).user;
  const { id } = req.params;
  if (!organizationId) {
    return res.status(401).json({ message: "Não autorizado" });
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
  const deleted = await deleteAlertRule(organizationId, id);
  if (!deleted) {
    return res.status(404).json({ message: "Regra não encontrada" });
  }
  await appendAuditLog({
    actorUserId: userId,
    organizationId,
    action: "marketing.alert_rule.delete",
    entityType: "AlertRule",
    entityId: id,
    ip: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  }).catch((err) => console.error("[audit] marketing.alert_rule.delete", err));
  return res.status(204).send();
}
