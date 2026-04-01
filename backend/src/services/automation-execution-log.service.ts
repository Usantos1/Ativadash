import { prisma } from "../utils/prisma.js";
import type { PostAutomationExecutionLogInput } from "../validators/automation-execution-log.validator.js";

export type AutomationExecutionLogDto = {
  id: string;
  organizationId: string;
  ruleId: string;
  ruleName: string;
  assetId: string;
  assetLabel: string | null;
  actionTaken: string;
  previousValue: string | null;
  newValue: string | null;
  executedAt: string;
};

export async function listAutomationExecutionLogs(
  organizationId: string,
  opts?: { limit?: number }
): Promise<AutomationExecutionLogDto[]> {
  const limit = Math.min(200, Math.max(1, opts?.limit ?? 80));
  const rows = await prisma.automationExecutionLog.findMany({
    where: { organizationId },
    orderBy: { executedAt: "desc" },
    take: limit,
    include: { rule: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    ruleId: r.ruleId,
    ruleName: r.rule.name,
    assetId: r.assetId,
    assetLabel: r.assetLabel,
    actionTaken: r.actionTaken,
    previousValue: r.previousValue,
    newValue: r.newValue,
    executedAt: r.executedAt.toISOString(),
  }));
}

export async function appendAutomationExecutionLog(
  organizationId: string,
  input: PostAutomationExecutionLogInput
): Promise<AutomationExecutionLogDto | null> {
  const rule = await prisma.alertRule.findFirst({
    where: { id: input.ruleId, organizationId },
    select: { id: true, name: true },
  });
  if (!rule) return null;
  const row = await prisma.automationExecutionLog.create({
    data: {
      organizationId,
      ruleId: input.ruleId,
      assetId: input.assetId.trim(),
      assetLabel: input.assetLabel?.trim() || null,
      actionTaken: input.actionTaken.trim(),
      previousValue: input.previousValue?.trim() || null,
      newValue: input.newValue?.trim() || null,
    },
    include: { rule: { select: { name: true } } },
  });
  return {
    id: row.id,
    organizationId: row.organizationId,
    ruleId: row.ruleId,
    ruleName: row.rule.name,
    assetId: row.assetId,
    assetLabel: row.assetLabel,
    actionTaken: row.actionTaken,
    previousValue: row.previousValue,
    newValue: row.newValue,
    executedAt: row.executedAt.toISOString(),
  };
}
