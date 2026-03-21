import { useState, useEffect } from "react";
import {
  evaluateMarketingInsights,
  type EvaluateInsightsResponse,
} from "@/lib/marketing-settings-api";

export function usePerformanceInsights(
  period: "7d" | "30d" | "90d",
  totals: {
    totalSpendBrl: number;
    totalResults: number;
    totalAttributedValueBrl: number;
  } | null,
  /** Rótulo exibido nos insights quando o período é customizado ou um preset nomeado. */
  periodLabel?: string
): { data: EvaluateInsightsResponse | null; loading: boolean } {
  const [data, setData] = useState<EvaluateInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!totals) {
      setData(null);
      setLoading(false);
      return;
    }
    const { totalSpendBrl, totalResults, totalAttributedValueBrl } = totals;
    if (totalSpendBrl <= 0 && totalResults <= 0 && totalAttributedValueBrl <= 0) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    evaluateMarketingInsights(period, totals, periodLabel)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    period,
    periodLabel,
    totals?.totalSpendBrl,
    totals?.totalResults,
    totals?.totalAttributedValueBrl,
  ]);

  return { data, loading };
}
