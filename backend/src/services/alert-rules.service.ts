import { Prisma, type AlertRule } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { getEffectivePlanFeatures } from "./effective-plan-features.service.js";
import type { CreateAlertRuleInput, PatchAlertRuleInput } from "../validators/alert-rules.validator.js";

const ALERT_OCCURRENCE_DEDUPE_MS = 4 * 60 * 60 * 1000;

function decToNumber(v: unknown): number {
  if (v == null) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export type AlertRuleRoutingDto = {
  jobTitleSlugs?: string[];
  userIds?: string[];
  customPhones?: string[];
};

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
  actionType: string;
  evaluationLevel: string | null;
  checkFrequency: string | null;
  actionWindowStartLocal: string | null;
  actionWindowEndLocal: string | null;
  messageTemplate: string | null;
  routing: AlertRuleRoutingDto | null;
  evaluationTimeLocal: string | null;
  evaluationTimezone: string | null;
  thresholdRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export function parseAlertRuleRouting(raw: unknown): AlertRuleRoutingDto | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: AlertRuleRoutingDto = {};
  if (Array.isArray(o.jobTitleSlugs)) out.jobTitleSlugs = o.jobTitleSlugs.filter((x) => typeof x === "string");
  if (Array.isArray(o.userIds)) out.userIds = o.userIds.filter((x) => typeof x === "string");
  if (Array.isArray(o.customPhones)) out.customPhones = o.customPhones.filter((x) => typeof x === "string");
  if (!out.jobTitleSlugs?.length && !out.userIds?.length && !out.customPhones?.length) return null;
  return out;
}

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
    actionType: row.actionType ?? "whatsapp_alert",
    evaluationLevel: row.evaluationLevel?.trim() || null,
    checkFrequency: row.checkFrequency?.trim() || null,
    actionWindowStartLocal: row.actionWindowStartLocal?.trim() || null,
    actionWindowEndLocal: row.actionWindowEndLocal?.trim() || null,
    messageTemplate: row.messageTemplate ?? null,
    routing: parseAlertRuleRouting(row.routing),
    evaluationTimeLocal: row.evaluationTimeLocal ?? null,
    evaluationTimezone: row.evaluationTimezone ?? null,
    thresholdRef: row.thresholdRef?.trim() || null,
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

export async function acknowledgeAllAlertOccurrences(organizationId: string): Promise<{ updated: number }> {
  const res = await prisma.alertOccurrence.updateMany({
    where: { organizationId, acknowledgedAt: null },
    data: { acknowledgedAt: new Date() },
  });
  return { updated: res.count };
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
      thresholdRef: input.thresholdRef?.trim() || null,
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
      actionType: input.actionType ?? "whatsapp_alert",
      evaluationLevel: input.evaluationLevel?.trim() || null,
      checkFrequency: input.checkFrequency?.trim() || null,
      actionWindowStartLocal: input.actionWindowStartLocal?.trim() || null,
      actionWindowEndLocal: input.actionWindowEndLocal?.trim() || null,
      messageTemplate: input.messageTemplate ?? null,
      evaluationTimeLocal: input.evaluationTimeLocal ?? null,
      evaluationTimezone: input.evaluationTimezone?.trim() || null,
      ...(input.routing !== undefined
        ? {
            routing:
              input.routing === null ? Prisma.JsonNull : (input.routing as Prisma.InputJsonValue),
          }
        : {}),
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
  if (input.actionType !== undefined) data.actionType = input.actionType;
  if (input.messageTemplate !== undefined) data.messageTemplate = input.messageTemplate;
  if (input.routing !== undefined) {
    data.routing = input.routing === null ? Prisma.JsonNull : (input.routing as Prisma.InputJsonValue);
  }
  if (input.evaluationTimeLocal !== undefined) data.evaluationTimeLocal = input.evaluationTimeLocal;
  if (input.evaluationTimezone !== undefined) data.evaluationTimezone = input.evaluationTimezone?.trim() || null;
  if (input.thresholdRef !== undefined) {
    data.thresholdRef = input.thresholdRef === null ? null : input.thresholdRef.trim();
  }
  if (input.evaluationLevel !== undefined) {
    data.evaluationLevel = input.evaluationLevel === null ? null : input.evaluationLevel.trim();
  }
  if (input.checkFrequency !== undefined) {
    data.checkFrequency = input.checkFrequency === null ? null : input.checkFrequency.trim();
  }
  if (input.actionWindowStartLocal !== undefined) {
    data.actionWindowStartLocal = input.actionWindowStartLocal?.trim() || null;
  }
  if (input.actionWindowEndLocal !== undefined) {
    data.actionWindowEndLocal = input.actionWindowEndLocal?.trim() || null;
  }

  const row = await prisma.alertRule.update({
    where: { id },
    data: data as Prisma.AlertRuleUpdateInput,
  });
  return toDto(row);
}

export async function deleteAlertRule(organizationId: string, id: string): Promise<boolean> {
  const r = await prisma.alertRule.deleteMany({
    where: { id, organizationId },
  });
  return r.count > 0;
}
