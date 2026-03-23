import type { GoogleAdsMetricsResponse, MetaAdsMetricsResponse } from "@/lib/integrations-api";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";

/** Totais consolidados Google + Meta para avaliação de CPA/ROAS e alertas. */
export function buildInsightTotals(
  metrics: GoogleAdsMetricsResponse | null,
  metaMetrics: MetaAdsMetricsResponse | null
): { totalSpendBrl: number; totalResults: number; totalAttributedValueBrl: number } | null {
  const googleOk = metrics?.ok === true;
  const metaOk = metaMetrics?.ok === true;
  if (!googleOk && !metaOk) return null;

  const googleSpend = googleOk ? metrics.summary.costMicros / 1_000_000 : 0;
  const metaSpend = metaOk ? metaMetrics.summary.spend : 0;
  const googleConv = googleOk ? metrics.summary.conversions : 0;
  const googleVal = googleOk ? (metrics.summary.conversionsValue ?? 0) : 0;
  const metaLeads = metaOk ? (metaMetrics.summary.leads ?? 0) : 0;
  const metaMsg = metaOk ? (metaMetrics.summary.messagingConversationsStarted ?? 0) : 0;
  const metaPurch = metaOk ? (metaMetrics.summary.purchases ?? 0) : 0;
  const metaVal = metaOk ? (metaMetrics.summary.purchaseValue ?? 0) : 0;

  return {
    totalSpendBrl: googleSpend + metaSpend,
    totalResults: googleConv + metaLeads + metaMsg + metaPurch,
    totalAttributedValueBrl: googleVal + metaVal,
  };
}

/** Totais para alertas quando o resumo Meta vem do endpoint `/marketing/dashboard`. */
export function buildInsightTotalsFromDashboardSummary(
  summary: MarketingDashboardSummary | null,
  google: GoogleAdsMetricsResponse | null
): { totalSpendBrl: number; totalResults: number; totalAttributedValueBrl: number } | null {
  const googleOk = google?.ok === true;
  const googleSpend = googleOk ? google.summary.costMicros / 1_000_000 : 0;
  const googleConv = googleOk ? google.summary.conversions : 0;
  const googleVal = googleOk ? (google.summary.conversionsValue ?? 0) : 0;

  if (!summary) {
    if (!googleOk) return null;
    return {
      totalSpendBrl: googleSpend,
      totalResults: googleConv,
      totalAttributedValueBrl: googleVal,
    };
  }

  const metaSpend = summary.spend;
  const metaResults = summary.leads + summary.messagingConversations + summary.purchases;
  const metaVal = summary.purchaseValue;

  if (!googleOk && metaSpend === 0 && metaResults === 0 && metaVal === 0) return null;

  return {
    totalSpendBrl: googleSpend + metaSpend,
    totalResults: googleConv + metaResults,
    totalAttributedValueBrl: googleVal + metaVal,
  };
}
