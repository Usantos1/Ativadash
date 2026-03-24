import type { AlertRule } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { mergePlanFeaturesWithOverrides } from "../utils/plan-features.js";
import { resolveBillingOrganizationId, resolveEffectivePlan } from "./plan-limits.service.js";
import type { CreateAlertRuleInput, PatchAlertRuleInput } from "../validators/alert-rules.validator.js";

function decToNumber(v: unknown): number {
  if (v == null) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export type AlertRuleDto = {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  severity: string;
  active: boolean;
  muteStartHour: number | null;
  muteEndHour: number | null;
  createdAt: string;
  updatedAt: string;
};

function toDto(row: AlertRule): AlertRuleDto {
  return {
    id: row.id,
    name: row.name,
    metric: row.metric,
    operator: row.operator,
    threshold: decToNumber(row.threshold),
    severity: row.severity,
    active: row.active,
    muteStartHour: row.muteStartHour,
    muteEndHour: row.muteEndHour,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function orgPerformanceAlertsEnabled(organizationId: string): Promise<boolean> {
  const billingId = await resolveBillingOrganizationId(organizationId);
  const { plan } = await resolveEffectivePlan(organizationId);
  const billingOrg = await prisma.organization.findFirst({
    where: { id: billingId, deletedAt: null },
    select: { featureOverrides: true },
  });
  const features = mergePlanFeaturesWithOverrides(plan, billingOrg?.featureOverrides);
  return !!features.performanceAlerts;
}

export async function listAlertRules(organizationId: string): Promise<AlertRuleDto[]> {
  const rows = await prisma.alertRule.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDto);
}

export async function createAlertRule(
  organizationId: string,
  input: CreateAlertRuleInput
): Promise<AlertRuleDto> {
  const row = await prisma.alertRule.create({
    data: {
      organizationId,
      name: input.name.trim(),
      metric: input.metric,
      operator: input.operator,
      threshold: input.threshold,
      severity: input.severity,
      active: input.active ?? true,
      muteStartHour: input.muteStartHour ?? null,
      muteEndHour: input.muteEndHour ?? null,
    },
  });
  return toDto(row);
}

export async function updateAlertRule(
  organizationId: string,
  id: string,
  input: PatchAlertRuleInput
): Promise<AlertRuleDto | null> {
  const existing = await prisma.alertRule.findFirst({
    where: { id, organizationId },
  });
  if (!existing) return null;
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.metric !== undefined) data.metric = input.metric;
  if (input.operator !== undefined) data.operator = input.operator;
  if (input.threshold !== undefined) data.threshold = input.threshold;
  if (input.severity !== undefined) data.severity = input.severity;
  if (input.active !== undefined) data.active = input.active;
  if (input.muteStartHour !== undefined) data.muteStartHour = input.muteStartHour;
  if (input.muteEndHour !== undefined) data.muteEndHour = input.muteEndHour;
  const row = await prisma.alertRule.update({
    where: { id },
    data,
  });
  return toDto(row);
}

export async function deleteAlertRule(organizationId: string, id: string): Promise<boolean> {
  const r = await prisma.alertRule.deleteMany({
    where: { id, organizationId },
  });
  return r.count > 0;
}
