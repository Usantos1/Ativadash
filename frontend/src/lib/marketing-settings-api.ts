import { api } from "./api";

export type MarketingSettingsDto = {
  targetCpaBrl: number | null;
  maxCpaBrl: number | null;
  targetRoas: number | null;
  minResultsForCpa: number;
  minSpendForAlertsBrl: number | null;
  alertsEnabled: boolean;
  alertCpaAboveMax: boolean;
  alertCpaAboveTarget: boolean;
  alertRoasBelowTarget: boolean;
};

export type InsightAlert = {
  severity: "critical" | "warning" | "info" | "success";
  code: string;
  title: string;
  message: string;
};

export type EvaluateInsightsResponse = {
  kpis: { cpa: number | null; roas: number | null };
  alerts: InsightAlert[];
  periodLabel: string;
};

export async function fetchMarketingSettings(): Promise<MarketingSettingsDto> {
  const res = await api.get<{ settings: MarketingSettingsDto }>("/marketing/settings");
  return res.settings;
}

export type UpdateMarketingSettingsPayload = Partial<{
  targetCpaBrl: number | null;
  maxCpaBrl: number | null;
  targetRoas: number | null;
  minResultsForCpa: number;
  minSpendForAlertsBrl: number | null;
  alertsEnabled: boolean;
  alertCpaAboveMax: boolean;
  alertCpaAboveTarget: boolean;
  alertRoasBelowTarget: boolean;
}>;

export async function saveMarketingSettings(
  payload: UpdateMarketingSettingsPayload
): Promise<MarketingSettingsDto> {
  const res = await api.put<{ settings: MarketingSettingsDto }>("/marketing/settings", payload);
  return res.settings;
}

export async function evaluateMarketingInsights(
  period: "7d" | "30d" | "90d",
  totals: {
    totalSpendBrl: number;
    totalResults: number;
    totalAttributedValueBrl: number;
  }
): Promise<EvaluateInsightsResponse> {
  return api.post<EvaluateInsightsResponse>("/marketing/insights/evaluate", {
    period,
    ...totals,
  });
}
