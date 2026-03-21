import type { GoogleAdsMetricsResponse, MetaAdsMetricsResponse } from "@/lib/integrations-api";

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
  const metaPurch = metaOk ? (metaMetrics.summary.purchases ?? 0) : 0;
  const metaVal = metaOk ? (metaMetrics.summary.purchaseValue ?? 0) : 0;

  return {
    totalSpendBrl: googleSpend + metaSpend,
    totalResults: googleConv + metaLeads + metaPurch,
    totalAttributedValueBrl: googleVal + metaVal,
  };
}
