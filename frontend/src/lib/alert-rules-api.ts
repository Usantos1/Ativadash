import { api } from "./api";

export type AlertRuleMetric = "cpa" | "roas" | "spend" | "ctr";
export type AlertRuleOperator = "gt" | "gte" | "lt" | "lte";
export type AlertRuleSeverity = "warning" | "critical";

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
  muteStartHour?: number | null;
  muteEndHour?: number | null;
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
