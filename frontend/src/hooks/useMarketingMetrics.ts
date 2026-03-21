import { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchIntegrations,
  fetchGoogleAdsMetrics,
  fetchMetaAdsMetrics,
  type GoogleAdsMetricsResponse,
  type MetaAdsMetricsResponse,
} from "@/lib/integrations-api";
import { buildInsightTotals } from "@/lib/marketing-totals";
import { usePerformanceInsights } from "@/hooks/usePerformanceInsights";

export function useMarketingMetrics() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [hasGoogle, setHasGoogle] = useState(false);
  const [hasMeta, setHasMeta] = useState(false);
  const [metrics, setMetrics] = useState<GoogleAdsMetricsResponse | null>(null);
  const [metaMetrics, setMetaMetrics] = useState<MetaAdsMetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metaMetricsLoading, setMetaMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metaMetricsError, setMetaMetricsError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
      const data = await fetchGoogleAdsMetrics(period);
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
  }, [hasGoogle, period]);

  const loadMetaMetrics = useCallback(async () => {
    if (!hasMeta) return;
    setMetaMetricsLoading(true);
    setMetaMetricsError(null);
    try {
      const data = await fetchMetaAdsMetrics(period);
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
  }, [hasMeta, period]);

  useEffect(() => {
    if (hasGoogle) loadMetrics();
    else setMetrics(null);
  }, [hasGoogle, period, loadMetrics]);

  useEffect(() => {
    if (hasMeta) loadMetaMetrics();
    else setMetaMetrics(null);
  }, [hasMeta, period, loadMetaMetrics]);

  const insightTotals = useMemo(() => buildInsightTotals(metrics, metaMetrics), [metrics, metaMetrics]);
  const { data: insightData, loading: insightLoading } = usePerformanceInsights(period, insightTotals);

  const refreshAll = useCallback(() => {
    loadMetrics();
    loadMetaMetrics();
  }, [loadMetrics, loadMetaMetrics]);

  return {
    period,
    setPeriod,
    hasGoogle,
    hasMeta,
    metrics,
    metaMetrics,
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
