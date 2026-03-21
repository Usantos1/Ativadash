import { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchIntegrations,
  fetchGoogleAdsMetrics,
  fetchMetaAdsMetrics,
  type GoogleAdsMetricsResponse,
  type MetaAdsMetricsResponse,
  type MetricsDateRange,
} from "@/lib/integrations-api";
import { buildInsightTotals } from "@/lib/marketing-totals";
import { usePerformanceInsights } from "@/hooks/usePerformanceInsights";
import {
  defaultLast30ApiRange,
  inferInsightPeriod,
  previousPeriodOfEqualLength,
  pushRecentPreset,
  type MarketingPresetId,
} from "@/lib/marketing-date-presets";
import type { DateFilterApplyPayload } from "@/components/marketing/MarketingDateRangeDialog";

export function useMarketingMetrics() {
  const [dateRange, setDateRange] = useState<MetricsDateRange>(() => defaultLast30ApiRange());
  const [dateRangeLabel, setDateRangeLabel] = useState("Últimos 30 dias");
  const [presetId, setPresetId] = useState<MarketingPresetId>("last_30d");
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
    let cancelled = false;
    fetchIntegrations()
      .then((list) => {
        if (!cancelled) {
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
          "Não foi possível carregar os dados. Verifique se o Developer Token do Google Ads está configurado no servidor."
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
        setMetaMetricsError("Não foi possível carregar os dados do Meta Ads.");
      } else if (!data.ok) {
        setMetaMetrics(null);
        setMetaMetricsError(data.message);
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
  const insightTotals = useMemo(() => buildInsightTotals(metrics, metaMetrics), [metrics, metaMetrics]);
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
    setCompareEnabled(p.compareEnabled);
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
