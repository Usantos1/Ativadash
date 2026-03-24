import { api } from "./api";

export type BusinessGoalMode = "LEADS" | "SALES" | "HYBRID";

export type MarketingSettingsDto = {
  businessGoalMode: BusinessGoalMode;
  primaryConversionLabel: string | null;
  showRevenueBlocksInLeadMode: boolean;
  targetCpaBrl: number | null;
  maxCpaBrl: number | null;
  targetRoas: number | null;
  minResultsForCpa: number;
  minSpendForAlertsBrl: number | null;
  alertsEnabled: boolean;
  alertCpaAboveMax: boolean;
  alertCpaAboveTarget: boolean;
  alertRoasBelowTarget: boolean;
  ativaCrmTokenConfigured: boolean;
  ativaCrmNotifyPhone: string | null;
  ativaCrmAlertsEnabled: boolean;
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
  businessGoalMode: BusinessGoalMode;
  /** string vazio ou null limpa o rótulo customizado */
  primaryConversionLabel: string | null;
  showRevenueBlocksInLeadMode: boolean;
  targetCpaBrl: number | null;
  maxCpaBrl: number | null;
  targetRoas: number | null;
  minResultsForCpa: number;
  minSpendForAlertsBrl: number | null;
  alertsEnabled: boolean;
  alertCpaAboveMax: boolean;
  alertCpaAboveTarget: boolean;
  alertRoasBelowTarget: boolean;
  /** string = gravar; null = apagar token */
  ativaCrmApiToken: string | null;
  ativaCrmNotifyPhone: string | null;
  ativaCrmAlertsEnabled: boolean;
}>;

export async function saveMarketingSettings(
  payload: UpdateMarketingSettingsPayload
): Promise<MarketingSettingsDto> {
  const res = await api.put<{ settings: MarketingSettingsDto }>("/marketing/settings", payload);
  return res.settings;
}

export async function sendAtivaCrmTestMessage(message?: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await api.post<{ ok: boolean; message: string }>("/marketing/ativacrm/test-message", {
      message: message?.trim() || undefined,
    });
    return { ok: true, message: res.message };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Não foi possível enviar o teste.",
    };
  }
}

export async function evaluateMarketingInsights(
  period: "7d" | "30d" | "90d",
  totals: {
    totalSpendBrl: number;
    totalResults: number;
    totalAttributedValueBrl: number;
    totalImpressions?: number;
    totalClicks?: number;
  },
  periodLabel?: string,
  opts?: { persistOccurrences?: boolean }
): Promise<EvaluateInsightsResponse> {
  return api.post<EvaluateInsightsResponse>("/marketing/insights/evaluate", {
    period,
    ...totals,
    ...(periodLabel?.trim() ? { periodLabel: periodLabel.trim() } : {}),
    ...(opts?.persistOccurrences === false ? { persistOccurrences: false } : {}),
  });
}
