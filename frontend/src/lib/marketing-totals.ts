import type { GoogleAdsMetricsResponse, MetaAdsMetricsResponse } from "@/lib/integrations-api";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";

export type InsightTotalsInput = {
  totalSpendBrl: number;
  totalResults: number;
  totalAttributedValueBrl: number;
  totalImpressions?: number;
  totalClicks?: number;
};

/** Totais consolidados Google + Meta para avaliação de CPA/ROAS e alertas. */
export function buildInsightTotals(
  metrics: GoogleAdsMetricsResponse | null,
  metaMetrics: MetaAdsMetricsResponse | null
): InsightTotalsInput | null {
  const googleOk = metrics?.ok === true;
  const metaOk = metaMetrics?.ok === true;
  if (!googleOk && !metaOk) return null;

  const googleSpend = googleOk ? metrics.summary.costMicros / 1_000_000 : 0;
  const metaSpend = metaOk ? metaMetrics.summary.spend : 0;
  const googleConv = googleOk ? metrics.summary.conversions : 0;
  const googleVal = googleOk ? (metrics.summary.conversionsValue ?? 0) : 0;
  const googleImp = googleOk ? metrics.summary.impressions : 0;
  const googleClk = googleOk ? metrics.summary.clicks : 0;
  const metaLeads = metaOk ? (metaMetrics.summary.leads ?? 0) : 0;
  const metaMsg = metaOk ? (metaMetrics.summary.messagingConversationsStarted ?? 0) : 0;
  const metaPurch = metaOk ? (metaMetrics.summary.purchases ?? 0) : 0;
  const metaVal = metaOk ? (metaMetrics.summary.purchaseValue ?? 0) : 0;
  const metaImp = metaOk ? metaMetrics.summary.impressions : 0;
  const metaClk = metaOk ? metaMetrics.summary.clicks : 0;

  return {
    totalSpendBrl: googleSpend + metaSpend,
    totalResults: googleConv + metaLeads + metaMsg + metaPurch,
    totalAttributedValueBrl: googleVal + metaVal,
    totalImpressions: googleImp + metaImp,
    totalClicks: googleClk + metaClk,
  };
}

/** Totais para alertas quando o resumo Meta vem do endpoint `/marketing/dashboard`. */
export function buildInsightTotalsFromDashboardSummary(
  summary: MarketingDashboardSummary | null,
  google: GoogleAdsMetricsResponse | null
): InsightTotalsInput | null {
  const googleOk = google?.ok === true;
  const googleSpend = googleOk ? google.summary.costMicros / 1_000_000 : 0;
  const googleConv = googleOk ? google.summary.conversions : 0;
  const googleVal = googleOk ? (google.summary.conversionsValue ?? 0) : 0;
  const googleImp = googleOk ? google.summary.impressions : 0;
  const googleClk = googleOk ? google.summary.clicks : 0;

  if (!summary) {
    if (!googleOk) return null;
    return {
      totalSpendBrl: googleSpend,
      totalResults: googleConv,
      totalAttributedValueBrl: googleVal,
      totalImpressions: googleImp,
      totalClicks: googleClk,
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
    totalImpressions: googleImp + summary.impressions,
    totalClicks: googleClk + summary.clicks,
  };
}

/** Totais só Meta Ads (CPL/ROAS do canal). */
export function buildMetaChannelTotals(metaMetrics: MetaAdsMetricsResponse | null): InsightTotalsInput | null {
  if (!metaMetrics?.ok) return null;
  const s = metaMetrics.summary;
  const spend = s.spend;
  const results =
    (s.leads ?? 0) + (s.messagingConversationsStarted ?? 0) + (s.purchases ?? 0);
  const value = s.purchaseValue ?? 0;
  if (spend === 0 && results === 0 && value === 0) return null;
  return {
    totalSpendBrl: spend,
    totalResults: results,
    totalAttributedValueBrl: value,
    totalImpressions: s.impressions,
    totalClicks: s.clicks,
  };
}

/** Totais só Google Ads. */
export function buildGoogleChannelTotals(metrics: GoogleAdsMetricsResponse | null): InsightTotalsInput | null {
  if (!metrics?.ok) return null;
  const s = metrics.summary;
  const spend = s.costMicros / 1_000_000;
  const results = s.conversions;
  const value = s.conversionsValue ?? 0;
  if (spend === 0 && results === 0 && value === 0) return null;
  return {
    totalSpendBrl: spend,
    totalResults: results,
    totalAttributedValueBrl: value,
    totalImpressions: s.impressions,
    totalClicks: s.clicks,
  };
}
