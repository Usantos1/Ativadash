import type { AlertRule } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { getEffectivePlanFeatures } from "./effective-plan-features.service.js";
import type { CreateAlertRuleInput, PatchAlertRuleInput } from "../validators/alert-rules.validator.js";

const ALERT_OCCURRENCE_DEDUPE_MS = 4 * 60 * 60 * 1000;

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
  appliesToChannel: string | null;
  notifyWhatsapp: boolean;
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
    appliesToChannel: row.appliesToChannel?.trim() ? row.appliesToChannel.trim() : null,
    notifyWhatsapp: row.notifyWhatsapp !== false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function orgPerformanceAlertsEnabled(organizationId: string): Promise<boolean> {
  const features = await getEffectivePlanFeatures(organizationId);
  return !!features.performanceAlerts;
}

export async function recordAlertOccurrenceDeduped(
  organizationId: string,
  alertRuleId: string,
  payload: { severity: string; title: string; message: string; metricValue: number }
): Promise<void> {
  const since = new Date(Date.now() - ALERT_OCCURRENCE_DEDUPE_MS);
  const recent = await prisma.alertOccurrence.findFirst({
    where: { organizationId, alertRuleId, createdAt: { gte: since } },
    select: { id: true },
  });
  if (recent) return;
  await prisma.alertOccurrence.create({
    data: {
      organizationId,
      alertRuleId,
      severity: payload.severity,
      title: payload.title.slice(0, 200),
      message: payload.message,
      metricValue: payload.metricValue,
    },
  });
}

export type AlertOccurrenceDto = {
  id: string;
  alertRuleId: string;
  ruleName: string;
  severity: string;
  title: string;
  message: string;
  metricValue: number;
  createdAt: string;
  acknowledgedAt: string | null;
};

export async function listAlertOccurrences(
  organizationId: string,
  opts?: { limit?: number }
): Promise<AlertOccurrenceDto[]> {
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 30));
  const rows = await prisma.alertOccurrence.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { alertRule: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    alertRuleId: r.alertRuleId,
    ruleName: r.alertRule.name,
    severity: r.severity,
    title: r.title,
    message: r.message,
    metricValue: decToNumber(r.metricValue),
    createdAt: r.createdAt.toISOString(),
    acknowledgedAt: r.acknowledgedAt ? r.acknowledgedAt.toISOString() : null,
  }));
}

export async function acknowledgeAlertOccurrence(
  organizationId: string,
  occurrenceId: string
): Promise<{ ok: true } | { ok: false; code: "not_found" }> {
  const row = await prisma.alertOccurrence.findFirst({
    where: { id: occurrenceId, organizationId },
    select: { id: true },
  });
  if (!row) return { ok: false, code: "not_found" };
  await prisma.alertOccurrence.update({
    where: { id: occurrenceId },
    data: { acknowledgedAt: new Date() },
  });
  return { ok: true };
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
      appliesToChannel:
        input.appliesToChannel === "meta" || input.appliesToChannel === "google"
          ? input.appliesToChannel
          : input.appliesToChannel === "all"
            ? "all"
            : null,
      notifyWhatsapp: input.notifyWhatsapp !== false,
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
  if (input.appliesToChannel !== undefined) {
    data.appliesToChannel =
      input.appliesToChannel === "meta" || input.appliesToChannel === "google"
        ? input.appliesToChannel
        : input.appliesToChannel === "all"
          ? "all"
          : null;
  }
  if (input.notifyWhatsapp !== undefined) data.notifyWhatsapp = input.notifyWhatsapp;
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
