import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import type { MetricsDateRange } from "@/lib/integrations-api";
import type { MarketingDashboardGoalContext } from "@/lib/business-goal-mode";
import type { MarketingDashboardPayload, MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import {
  fetchMarketingSummaryContract,
  fetchMarketingTimeseriesContract,
} from "@/lib/marketing-contract-api";
import {
  fetchMarketingDashboardIntegrationStatus,
  fetchMarketingDashboardPerformance,
} from "@/lib/marketing-dashboard-api";

export type DashboardBlockKey = "summary" | "timeseries" | "performance" | "integration";

export type DashboardBlockState = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

const EMPTY_DISTRIBUTION: Extract<MarketingDashboardPayload, { ok: true }>["distribution"] = {
  byPlatform: [{ platform: "Meta Ads", spendSharePct: 100, spend: "0" }],
  byTemperature: [],
  byScore: { A: 0, B: 0, C: 0, D: 0 },
};

const EMPTY_PERF: Extract<MarketingDashboardPayload, { ok: true }>["performanceByLevel"] = {
  campaigns: [],
  adsets: [],
  ads: [],
};

const DEFAULT_INTEGRATION: Extract<MarketingDashboardPayload, { ok: true }>["integrationStatus"] = {
  metaAds: { connected: true, healthy: true },
  googleAds: { connected: false, status: "not_connected" },
};

type Slice = {
  range?: { start: string; end: string };
  summary?: MarketingDashboardSummary;
  distribution?: Extract<MarketingDashboardPayload, { ok: true }>["distribution"];
  timeseries?: Extract<MarketingDashboardPayload, { ok: true }>["timeseries"];
  performanceByLevel?: Extract<MarketingDashboardPayload, { ok: true }>["performanceByLevel"];
  integrationStatus?: Extract<MarketingDashboardPayload, { ok: true }>["integrationStatus"];
  goalContext?: MarketingDashboardGoalContext;
};

function storageKey(organizationId: string, range: MetricsDateRange): string {
  return `ativadash:dashboard:v1:${organizationId}:${range.startDate}:${range.endDate}`;
}

function initialBlocks(loading: boolean): Record<DashboardBlockKey, DashboardBlockState> {
  return {
    summary: { loading, refreshing: false, error: null },
    timeseries: { loading, refreshing: false, error: null },
    performance: { loading, refreshing: false, error: null },
    integration: { loading, refreshing: false, error: null },
  };
}

/**
 * Carrega o dashboard executivo em blocos paralelos, com stale-while-revalidate (sessionStorage)
 * e sem limpar a tela ao atualizar.
 */
export function useMarketingDashboardBlocks(hasMeta: boolean, dateRange: MetricsDateRange) {
  const organizationId = useAuthStore((s) => s.user?.organizationId ?? "");

  const [slice, setSlice] = useState<Slice>({});
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Record<DashboardBlockKey, DashboardBlockState>>(() => initialBlocks(false));
  const [dashUpdatedAt, setDashUpdatedAt] = useState<Date | null>(null);

  const sliceRef = useRef(slice);
  sliceRef.current = slice;

  useEffect(() => {
    setFatalError(null);
    if (!organizationId || !hasMeta) {
      setSlice({});
      return;
    }
    try {
      const raw = sessionStorage.getItem(storageKey(organizationId, dateRange));
      if (!raw) {
        setSlice({});
        return;
      }
      const p = JSON.parse(raw) as MarketingDashboardPayload;
      if (
        p.ok === true &&
        p.range.start === dateRange.startDate &&
        p.range.end === dateRange.endDate
      ) {
        setSlice({
          range: p.range,
          summary: p.summary,
          distribution: p.distribution,
          timeseries: p.timeseries,
          performanceByLevel: p.performanceByLevel,
          integrationStatus: p.integrationStatus,
          goalContext: p.goalContext,
        });
      } else {
        setSlice({});
      }
    } catch {
      setSlice({});
    }
  }, [organizationId, hasMeta, dateRange.startDate, dateRange.endDate]);

  const persistFull = useCallback(
    (payload: Extract<MarketingDashboardPayload, { ok: true }>) => {
      if (!organizationId) return;
      try {
        sessionStorage.setItem(storageKey(organizationId, dateRange), JSON.stringify(payload));
      } catch {
        /* quota */
      }
    },
    [organizationId, dateRange.startDate, dateRange.endDate]
  );

  const loadDashboard = useCallback(
    async (refresh = false) => {
      if (!hasMeta || !organizationId) {
        setSlice({});
        setFatalError(null);
        setBlocks(initialBlocks(false));
        return;
      }

      const had = sliceRef.current;
      const hadSummary = !!had.summary;

      setBlocks({
        summary: {
          loading: !hadSummary && !refresh,
          refreshing: hadSummary && refresh,
          error: null,
        },
        timeseries: {
          loading: !had.timeseries && !refresh,
          refreshing: !!had.timeseries && refresh,
          error: null,
        },
        performance: {
          loading: !had.performanceByLevel && !refresh,
          refreshing: !!had.performanceByLevel && refresh,
          error: null,
        },
        integration: {
          loading: !had.integrationStatus && !refresh,
          refreshing: !!had.integrationStatus && refresh,
          error: null,
        },
      });

      const [sumRes, tsRes, perfRes, integRes] = await Promise.all([
        fetchMarketingSummaryContract(dateRange, refresh),
        fetchMarketingTimeseriesContract(dateRange, refresh),
        fetchMarketingDashboardPerformance(dateRange, refresh),
        fetchMarketingDashboardIntegrationStatus(dateRange, refresh),
      ]);

      if (!sumRes.ok) {
        setFatalError(sumRes.message);
        setBlocks({
          summary: { loading: false, refreshing: false, error: sumRes.message },
          timeseries: { loading: false, refreshing: false, error: null },
          performance: { loading: false, refreshing: false, error: null },
          integration: { loading: false, refreshing: false, error: null },
        });
        return;
      }

      setFatalError(null);
      setSlice((s) => ({
        ...s,
        range: sumRes.range,
        summary: sumRes.summary,
        distribution: sumRes.distribution,
        goalContext: sumRes.goalContext,
      }));

      if (tsRes.ok) {
        setSlice((s) => ({ ...s, timeseries: tsRes.points }));
        setBlocks((b) => ({ ...b, timeseries: { ...b.timeseries, loading: false, refreshing: false, error: null } }));
      } else {
        setBlocks((b) => ({
          ...b,
          timeseries: { ...b.timeseries, loading: false, refreshing: false, error: tsRes.message },
        }));
      }

      if (perfRes.ok) {
        setSlice((s) => ({ ...s, performanceByLevel: perfRes.performanceByLevel }));
        setBlocks((b) => ({
          ...b,
          performance: { ...b.performance, loading: false, refreshing: false, error: null },
        }));
      } else {
        setBlocks((b) => ({
          ...b,
          performance: { ...b.performance, loading: false, refreshing: false, error: perfRes.message },
        }));
      }

      if (integRes.ok === true && "integrationStatus" in integRes) {
        setSlice((s) => ({ ...s, integrationStatus: integRes.integrationStatus }));
        setBlocks((b) => ({
          ...b,
          integration: { ...b.integration, loading: false, refreshing: false, error: null },
        }));
      } else {
        const msg = integRes.ok === false ? integRes.message : "Erro ao carregar integrações.";
        setBlocks((b) => ({
          ...b,
          integration: { ...b.integration, loading: false, refreshing: false, error: msg },
        }));
      }

      setBlocks((b) => ({
        ...b,
        summary: { ...b.summary, loading: false, refreshing: false, error: null },
      }));

      if (sumRes.ok && tsRes.ok && perfRes.ok && integRes.ok === true) {
        const full: Extract<MarketingDashboardPayload, { ok: true }> = {
          ok: true,
          range: sumRes.range,
          summary: sumRes.summary,
          timeseries: tsRes.points,
          distribution: sumRes.distribution,
          performanceByLevel: perfRes.performanceByLevel,
          integrationStatus: integRes.integrationStatus,
          goalContext: sumRes.goalContext,
        };
        persistFull(full);
        setDashUpdatedAt(new Date());
      } else if (sumRes.ok) {
        setDashUpdatedAt(new Date());
      }
    },
    [hasMeta, organizationId, dateRange, persistFull]
  );

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  const mergedDash: MarketingDashboardPayload | undefined = useMemo(() => {
    if (fatalError) return { ok: false, message: fatalError };
    if (!slice.summary || !slice.range) return undefined;
    return {
      ok: true,
      range: slice.range,
      summary: slice.summary,
      timeseries: slice.timeseries ?? [],
      distribution: slice.distribution ?? EMPTY_DISTRIBUTION,
      performanceByLevel: slice.performanceByLevel ?? EMPTY_PERF,
      integrationStatus: slice.integrationStatus ?? DEFAULT_INTEGRATION,
      goalContext: slice.goalContext,
    };
  }, [slice, fatalError]);

  const showFullSkeleton =
    hasMeta &&
    !fatalError &&
    !slice.summary &&
    (blocks.summary.loading || blocks.integration.loading);

  const anyRefreshing =
    blocks.summary.refreshing ||
    blocks.timeseries.refreshing ||
    blocks.performance.refreshing ||
    blocks.integration.refreshing;

  return {
    dash: mergedDash,
    slice,
    blocks,
    fatalError,
    loadDashboard,
    dashUpdatedAt,
    showFullSkeleton,
    anyRefreshing,
    dashboardMetaSummary: slice.summary,
    dashboardGoalContext: slice.goalContext,
  };
}
