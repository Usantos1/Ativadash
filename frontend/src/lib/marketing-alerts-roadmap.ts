/**
 * Contratos previstos para alertas e relatórios (fora do dashboard principal).
 * Implementação futura: Metas e alertas → monitoramento → opcional WhatsApp diário.
 */
export type FutureAlertMetric = "CPL" | "CPA" | "ROAS" | "CTR" | "SPEND_SHARE";

export type FutureAlertScope = {
  channel?: "meta" | "google";
  campaignId?: string;
  /** Limite configurado em Metas e alertas */
  threshold?: number;
};

export type FutureDailyReportChannel = "whatsapp";
