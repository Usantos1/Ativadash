import { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchIntegrations,
  fetchGoogleAdsMetrics,
  fetchMetaAdsMetrics,
  type GoogleAdsMetricsResponse,
  type MetaAdsMetricsResponse,
  type MetricsDateRange,
} from "@/lib/integrations-api";
import { buildInsightTotals, type InsightTotalsInput as InsightTotalsShape } from "@/lib/marketing-totals";
import { usePerformanceInsights } from "@/hooks/usePerformanceInsights";
import {
  inferInsightPeriod,
  previousPeriodOfEqualLength,
  pushRecentPreset,
  type MarketingPresetId,
} from "@/lib/marketing-date-presets";
import {
  getInitialMarketingPeriodState,
  persistMarketingPeriod,
  refreshPresetDatesIfNeeded,
} from "@/lib/marketing-period-storage";
import type { DateFilterApplyPayload } from "@/components/marketing/MarketingDateRangeDialog";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import { buildInsightTotalsFromDashboardSummary } from "@/lib/marketing-totals";

export type InsightTotalsInput = InsightTotalsShape | null;

export function useMarketingMetrics(opts?: {
  /** Se definido, substitui buildInsightTotals (ex.: totais vindos de GET /marketing/dashboard). */
  insightTotalsOverride?: InsightTotalsInput | undefined;
  /** Resumo Meta do dashboard agregado; combinado com Google de `metrics` para alertas. */
  dashboardMetaSummary?: MarketingDashboardSummary | undefined;
}) {
  const [dateRange, setDateRange] = useState<MetricsDateRange>(() => {
    const i = getInitialMarketingPeriodState();
    return { startDate: i.dateRange.startDate, endDate: i.dateRange.endDate };
  });
  const [dateRangeLabel, setDateRangeLabel] = useState(() => getInitialMarketingPeriodState().dateRangeLabel);
  const [presetId, setPresetId] = useState<MarketingPresetId>(() => getInitialMarketingPeriodState().presetId);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [hasGoogle, setHasGoogle] = useState(false);
  const [hasMeta, setHasMeta] = useState(false);
  const [metrics, setMetrics] = useState<GoogleAdsMetricsResponse | null>(null);
  const [metaMetrics, setMetaMetrics] = useState<MetaAdsMetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metaMetricsLoading, setMetaMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metaMetricsError, setMetaMetricsError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [cmpMetrics, setCmpMetrics] = useState<GoogleAdsMetricsResponse | null>(null);
  const [cmpMetaMetrics, setCmpMetaMetrics] = useState<MetaAdsMetricsResponse | null>(null);
  const [cmpLoading, setCmpLoading] = useState(false);

  const compareRange = useMemo<MetricsDateRange | null>(() => {
    if (!compareEnabled) return null;
    return previousPeriodOfEqualLength(dateRange.startDate, dateRange.endDate);
  }, [compareEnabled, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    const init = getInitialMarketingPeriodState();
    const r = refreshPresetDatesIfNeeded(init.presetId);
    if (r) {
      setDateRange({ startDate: r.startDate, endDate: r.endDate });
      setDateRangeLabel(r.label);
      persistMarketingPeriod({
        presetId: init.presetId,
        startDate: r.startDate,
        endDate: r.endDate,
        label: r.label,
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchIntegrations()
      .then((res) => {
        if (!cancelled) {
          const list = res.integrations;
          setHasGoogle(list.some((i) => i.slug === "google-ads" && i.status === "connected"));
          setHasMeta(list.some((i) => i.slug === "meta" && i.status === "connected"));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasGoogle(false);
          setHasMeta(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMetrics = useCallback(async () => {
    if (!hasGoogle) return;
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const data = await fetchGoogleAdsMetrics(dateRange);
      if (!data) {
        setMetrics(null);
        setMetricsError(
          "Não foi possível sincronizar o Google Ads agora. O painel segue com os dados da Meta Ads."
        );
      } else if (!data.ok) {
        setMetrics(null);
        setMetricsError(data.message);
      } else {
        setMetrics(data);
        setMetricsError(null);
        setLastUpdated(new Date());
      }
    } catch {
      setMetrics(null);
      setMetricsError("Erro ao buscar métricas.");
    } finally {
      setMetricsLoading(false);
    }
  }, [hasGoogle, dateRange.startDate, dateRange.endDate]);

  const loadMetaMetrics = useCallback(async () => {
    if (!hasMeta) return;
    setMetaMetricsLoading(true);
    setMetaMetricsError(null);
    try {
      const data = await fetchMetaAdsMetrics(dateRange);
      if (!data) {
        setMetaMetrics(null);
        setMetaMetricsError("Não foi possível carregar os dados do Meta Ads. Tente atualizar em instantes.");
      } else if (!data.ok) {
        setMetaMetrics(null);
        setMetaMetricsError(
          data.message.includes("META_APP_SECRET")
            ? "Dados da Meta temporariamente indisponíveis neste ambiente."
            : data.message
        );
      } else {
        setMetaMetrics(data);
        setMetaMetricsError(null);
        setLastUpdated(new Date());
      }
    } catch {
      setMetaMetrics(null);
      setMetaMetricsError("Erro ao buscar métricas do Meta Ads.");
    } finally {
      setMetaMetricsLoading(false);
    }
  }, [hasMeta, dateRange.startDate, dateRange.endDate]);

  const loadComparison = useCallback(async () => {
    if (!compareRange) {
      setCmpMetrics(null);
      setCmpMetaMetrics(null);
      return;
    }
    setCmpLoading(true);
    try {
      if (hasGoogle) {
        const d = await fetchGoogleAdsMetrics(compareRange);
        setCmpMetrics(d && d.ok ? d : null);
      } else setCmpMetrics(null);
      if (hasMeta) {
        const d = await fetchMetaAdsMetrics(compareRange);
        setCmpMetaMetrics(d && d.ok ? d : null);
      } else setCmpMetaMetrics(null);
    } catch {
      setCmpMetrics(null);
      setCmpMetaMetrics(null);
    } finally {
      setCmpLoading(false);
    }
  }, [compareRange, hasGoogle, hasMeta]);

  useEffect(() => {
    if (hasGoogle) loadMetrics();
    else setMetrics(null);
  }, [hasGoogle, loadMetrics]);

  useEffect(() => {
    if (hasMeta) loadMetaMetrics();
    else setMetaMetrics(null);
  }, [hasMeta, loadMetaMetrics]);

  useEffect(() => {
    if (compareEnabled && compareRange && (hasGoogle || hasMeta)) {
      loadComparison();
    } else {
      setCmpMetrics(null);
      setCmpMetaMetrics(null);
    }
  }, [compareEnabled, compareRange, hasGoogle, hasMeta, loadComparison]);

  const insightPeriod = inferInsightPeriod(dateRange.startDate, dateRange.endDate);
  const insightTotals = useMemo(() => {
    if (opts?.insightTotalsOverride !== undefined) {
      return opts.insightTotalsOverride;
    }
    if (opts?.dashboardMetaSummary != null) {
      return buildInsightTotalsFromDashboardSummary(
        opts.dashboardMetaSummary,
        metrics?.ok === true ? metrics : null
      );
    }
    return buildInsightTotals(metrics, metaMetrics);
  }, [opts?.insightTotalsOverride, opts?.dashboardMetaSummary, metrics, metaMetrics]);
  const { data: insightData, loading: insightLoading } = usePerformanceInsights(
    insightPeriod,
    insightTotals,
    dateRangeLabel
  );

  const refreshAll = useCallback(() => {
    loadMetrics();
    loadMetaMetrics();
    if (compareEnabled && compareRange) loadComparison();
  }, [loadMetrics, loadMetaMetrics, loadComparison, compareEnabled, compareRange]);

  function applyDateFilter(p: DateFilterApplyPayload) {
    setDateRange({ startDate: p.startDate, endDate: p.endDate });
    setDateRangeLabel(p.label);
    setPresetId(p.presetId);
    setCompareEnabled(false);
    persistMarketingPeriod(p);
    if (p.presetId !== "custom") {
      pushRecentPreset(p.presetId);
    }
  }

  return {
    dateRange,
    dateRangeLabel,
    presetId,
    compareEnabled,
    pickerOpen,
    setPickerOpen,
    applyDateFilter,
    hasGoogle,
    hasMeta,
    metrics,
    metaMetrics,
    cmpMetrics,
    cmpMetaMetrics,
    cmpLoading,
    metricsLoading,
    metaMetricsLoading,
    metricsError,
    metaMetricsError,
    loadMetrics,
    loadMetaMetrics,
    refreshAll,
    lastUpdated,
    insightTotals,
    insightData,
    insightLoading,
  };
}
