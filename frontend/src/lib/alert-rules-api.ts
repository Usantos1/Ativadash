import { api } from "./api";

export type AlertRuleMetric = "cpa" | "roas" | "spend" | "ctr" | "daily_spend";
export type AlertRuleThresholdRef =
  | "VAR_CHANNEL_MAX_CPA"
  | "VAR_CHANNEL_TARGET_ROAS"
  | "VAR_BLENDED_DAILY_BUDGET_MAX";
export type AlertRuleOperator =
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "outside_target"
  /** CPL entre meta e teto do canal (metas globais). */
  | "cpa_band";
export type AlertRuleSeverity = "warning" | "critical";
export type AlertRuleEvaluationLevel = "campaign" | "ad_set" | "ad";
export type AlertRuleCheckFrequency = "1h" | "3h" | "12h" | "daily";
/** Motor autónomo — alinhado ao enum Prisma `AutomationActionType`. */
export type AlertRuleActionType =
  | "NOTIFY_ONLY"
  | "PAUSE_ASSET"
  | "ACTIVATE_ASSET"
  | "INCREASE_BUDGET_20"
  | "DECREASE_BUDGET_20";

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
  actionValue?: number | null;
  cooldownMinutes?: number;
  checkFrequencyMinutes?: number | null;
  lastExecutedAt?: string | null;
  lastEvaluationAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AlertRulesListResponse = {
  items: AlertRuleDto[];
  performanceAlerts: boolean;
};

export async function fetchAlertRules(): Promise<AlertRulesListResponse> {
  return api.get<AlertRulesListResponse>("/marketing/alert-rules");
}

export type CreateAlertRulePayload = {
  name: string;
  metric: AlertRuleMetric;
  operator: AlertRuleOperator;
  threshold: number;
  severity: AlertRuleSeverity;
  active?: boolean;
  /** Silêncio UTC 0–23 (legado); use com cuidado junto da janela local. */
  muteStartHour?: number | null;
  muteEndHour?: number | null;
  appliesToChannel?: "meta" | "google" | "all";
  notifyWhatsapp?: boolean;
  actionType?: AlertRuleActionType;
  evaluationLevel?: AlertRuleEvaluationLevel | null;
  checkFrequency?: AlertRuleCheckFrequency | null;
  actionWindowStartLocal?: string | null;
  actionWindowEndLocal?: string | null;
  messageTemplate?: string | null;
  routing?: AlertRuleRoutingDto | null;
  evaluationTimeLocal?: string | null;
  evaluationTimezone?: string | null;
  thresholdRef?: AlertRuleThresholdRef | null;
  actionValue?: number | null;
  cooldownMinutes?: number;
  checkFrequencyMinutes?: number | null;
};

export async function createAlertRule(payload: CreateAlertRulePayload): Promise<AlertRuleDto> {
  const res = await api.post<{ item: AlertRuleDto }>("/marketing/alert-rules", payload);
  return res.item;
}

export async function patchAlertRule(
  id: string,
  payload: Partial<CreateAlertRulePayload>
): Promise<AlertRuleDto> {
  const res = await api.patch<{ item: AlertRuleDto }>(`/marketing/alert-rules/${id}`, payload);
  return res.item;
}

export async function deleteAlertRule(id: string): Promise<void> {
  await api.delete(`/marketing/alert-rules/${id}`);
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

export async function fetchAlertOccurrences(limit = 30): Promise<{ items: AlertOccurrenceDto[] }> {
  const q = new URLSearchParams({ limit: String(limit) });
  return api.get<{ items: AlertOccurrenceDto[] }>(`/marketing/alert-occurrences?${q.toString()}`);
}

export async function acknowledgeAlertOccurrence(occurrenceId: string): Promise<{ ok: true }> {
  return api.patch<{ ok: true }>(`/marketing/alert-occurrences/${encodeURIComponent(occurrenceId)}/ack`, {});
}

export async function acknowledgeAllAlertOccurrences(): Promise<{ ok: true; updated: number }> {
  return api.patch<{ ok: true; updated: number }>("/marketing/alert-occurrences/ack-all", {});
}

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

export async function fetchAutomationExecutionLogs(limit = 80): Promise<{ items: AutomationExecutionLogDto[] }> {
  const q = new URLSearchParams({ limit: String(limit) });
  return api.get<{ items: AutomationExecutionLogDto[] }>(`/marketing/automation-execution-logs?${q.toString()}`);
}

export type PostAutomationExecutionLogPayload = {
  ruleId: string;
  assetId: string;
  assetLabel?: string | null;
  actionTaken: string;
  previousValue?: string | null;
  newValue?: string | null;
};

export async function postAutomationExecutionLog(
  payload: PostAutomationExecutionLogPayload
): Promise<{ item: AutomationExecutionLogDto }> {
  return api.post<{ item: AutomationExecutionLogDto }>("/marketing/automation-execution-logs", payload);
}
