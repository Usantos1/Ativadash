import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, RefreshCw } from "lucide-react";
import { formatSpend, formatNumber } from "@/lib/metrics-format";
import { downloadPainelAdsReportPdf, type PainelAdsKpiRow } from "@/lib/export-pdf";
import { downloadCsv } from "@/lib/export-csv";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import type { MarketingDashboardPerfRow, MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import type { MetaAdsMetricsSummary } from "@/lib/integrations-api";
import { defaultMarketingGoalContext } from "@/lib/business-goal-mode";
import { deriveChannelPerformanceSignals } from "@/lib/channel-performance-compare";
import { resolveExecutiveChannelBadge } from "@/lib/channel-executive-badge";
import { buildConsolidatedAccountKpis } from "@/lib/consolidated-account-kpis";
import {
  fetchGoogleAdsAdGroups,
  fetchGoogleAdsAds,
  fetchGoogleAdsSetup,
  fetchMetaAdsSetup,
  type GoogleAdsAdGroupRow,
  type GoogleAdsAdRow,
} from "@/lib/integrations-api";
import {
  mapGoogleAdGroupToPerfRow,
  mapGoogleAdToPerfRow,
  mapGoogleCampaignToPerfRow,
} from "@/lib/google-ads-perf-mapper";
import { fetchMarketingSettings, type MarketingSettingsDto } from "@/lib/marketing-settings-api";
import { ExecutiveFunnel } from "@/components/dashboard/ExecutiveFunnel";
import {
  buildAdaptiveFunnelModelFromSteps,
  buildGoogleAdsFunnelModel,
  buildMonetizationStepsFromSummary,
  buildStepsFromSummaryForBusinessGoal,
} from "@/components/dashboard/funnel-flow.logic";
import {
  buildGoogleChannelPerformanceLayout,
  buildMetaChannelPerformanceLayout,
} from "@/components/dashboard/build-channel-performance-layout";
import { ChannelWidget } from "@/components/dashboard/ChannelWidget";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { useMarketingDashboardBlocks } from "@/hooks/useMarketingDashboardBlocks";
import { DashboardFunnelRatesWidget } from "@/components/dashboard/dashboard-funnel-rates-widget";
import { DashboardAttributionPanel } from "@/components/dashboard/DashboardAttributionPanel";
import {
  DashboardDailyChartSection,
  type DailyChartRow,
} from "@/components/dashboard/DashboardDailyChartSection";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardPlatformDiagnostics } from "@/components/dashboard/DashboardPlatformDiagnostics";
import { DashboardPerformanceTable } from "@/components/dashboard/dashboard-performance-table";
import { ConsolidatedSummaryGrid } from "@/components/dashboard/ConsolidatedSummaryGrid";

const GOOGLE_ADS_API_NOT_READY_COPY =
  "Google Ads em preparação neste ambiente. Quando a API estiver liberada, os dados aparecerão automaticamente.";

const GOOGLE_ADS_PENDING_CONFIGURATION_COPY =
  "Google Ads conectado, mas o servidor ainda não tem o Developer Token (GOOGLE_ADS_DEVELOPER_TOKEN). Configure na API para habilitar métricas.";

function googleAdsPendingHint(
  status: "api_not_ready" | "pending_configuration" | "connected" | "not_connected"
): string {
  if (status === "pending_configuration") return GOOGLE_ADS_PENDING_CONFIGURATION_COPY;
  if (status === "api_not_ready") return GOOGLE_ADS_API_NOT_READY_COPY;
  return GOOGLE_ADS_API_NOT_READY_COPY;
}

function relDelta(
  current: number,
  prev: number,
  compareEnabled: boolean
): { pct: number } | undefined {
  if (!compareEnabled || prev <= 0 || !Number.isFinite(current) || !Number.isFinite(prev)) return undefined;
  return { pct: ((current - prev) / prev) * 100 };
}

type DailyChartSourceRow = {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctrPct: number | null;
};

function buildDailyChartRows(
  startDate: string,
  endDate: string,
  rows: DailyChartSourceRow[]
): DailyChartRow[] {
  if (!rows.length) return [];
  const map = new Map(rows.map((row) => [row.date, row]));
  const from = parseISO(startDate);
  const to = parseISO(endDate);
  const days = eachDayOfInterval({ start: from, end: to });
  return days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const row = map.get(key);
    const imp = row?.impressions ?? 0;
    const clk = row?.clicks ?? 0;
    const spend = row?.spend ?? 0;
    const leads = row?.leads ?? 0;
    return {
      label: format(day, "d/MMM", { locale: ptBR }),
      spend,
      leads,
      ctr: row?.ctrPct ?? (imp > 0 ? (clk / imp) * 100 : null),
      cpl: leads > 0 && spend > 0 ? spend / leads : null,
    };
  });
}

function dailySeriesTitle(series: "spend" | "leads" | "ctr" | "cpl"): string {
  if (series === "spend") return "Série diária · investimento";
  if (series === "leads") return "Série diária · leads";
  if (series === "cpl") return "Série diária · CPL";
  return "Série diária · CTR";
}

type MetaLevel = "campaign" | "adset" | "ad";
type GoogleTableLevel = "campaign" | "adgroup" | "ad";

export function DashboardSingleClient() {
  const navigate = useNavigate();
  const wsName = useAuthStore((s) => s.user?.organization?.name?.trim()) ?? "Dashboard";

  const [dashboardSummaryForInsights, setDashboardSummaryForInsights] = useState<
    MarketingDashboardSummary | undefined
  >(undefined);

  const {
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
    cmpMetrics,
    cmpMetaMetrics,
    metricsLoading,
    metaMetricsLoading,
    metricsError,
    refreshAll,
  } = useMarketingMetrics({ dashboardMetaSummary: dashboardSummaryForInsights });

  const {
    dash,
    slice,
    blocks,
    loadDashboard,
    dashUpdatedAt,
    showFullSkeleton,
    anyRefreshing,
    dashboardMetaSummary,
    dashboardGoalContext,
  } = useMarketingDashboardBlocks(hasMeta, dateRange);

  useEffect(() => {
    setDashboardSummaryForInsights(dashboardMetaSummary);
  }, [dashboardMetaSummary]);

  const googleOk = metrics?.ok === true;
  const metaOk = dash?.ok === true;
  const summary = metaOk ? dash.summary : null;

  const goalCtx = useMemo(() => {
    if (metaOk && dash?.ok && dash.goalContext) return dash.goalContext;
    if (dashboardGoalContext) return dashboardGoalContext;
    return defaultMarketingGoalContext();
  }, [metaOk, dash, dashboardGoalContext]);

  const metaSpend = summary?.spend ?? 0;
  const googleSpendBrl = googleOk ? metrics.summary.costMicros / 1_000_000 : 0;
  const cmpMetaSpend = cmpMetaMetrics?.ok ? cmpMetaMetrics.summary.spend : 0;

  const googleDerived = useMemo(() => {
    if (!googleOk || !metrics?.ok) return null;
    const s = metrics.summary;
    const spend = s.costMicros / 1_000_000;
    const ctrPct = s.impressions > 0 ? (s.clicks / s.impressions) * 100 : null;
    const cpc = s.clicks > 0 ? spend / s.clicks : null;
    const costPerConv = s.conversions > 0 ? spend / s.conversions : null;
    return { spend, ctrPct, cpc, costPerConv };
  }, [googleOk, metrics]);

  const cmpGoogleSummary = cmpMetrics?.ok === true ? cmpMetrics.summary : null;

  const funnelVariant = goalCtx.dashboardModeConfig.funnelVariant;

  const metaFunnelModel = useMemo(() => {
    if (!metaOk || !summary) return null;
    if (funnelVariant === "hybrid") return null;
    const steps = buildStepsFromSummaryForBusinessGoal(summary, funnelVariant, goalCtx.primaryConversionLabel);
    return buildAdaptiveFunnelModelFromSteps(steps, "meta");
  }, [metaOk, summary, funnelVariant, goalCtx.primaryConversionLabel]);

  const metaFunnelCaptacao = useMemo(() => {
    if (!metaOk || !summary || funnelVariant !== "hybrid") return null;
    const steps = buildStepsFromSummaryForBusinessGoal(summary, "lead", goalCtx.primaryConversionLabel);
    return buildAdaptiveFunnelModelFromSteps(steps, "meta");
  }, [metaOk, summary, funnelVariant, goalCtx.primaryConversionLabel]);

  const metaFunnelMonetizacao = useMemo(() => {
    if (!metaOk || !summary || funnelVariant !== "hybrid") return null;
    const steps = buildMonetizationStepsFromSummary(summary);
    return buildAdaptiveFunnelModelFromSteps(steps, "meta");
  }, [metaOk, summary, funnelVariant]);

  const googleFunnelModel = useMemo(() => {
    if (!googleOk || !metrics?.ok) return null;
    return buildGoogleAdsFunnelModel(metrics.summary);
  }, [googleOk, metrics]);

  const hasAnyChannel = hasGoogle || hasMeta;

  const [metaLevel, setMetaLevel] = useState<MetaLevel>("campaign");
  const [googleTableLevel, setGoogleTableLevel] = useState<GoogleTableLevel>("campaign");
  const [perfPlatform, setPerfPlatform] = useState<"all" | "meta" | "google">("all");
  const [chartSeries, setChartSeries] = useState<"spend" | "leads" | "ctr" | "cpl">("spend");
  const [marketingSettings, setMarketingSettings] = useState<MarketingSettingsDto | null>(null);
  const [googleAdGroupRows, setGoogleAdGroupRows] = useState<GoogleAdsAdGroupRow[]>([]);
  const [googleAdRows, setGoogleAdRows] = useState<GoogleAdsAdRow[]>([]);
  const [googleDeepLoading, setGoogleDeepLoading] = useState(false);
  const [googleDeepError, setGoogleDeepError] = useState<string | null>(null);

  /**
   * Identificação da conta ativa por canal (usada nos headers dos ChannelWidgets).
   * Carregada apenas quando o canal está conectado para não pagar setup call desnecessário.
   * Meta: nome vem de `adAccounts[]` filtrando por `defaultAdAccountId`; fallback para facebookUserName.
   * Google: nome vem de `customers[]` filtrando por `defaultCustomerId`.
   */
  const [metaAccountInfo, setMetaAccountInfo] = useState<{ name: string | null; id: string | null } | null>(null);
  const [googleAccountInfo, setGoogleAccountInfo] = useState<{ name: string | null; id: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMarketingSettings()
      .then((s) => {
        if (!cancelled) setMarketingSettings(s);
      })
      .catch(() => {
        if (!cancelled) setMarketingSettings(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const metaConnected = dash?.ok && dash.integrationStatus.metaAds.connected;
    if (!metaConnected) {
      setMetaAccountInfo(null);
      return;
    }
    let cancelled = false;
    fetchMetaAdsSetup()
      .then((s) => {
        if (cancelled) return;
        const id = s.defaultAdAccountId ?? null;
        const match = id ? s.adAccounts.find((a) => a.accountId === id) : null;
        const name = match?.name?.trim() || s.facebookUserName?.trim() || null;
        setMetaAccountInfo({ name, id: id ? `act_${id}` : null });
      })
      .catch(() => {
        if (!cancelled) setMetaAccountInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [dash]);

  useEffect(() => {
    const googleConnected = dash?.ok && dash.integrationStatus.googleAds.connected;
    if (!googleConnected) {
      setGoogleAccountInfo(null);
      return;
    }
    let cancelled = false;
    fetchGoogleAdsSetup()
      .then((s) => {
        if (cancelled) return;
        const id = s.defaultCustomerId ?? null;
        const match = id ? s.customers.find((c) => c.customerId === id) : null;
        const name = match?.descriptiveName?.trim() || null;
        const idDisplay = id ? id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3") : null;
        setGoogleAccountInfo({ name, id: idDisplay });
      })
      .catch(() => {
        if (!cancelled) setGoogleAccountInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [dash]);

  useEffect(() => {
    if (!hasGoogle || metrics?.ok !== true) {
      setGoogleAdGroupRows([]);
      setGoogleAdRows([]);
      setGoogleDeepError(null);
      setGoogleDeepLoading(false);
      return;
    }
    let cancelled = false;
    setGoogleDeepLoading(true);
    setGoogleDeepError(null);
    Promise.all([fetchGoogleAdsAdGroups(dateRange), fetchGoogleAdsAds(dateRange)])
      .then(([ag, ads]) => {
        if (cancelled) return;
        const errs: string[] = [];
        if (ag && !ag.ok) errs.push(ag.message);
        if (ads && !ads.ok) errs.push(ads.message);
        setGoogleDeepError(errs.length ? errs.join(" · ") : null);
        setGoogleAdGroupRows(ag && ag.ok ? ag.rows : []);
        setGoogleAdRows(ads && ads.ok ? ads.rows : []);
      })
      .catch(() => {
        if (!cancelled) {
          setGoogleDeepError("Não foi possível carregar grupos/anúncios do Google.");
          setGoogleAdGroupRows([]);
          setGoogleAdRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setGoogleDeepLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasGoogle, metrics, dateRange.startDate, dateRange.endDate]);

  const channelTargets = useMemo(
    () => ({
      targetCpaBrl: marketingSettings?.targetCpaBrl ?? null,
      maxCpaBrl: marketingSettings?.maxCpaBrl ?? null,
      targetRoas: marketingSettings?.targetRoas ?? null,
    }),
    [marketingSettings]
  );

  const metaChartData = useMemo(() => {
    if (!metaOk || !dash.timeseries.length) return [];
    return buildDailyChartRows(
      dateRange.startDate,
      dateRange.endDate,
      dash.timeseries.map((row) => ({
        date: row.date,
        impressions: row.impressions,
        clicks: row.clicks,
        spend: row.spend,
        leads: row.leads,
        ctrPct: row.ctrPct,
      }))
    );
  }, [metaOk, dash, dateRange.startDate, dateRange.endDate]);

  const googleChartData = useMemo(() => {
    if (!googleOk || !metrics?.ok || !metrics.daily?.length) return [];
    return buildDailyChartRows(
      dateRange.startDate,
      dateRange.endDate,
      metrics.daily.map((row) => ({
        date: row.date,
        impressions: row.impressions,
        clicks: row.clicks,
        spend: row.costMicros / 1_000_000,
        leads: row.conversions,
        ctrPct: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : null,
      }))
    );
  }, [googleOk, metrics, dateRange.startDate, dateRange.endDate]);

  const perfRows = useMemo(() => {
    if (!metaOk) return { campaign: [] as MarketingDashboardPerfRow[], adset: [], ad: [] };
    return {
      campaign: dash.performanceByLevel.campaigns,
      adset: dash.performanceByLevel.adsets,
      ad: dash.performanceByLevel.ads,
    };
  }, [metaOk, dash]);

  const googlePerfCampaigns = useMemo(() => {
    if (!googleOk || !metrics?.ok) return [];
    return metrics.campaigns.map((c) => mapGoogleCampaignToPerfRow(c, goalCtx.businessGoalMode));
  }, [googleOk, metrics, goalCtx.businessGoalMode]);

  const googlePerfAdGroups = useMemo(
    () => googleAdGroupRows.map((r) => mapGoogleAdGroupToPerfRow(r, goalCtx.businessGoalMode)),
    [googleAdGroupRows, goalCtx.businessGoalMode]
  );

  const googlePerfAds = useMemo(
    () => googleAdRows.map((r) => mapGoogleAdToPerfRow(r, goalCtx.businessGoalMode)),
    [googleAdRows, goalCtx.businessGoalMode]
  );

  const refresh = useCallback(async () => {
    await refreshAll();
    await loadDashboard(true);
  }, [refreshAll, loadDashboard]);

  const displayUpdatedAt = dashUpdatedAt ?? null;

  const googlePending =
    metaOk &&
    (dash.integrationStatus.googleAds.status === "api_not_ready" ||
      dash.integrationStatus.googleAds.status === "pending_configuration");

  const cmpMetaSummary: MetaAdsMetricsSummary | null =
    cmpMetaMetrics?.ok === true ? cmpMetaMetrics.summary : null;

  const revenueMuted =
    goalCtx.flags.isLeadWorkspace && !goalCtx.showRevenueBlocksInLeadMode;

  const metaChannelLayout = useMemo(() => {
    if (!summary) return undefined;
    return buildMetaChannelPerformanceLayout(goalCtx.businessGoalMode, {
      summary,
      derived: summary.derived,
      metaSpend,
      cmpMetaSpend,
      compareEnabled,
      relDelta,
      leadLabel: goalCtx.primaryConversionLabel?.trim() || "Leads",
      cmpMeta: cmpMetaSummary,
      targets: channelTargets,
    });
  }, [
    summary,
    goalCtx.businessGoalMode,
    metaSpend,
    cmpMetaSpend,
    compareEnabled,
    goalCtx.primaryConversionLabel,
    cmpMetaSummary,
    channelTargets,
  ]);

  const googleChannelLayout = useMemo(() => {
    if (!googleOk || !metrics?.ok || !googleDerived) return undefined;
    return buildGoogleChannelPerformanceLayout(goalCtx.businessGoalMode, {
      googleDerived,
      metrics: metrics.summary,
      cmpGoogleSummary,
      compareEnabled,
      relDelta,
      leadLabel: goalCtx.primaryConversionLabel?.trim() || "Leads",
      targets: channelTargets,
    });
  }, [
    googleOk,
    metrics,
    googleDerived,
    goalCtx.businessGoalMode,
    goalCtx.primaryConversionLabel,
    cmpGoogleSummary,
    compareEnabled,
    channelTargets,
  ]);

  const metaWidgetLoading = blocks.summary.refreshing || metaMetricsLoading;
  const metaEmptyPeriod =
    metaSpend <= 0 && summary !== null && summary.impressions <= 0 && summary.clicks <= 0;

  const googleWidgetLoading = hasGoogle && metricsLoading && !googleOk;
  const googleStatus = metaOk && dash.ok ? dash.integrationStatus.googleAds.status : "not_connected";
  const googleNotConnected = hasGoogle && googleStatus === "not_connected";
  const googleBlockError =
    !googleWidgetLoading && metricsError && hasGoogle && !googleNotConnected ? metricsError : null;
  const googleEmptyPeriod =
    googleOk &&
    googleDerived &&
    googleDerived.spend <= 0 &&
    metrics!.summary.impressions <= 0 &&
    metrics!.summary.clicks <= 0;
  const currentDailySeriesTitle = dailySeriesTitle(chartSeries);

  const channelCompare = useMemo(() => {
    const empty = { meta: null, google: null, efficiencyWinner: null } as const;
    if (!metaOk || !summary || !hasGoogle || !googleOk || !metrics?.ok || !googleDerived) {
      return empty;
    }
    if (metaEmptyPeriod && googleEmptyPeriod) {
      return empty;
    }
    const metaActive =
      metaSpend > 0 || summary.leads > 0 || summary.purchases > 0 || summary.clicks > 0;
    const googleActive =
      googleDerived.spend > 0 || metrics.summary.conversions > 0 || metrics.summary.clicks > 0;
    if (!metaActive || !googleActive) {
      return empty;
    }
    const gRoas =
      googleDerived.spend > 0 && metrics.summary.conversionsValue > 0
        ? metrics.summary.conversionsValue / googleDerived.spend
        : null;
    return deriveChannelPerformanceSignals(goalCtx.businessGoalMode, {
      cpl: summary.derived.cplLeads,
      costPerPurchase: summary.derived.costPerPurchase,
      roas: summary.derived.roas,
    }, {
      costPerConv: googleDerived.costPerConv,
      roas: gRoas,
    });
  }, [
    metaOk,
    summary,
    hasGoogle,
    googleOk,
    metrics,
    googleDerived,
    goalCtx.businessGoalMode,
    metaEmptyPeriod,
    googleEmptyPeriod,
  ]);

  const metaExecutiveBadge = useMemo(() => {
    if (!summary) return null;
    const mode = goalCtx.businessGoalMode;
    const cplOrCpa =
      mode === "SALES" ? summary.derived.costPerPurchase : summary.derived.cplLeads;
    const results =
      mode === "SALES" ? summary.purchases : mode === "HYBRID" ? summary.leads : summary.leads;
    const prevResults =
      mode === "SALES"
        ? (cmpMetaSummary?.purchases ?? 0)
        : (cmpMetaSummary?.leads ?? 0);
    return resolveExecutiveChannelBadge({
      mode,
      crossSignal: channelCompare.meta,
      channel: "meta",
      efficiencyWinner: channelCompare.efficiencyWinner,
      cplOrCpa,
      ctrPct: summary.derived.ctrPct,
      impressions: summary.impressions,
      spend: metaSpend,
      results,
      targetCpaBrl: channelTargets.targetCpaBrl,
      maxCpaBrl: channelTargets.maxCpaBrl,
      compareEnabled,
      resultsDeltaPct: relDelta(results, prevResults, compareEnabled && !!cmpMetaSummary)?.pct,
      spendDeltaPct: relDelta(metaSpend, cmpMetaSpend, compareEnabled && !!cmpMetaSummary)?.pct,
    });
  }, [
    summary,
    goalCtx.businessGoalMode,
    channelCompare,
    metaSpend,
    compareEnabled,
    cmpMetaSummary,
    cmpMetaSpend,
    channelTargets,
  ]);

  const googleExecutiveBadge = useMemo(() => {
    if (!googleOk || !metrics?.ok || !googleDerived) return null;
    const mode = goalCtx.businessGoalMode;
    const spend = googleDerived.spend;
    const conv = metrics.summary.conversions;
    const prevConv = cmpGoogleSummary?.conversions ?? 0;
    const cmpSpend = (cmpGoogleSummary?.costMicros ?? 0) / 1_000_000;
    return resolveExecutiveChannelBadge({
      mode,
      crossSignal: channelCompare.google,
      channel: "google",
      efficiencyWinner: channelCompare.efficiencyWinner,
      cplOrCpa: googleDerived.costPerConv,
      ctrPct: googleDerived.ctrPct,
      impressions: metrics.summary.impressions,
      spend,
      results: conv,
      targetCpaBrl: channelTargets.targetCpaBrl,
      maxCpaBrl: channelTargets.maxCpaBrl,
      compareEnabled,
      resultsDeltaPct: relDelta(conv, prevConv, compareEnabled && !!cmpGoogleSummary)?.pct,
      spendDeltaPct: relDelta(spend, cmpSpend, compareEnabled && !!cmpGoogleSummary)?.pct,
    });
  }, [
    googleOk,
    metrics,
    googleDerived,
    goalCtx.businessGoalMode,
    channelCompare,
    compareEnabled,
    cmpGoogleSummary,
    channelTargets,
  ]);

  const consolidatedSummaryItems = useMemo(() => {
    if (!summary) return [];
    return buildConsolidatedAccountKpis(
      goalCtx.businessGoalMode,
      summary,
      metrics,
      cmpMetaSummary,
      cmpGoogleSummary,
      compareEnabled,
      relDelta,
      goalCtx.primaryConversionLabel?.trim() || "Leads",
      channelTargets
    );
  }, [
    summary,
    goalCtx.businessGoalMode,
    goalCtx.primaryConversionLabel,
    metrics,
    cmpMetaSummary,
    cmpGoogleSummary,
    compareEnabled,
    channelTargets,
  ]);

  const metaPerfChip =
    goalCtx.businessGoalMode === "SALES" &&
    summary &&
    summary.purchaseValue <= 0 &&
    summary.purchases <= 0
      ? "Sem receita"
      : null;
  const googlePerfChip =
    goalCtx.businessGoalMode === "SALES" &&
    googleOk &&
    metrics &&
    metrics.summary.conversionsValue <= 0
      ? "Sem receita"
      : null;

  const handleExportPdf = useCallback(() => {
    const fmtS = (v: number) => formatSpend(v);
    const fmtN = (v: number) => formatNumber(Math.round(v));
    const fmtPct = (v: number | null) => v != null ? `${v.toFixed(2)}%` : "—";
    const goalLabel =
      goalCtx.businessGoalMode === "SALES" ? "Vendas / ROAS"
        : goalCtx.businessGoalMode === "HYBRID" ? "Híbrido (leads + vendas)"
        : "Captação de leads";

    const totalSpend = metaSpend + googleSpendBrl;
    const metaLeads = summary ? summary.leads + summary.messagingConversations : 0;
    const googleConv = googleOk && metrics?.ok ? metrics.summary.conversions : 0;
    const totalLeads = metaLeads + googleConv;
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const metaRev = summary?.purchaseValue ?? 0;
    const googleRev = googleOk && metrics?.ok ? metrics.summary.conversionsValue ?? 0 : 0;
    const totalRev = metaRev + googleRev;
    const roas = totalSpend > 0 && totalRev > 0 ? totalRev / totalSpend : null;
    const totalImpr = (summary?.impressions ?? 0) + (googleOk && metrics?.ok ? metrics.summary.impressions : 0);
    const totalClicks = (summary?.clicks ?? 0) + (googleOk && metrics?.ok ? metrics.summary.clicks : 0);
    const ctr = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : null;

    const consolidated: PainelAdsKpiRow[] = [
      { label: "Investimento total", value: fmtS(totalSpend) },
      { label: "Leads / conversões", value: fmtN(totalLeads) },
      { label: "CPL médio", value: cpl > 0 ? fmtS(cpl) : "—" },
      { label: "Impressões", value: fmtN(totalImpr) },
      { label: "Cliques", value: fmtN(totalClicks) },
      { label: "CTR", value: fmtPct(ctr) },
    ];
    if (goalCtx.businessGoalMode !== "LEADS") {
      consolidated.push(
        { label: "Receita atribuída", value: totalRev > 0 ? fmtS(totalRev) : "—" },
        { label: "ROAS", value: roas != null ? `${roas.toFixed(2)}x` : "—" },
      );
    }

    const metaSection = summary ? {
      title: "Meta Ads",
      rows: [
        { label: "Investimento", value: fmtS(metaSpend) },
        { label: "Leads", value: fmtN(metaLeads) },
        { label: "CPL", value: summary.derived.cplLeads != null ? fmtS(summary.derived.cplLeads) : "—" },
        { label: "Impressões", value: fmtN(summary.impressions) },
        { label: "Cliques", value: fmtN(summary.clicks) },
        ...(goalCtx.businessGoalMode !== "LEADS" ? [
          { label: "Receita", value: metaRev > 0 ? fmtS(metaRev) : "—" },
          { label: "ROAS", value: metaSpend > 0 && metaRev > 0 ? `${(metaRev / metaSpend).toFixed(2)}x` : "—" },
        ] : []),
      ] as PainelAdsKpiRow[],
    } : undefined;

    const googleSection = googleOk && metrics?.ok ? {
      title: "Google Ads",
      rows: [
        { label: "Investimento", value: fmtS(googleSpendBrl) },
        { label: "Conversões", value: fmtN(googleConv) },
        { label: "CPA", value: googleDerived?.costPerConv != null ? fmtS(googleDerived.costPerConv) : "—" },
        { label: "Impressões", value: fmtN(metrics.summary.impressions) },
        { label: "Cliques", value: fmtN(metrics.summary.clicks) },
        ...(goalCtx.businessGoalMode !== "LEADS" ? [
          { label: "Receita", value: googleRev > 0 ? fmtS(googleRev) : "—" },
          { label: "ROAS", value: googleSpendBrl > 0 && googleRev > 0 ? `${(googleRev / googleSpendBrl).toFixed(2)}x` : "—" },
        ] : []),
      ] as PainelAdsKpiRow[],
    } : undefined;

    downloadPainelAdsReportPdf({
      filename: `dashboard-${dateRange.startDate}.pdf`,
      workspaceName: wsName,
      periodLabel: dateRangeLabel,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      objectiveLabel: goalLabel,
      consolidated,
      metaSection,
      googleSection,
    });
  }, [wsName, dateRange, dateRangeLabel, goalCtx.businessGoalMode, summary, metaSpend, googleSpendBrl, googleOk, metrics, googleDerived]);

  const handleExportXls = useCallback(() => {
    const rows: Record<string, unknown>[] = [];
    if (summary) {
      rows.push({
        canal: "Meta",
        investimento: metaSpend,
        impressoes: summary.impressions,
        cliques: summary.clicks,
        leads: summary.leads + summary.messagingConversations,
        cpl: summary.derived.cplLeads,
        compras: summary.purchases,
        receita: summary.purchaseValue,
        ctr_pct: summary.derived.ctrPct,
      });
    }
    if (googleOk && metrics?.ok) {
      const s = metrics.summary;
      rows.push({
        canal: "Google",
        investimento: s.costMicros / 1_000_000,
        impressoes: s.impressions,
        cliques: s.clicks,
        leads: s.conversions,
        cpl: s.conversions > 0 ? (s.costMicros / 1_000_000) / s.conversions : null,
        compras: s.conversions,
        receita: s.conversionsValue ?? 0,
        ctr_pct: s.impressions > 0 ? (s.clicks / s.impressions) * 100 : null,
      });
    }
    if (rows.length) downloadCsv(`dashboard-${dateRange.startDate}.csv`, rows);
  }, [summary, metaSpend, googleOk, metrics, dateRange.startDate]);

  return (
    <TooltipProvider delayDuration={180}>
      <div className={cn("w-full min-w-0 max-w-full space-y-6 pb-24 lg:pb-6")}>
        <DashboardHeader
          dateRange={dateRange}
          dateRangeLabel={dateRangeLabel}
          presetId={presetId}
          compareEnabled={compareEnabled}
          pickerOpen={pickerOpen}
          setPickerOpen={setPickerOpen}
          applyDateFilter={applyDateFilter}
          goalMode={goalCtx.businessGoalMode}
          onRefresh={() => void refresh()}
          refreshDisabled={anyRefreshing || metaMetricsLoading}
          showRefresh={hasMeta}
          hasData={hasAnyChannel && (metaOk || googleOk)}
          onExportPdf={handleExportPdf}
          onExportXls={handleExportXls}
        />

        {!hasAnyChannel ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <EmptyState
                icon={BarChart3}
                title="Conecte a Meta Ads"
                description="Conecte em Integrações para ver o painel executivo."
                actionLabel="Integrações"
                onAction={() => navigate("/marketing/integracoes")}
                className="min-h-[260px] rounded-2xl border-border/55 bg-card shadow-[var(--shadow-surface)]"
              />
            </div>
            <div className="rounded-2xl border border-border/50 p-4 text-sm">
              <p className="font-semibold">Atalhos</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link className="text-primary hover:underline" to="/marketing">
                    Marketing →
                  </Link>
                </li>
                <li>
                  <Link className="text-primary hover:underline" to="/marketing/integracoes">
                    Integrações →
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        ) : showFullSkeleton ? (
          <DashboardSkeleton />
        ) : hasMeta && dash && !dash.ok ? (
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-surface)]" role="alert">
            <p className="text-sm font-semibold">Painel Meta</p>
            <p className="mt-2 text-sm text-muted-foreground">{dash.message}</p>
            <Button variant="outline" size="sm" className="mt-4 rounded-full px-4" onClick={() => void loadDashboard(true)}>
              Tentar novamente
            </Button>
          </div>
        ) : metaOk && summary && dash ? (
          <div className="space-y-6 lg:space-y-10">
            {anyRefreshing ? (
              <div
                className="flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.04] px-4 py-2 text-xs font-medium text-primary"
                role="status"
              >
                <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                Atualizando dados do painel…
              </div>
            ) : null}
            {summary.reconciliation && !summary.reconciliation.spendMatchesSummary ? (
              <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                Aviso: divergência de gasto resumo vs. série — verifique logs do servidor se persistir.
              </p>
            ) : null}

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Canais
                </h2>
                {blocks.summary.refreshing ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-primary">
                    <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                    Atualizando
                  </span>
                ) : null}
              </div>
              <div
                className={cn(
                  "grid items-stretch gap-4",
                  hasGoogle ? "lg:grid-cols-2" : "grid-cols-1"
                )}
              >
                <ChannelWidget
                  channel="meta"
                  accent="purple"
                  businessGoalMode={goalCtx.businessGoalMode}
                  title="Meta Ads"
                  syncAt={displayUpdatedAt}
                  accountInfo={metaAccountInfo}
                  integrationLabel={
                    dash.integrationStatus.metaAds.connected
                      ? dash.integrationStatus.metaAds.healthy
                        ? "Conectado"
                        : "Integração instável"
                      : "Não conectado"
                  }
                  integrationTone={
                    dash.integrationStatus.metaAds.connected
                      ? dash.integrationStatus.metaAds.healthy
                        ? "success"
                        : "warning"
                      : "muted"
                  }
                  performanceChip={metaPerfChip}
                  executiveBadge={
                    !metaWidgetLoading &&
                    !metaEmptyPeriod &&
                    metaChannelLayout &&
                    dash.integrationStatus.metaAds.connected
                      ? metaExecutiveBadge
                      : null
                  }
                  layout={
                    metaWidgetLoading || metaEmptyPeriod || !metaChannelLayout ? undefined : metaChannelLayout
                  }
                  loading={metaWidgetLoading}
                  errorMessage={null}
                  notConnected={!dash.integrationStatus.metaAds.connected}
                  emptyMessage={
                    !metaWidgetLoading && metaEmptyPeriod ? "Sem dados no período para a Meta neste recorte." : null
                  }
                />

                {hasGoogle ? (
                  <ChannelWidget
                    channel="google"
                    accent="green"
                    businessGoalMode={goalCtx.businessGoalMode}
                    title="Google Ads"
                    syncAt={displayUpdatedAt}
                    accountInfo={googleAccountInfo}
                    integrationLabel={
                      googleStatus === "connected"
                        ? "Conectado"
                        : googleStatus === "pending_configuration"
                          ? "Pendente config."
                          : googleStatus === "api_not_ready"
                            ? "API indisponível"
                            : "Não conectado"
                    }
                    integrationTone={
                      googleStatus === "connected"
                        ? "success"
                        : googleStatus === "not_connected"
                          ? "muted"
                          : "warning"
                    }
                    performanceChip={googlePerfChip}
                    executiveBadge={
                      !googleWidgetLoading &&
                      !googleEmptyPeriod &&
                      googleChannelLayout &&
                      !googleNotConnected
                        ? googleExecutiveBadge
                        : null
                    }
                    layout={
                      googleWidgetLoading || googleEmptyPeriod || !googleChannelLayout
                        ? undefined
                        : googleChannelLayout
                    }
                    loading={googleWidgetLoading}
                    errorMessage={!googleWidgetLoading && metricsError ? metricsError : null}
                    notConnected={googleNotConnected}
                    emptyMessage={
                      !googleWidgetLoading && metricsError
                        ? null
                        : googleNotConnected
                          ? null
                          : !googleWidgetLoading && googleOk && googleEmptyPeriod
                            ? "Sem dados no período para o Google neste recorte."
                            : !googleWidgetLoading && !googleOk
                              ? googlePending
                                ? googleAdsPendingHint(dash.integrationStatus.googleAds.status)
                                : "Aguardando métricas do Google Ads."
                              : null
                    }
                  />
                ) : null}
              </div>
            </section>

            {consolidatedSummaryItems.length > 0 ? (
              <ConsolidatedSummaryGrid title="Resumo geral" items={consolidatedSummaryItems} />
            ) : null}

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Funil
                </h2>
                {blocks.summary.refreshing ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-primary">
                    <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                    Atualizando
                  </span>
                ) : null}
              </div>
              <div className="relative space-y-6">
              {funnelVariant === "hybrid" && metaFunnelCaptacao && metaFunnelMonetizacao ? (
                <>
                  <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
                    <ExecutiveFunnel
                      model={metaFunnelCaptacao}
                      summary={summary}
                      spend={metaSpend}
                      platform="meta"
                      companionRatesPanel
                      funnelHeadline="Captação"
                      className="h-full min-h-0"
                    />
                    <ExecutiveFunnel
                      model={metaFunnelMonetizacao}
                      summary={summary}
                      spend={metaSpend}
                      platform="meta"
                      companionRatesPanel
                      funnelHeadline="Monetização"
                      className="h-full min-h-0"
                    />
                  </div>
                  {hasGoogle ? (
                    <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
                      {googleFunnelModel ? (
                        <ExecutiveFunnel
                          model={googleFunnelModel}
                          summary={null}
                          spend={googleSpendBrl}
                          platform="google"
                          companionRatesPanel
                          funnelHeadline="Google Ads"
                          className="h-full min-h-0 lg:col-span-2"
                        />
                      ) : metricsLoading ? (
                        <div className="flex min-h-[280px] flex-col gap-3 rounded-xl border border-border/50 bg-card/80 p-5 shadow-[var(--shadow-surface)] lg:col-span-2">
                          <div className="flex items-center gap-2 border-b border-border/35 pb-3">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-[#34A853]" aria-hidden />
                            <Skeleton className="h-4 w-40" />
                          </div>
                          <Skeleton className="h-40 w-full rounded-lg" />
                        </div>
                      ) : (
                        <div className="flex min-h-[200px] flex-col justify-center rounded-xl border border-border/50 bg-card/80 p-5 text-center shadow-[var(--shadow-surface)] lg:col-span-2">
                          <p className="text-sm text-muted-foreground">
                            {metricsError
                              ? `Google Ads: ${metricsError}`
                              : googlePending
                                ? googleAdsPendingHint(dash.integrationStatus.googleAds.status)
                                : "Conecte o Google Ads para ver o funil desta rede."}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                  <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
                    <DashboardFunnelRatesWidget model={metaFunnelCaptacao} platform="meta" spend={metaSpend} className="min-h-0" />
                    <DashboardFunnelRatesWidget model={metaFunnelMonetizacao} platform="meta" spend={metaSpend} className="min-h-0" />
                  </div>
                  {hasGoogle ? (
                    <div className="grid gap-4 lg:grid-cols-1">
                      {googleFunnelModel ? (
                        <DashboardFunnelRatesWidget model={googleFunnelModel} platform="google" spend={googleSpendBrl} className="min-h-0" />
                      ) : metricsLoading ? (
                        <div className="flex min-h-[200px] flex-col gap-3 rounded-xl border border-border/50 bg-card/80 p-5 shadow-[var(--shadow-surface)]">
                          <div className="flex items-center gap-2 border-b border-border/35 pb-3">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-[#34A853]" aria-hidden />
                            <Skeleton className="h-4 w-44" />
                          </div>
                          <Skeleton className="h-16 w-full rounded-lg" />
                          <Skeleton className="h-24 w-full rounded-lg" />
                        </div>
                      ) : (
                        <div className="flex min-h-[200px] flex-col justify-center rounded-xl border border-border/50 bg-card/80 p-5 text-center shadow-[var(--shadow-surface)]">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#34A853]">
                            Conversão · Google Ads
                          </p>
                          <p className="mt-2 text-sm font-semibold text-foreground">Gargalos e taxas-chave</p>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {metricsError
                              ? `Google Ads: ${metricsError}`
                              : googlePending
                                ? googleAdsPendingHint(dash.integrationStatus.googleAds.status)
                                : "Conecte o Google Ads ou aguarde a API para ver taxas desta rede."}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}

              {funnelVariant !== "hybrid" ? (
                <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
                  {metaFunnelModel ? (
                    <ExecutiveFunnel
                      model={metaFunnelModel}
                      summary={summary}
                      spend={metaSpend}
                      platform="meta"
                      companionRatesPanel
                      className="h-full min-h-0"
                    />
                  ) : (
                    <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-border/50 bg-card/80 p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-surface)]">
                      Funil Meta indisponível no momento.
                    </div>
                  )}
                  <div className="min-h-0">
                    {hasGoogle ? (
                      googleFunnelModel ? (
                        <ExecutiveFunnel
                          model={googleFunnelModel}
                          summary={null}
                          spend={googleSpendBrl}
                          platform="google"
                          companionRatesPanel
                          className="h-full min-h-0"
                        />
                      ) : metricsLoading ? (
                        <div className="flex h-full min-h-[280px] flex-col gap-3 rounded-xl border border-border/50 bg-card/80 p-5 shadow-[var(--shadow-surface)]">
                          <div className="flex items-center gap-2 border-b border-border/35 pb-3">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-[#34A853]" aria-hidden />
                            <Skeleton className="h-4 w-40" />
                          </div>
                          <div className="flex flex-1 flex-col justify-center gap-2">
                            <Skeleton className="h-14 w-full rounded-lg" />
                            <Skeleton className="h-10 w-3/4 self-center rounded-lg" />
                            <Skeleton className="h-14 w-full rounded-lg" />
                            <Skeleton className="h-10 w-3/4 self-center rounded-lg" />
                            <Skeleton className="h-14 w-full rounded-lg" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full min-h-[280px] flex-col justify-center rounded-xl border border-border/50 bg-card/80 p-5 text-center shadow-[var(--shadow-surface)]">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#34A853]">
                            Fluxo de conversão · Google Ads
                          </p>
                          <p className="mt-3 text-sm font-semibold text-foreground">Funil de conversão</p>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {metricsError
                              ? `Google Ads: ${metricsError}`
                              : googlePending
                                ? googleAdsPendingHint(dash.integrationStatus.googleAds.status)
                                : "Conecte o Google Ads em Integrações ou aguarde a API para ver o funil desta rede."}
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="flex h-full min-h-[280px] flex-col justify-center rounded-xl border border-border/50 bg-card/80 p-5 text-center shadow-[var(--shadow-surface)]">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#34A853]">
                          Fluxo de conversão · Google Ads
                        </p>
                        <p className="mt-3 text-sm font-semibold text-foreground">Funil de conversão</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Conecte o Google Ads em Integrações para ver o funil desta rede ao lado do funil Meta.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {funnelVariant !== "hybrid" ? (
                <div className={cn("grid gap-5", hasGoogle ? "lg:grid-cols-2 lg:items-stretch" : "")}>
                  {metaFunnelModel ? (
                    <DashboardFunnelRatesWidget model={metaFunnelModel} platform="meta" spend={metaSpend} className="min-h-0" />
                  ) : (
                    <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-border/50 bg-card/80 p-5 text-sm text-muted-foreground shadow-[var(--shadow-surface)]">
                      Gargalos Meta indisponíveis no momento.
                    </div>
                  )}
                  {hasGoogle ? (
                    googleFunnelModel ? (
                      <DashboardFunnelRatesWidget model={googleFunnelModel} platform="google" spend={googleSpendBrl} className="min-h-0" />
                    ) : metricsLoading ? (
                      <div className="flex min-h-[200px] flex-col gap-3 rounded-xl border border-border/50 bg-card/80 p-5 shadow-[var(--shadow-surface)]">
                        <div className="flex items-center gap-2 border-b border-border/35 pb-3">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#34A853]" aria-hidden />
                          <Skeleton className="h-4 w-44" />
                        </div>
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-24 w-full rounded-lg" />
                      </div>
                    ) : (
                      <div className="flex min-h-[200px] flex-col justify-center rounded-xl border border-border/50 bg-card/80 p-5 text-center shadow-[var(--shadow-surface)]">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#34A853]">
                          Conversão · Google Ads
                        </p>
                        <p className="mt-2 text-sm font-semibold text-foreground">Gargalos e taxas-chave</p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {metricsError
                            ? `Google Ads: ${metricsError}`
                            : googlePending
                              ? googleAdsPendingHint(dash.integrationStatus.googleAds.status)
                              : "Conecte o Google Ads ou aguarde a API para ver taxas desta rede."}
                        </p>
                      </div>
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
            </section>

            <DashboardAttributionPanel
              summary={summary}
              revenueMuted={revenueMuted}
              derived={summary.derived}
            />

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Série diária
                </h2>
                {blocks.timeseries.refreshing ? (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
                    <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                    Atualizando
                  </span>
                ) : null}
              </div>
              <div className={cn("grid gap-4", hasGoogle ? "xl:grid-cols-2" : "")}>
                <DashboardDailyChartSection
                  title={`${currentDailySeriesTitle} · Meta Ads`}
                  chartData={metaChartData}
                  loading={Boolean(blocks.timeseries.loading && slice.timeseries === undefined)}
                  errorText={blocks.timeseries.error}
                  businessGoalMode={goalCtx.businessGoalMode}
                  chartSeries={chartSeries}
                  onSeriesChange={setChartSeries}
                  emptyText="Sem dados da Meta Ads no período selecionado."
                />
                {hasGoogle ? (
                  <DashboardDailyChartSection
                    title={`${currentDailySeriesTitle} · Google Ads`}
                    chartData={googleChartData}
                    loading={googleWidgetLoading}
                    errorText={googleBlockError}
                    businessGoalMode={goalCtx.businessGoalMode}
                    chartSeries={chartSeries}
                    onSeriesChange={setChartSeries}
                    showSeriesToggles={false}
                    emptyText="Sem dados do Google Ads no período selecionado."
                  />
                ) : null}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Distribuição por plataforma
              </h2>
              <DashboardPlatformDiagnostics dash={dash} />
            </section>

            <section className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Performance por nível
                </h2>
                {blocks.performance.refreshing ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-primary">
                    <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                    Atualizando
                  </span>
                ) : null}
              </div>
              {blocks.performance.error ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">{blocks.performance.error}</p>
              ) : null}
              {blocks.performance.loading && slice.performanceByLevel === undefined ? (
                <div className="space-y-2 rounded-xl border border-border/40 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <Tabs
                  value={perfPlatform}
                  onValueChange={(v) => setPerfPlatform(v as "all" | "meta" | "google")}
                  className="w-full"
                >
                  <TabsList className="h-10 w-full justify-start gap-1 rounded-xl bg-muted/40 p-1 sm:w-auto">
                    <TabsTrigger value="all" className="rounded-lg text-xs sm:text-sm">
                      Todos
                    </TabsTrigger>
                    <TabsTrigger value="meta" className="rounded-lg text-xs sm:text-sm">
                      Meta Ads
                    </TabsTrigger>
                    <TabsTrigger value="google" className="rounded-lg text-xs sm:text-sm" disabled={!hasGoogle}>
                      Google Ads
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="all" className="mt-4 space-y-6 outline-none">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#1877F2]" aria-hidden />
                        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[#1877F2]">
                          Meta Ads · Campanhas
                        </h3>
                      </div>
                      <DashboardPerformanceTable
                        rows={perfRows.campaign}
                        labelEmpty="Nenhuma campanha Meta no período."
                        nameHeader="Campanha"
                        businessGoalMode={goalCtx.businessGoalMode}
                        levelLabel="Campanhas Meta"
                        filterResetKey="all-meta-campaign"
                      />
                    </div>
                    {hasGoogle ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#34A853]" aria-hidden />
                          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[#34A853]">
                            Google Ads · Campanhas
                          </h3>
                        </div>
                        {googleBlockError ? (
                          <div className="rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-8 text-center text-sm text-destructive">
                            {googleBlockError}
                          </div>
                        ) : hasGoogle && metricsLoading && !googleOk ? (
                          <div className="h-48 animate-pulse rounded-xl bg-muted/30" />
                        ) : (
                          <DashboardPerformanceTable
                            rows={googlePerfCampaigns}
                            labelEmpty={
                              googleNotConnected
                                ? "Conecte o Google Ads em Integrações."
                                : googleEmptyPeriod
                                  ? "Sem campanhas Google com dados no período."
                                  : "Nenhuma campanha Google no período."
                            }
                            nameHeader="Campanha"
                            levelLabel="Campanhas Google"
                            filterResetKey="all-google-campaign"
                            businessGoalMode={goalCtx.businessGoalMode}
                          />
                        )}
                      </div>
                    ) : null}
                  </TabsContent>
                  <TabsContent value="meta" className="mt-4 outline-none">
                    <Tabs value={metaLevel} onValueChange={(v) => setMetaLevel(v as MetaLevel)} className="w-full">
                      <TabsList className="mb-4 h-10 w-full justify-start rounded-xl bg-muted/30 p-1 sm:w-auto">
                        <TabsTrigger value="campaign" className="rounded-lg text-xs sm:text-sm">
                          Campanhas
                        </TabsTrigger>
                        <TabsTrigger value="adset" className="rounded-lg text-xs sm:text-sm">
                          Conjuntos
                        </TabsTrigger>
                        <TabsTrigger value="ad" className="rounded-lg text-xs sm:text-sm">
                          Anúncios
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="campaign" className="outline-none">
                        <DashboardPerformanceTable
                          rows={perfRows.campaign}
                          labelEmpty="Nenhuma campanha no período."
                          nameHeader="Campanha"
                          businessGoalMode={goalCtx.businessGoalMode}
                          levelLabel="Campanhas"
                          filterResetKey={`meta-campaign-${perfPlatform}`}
                        />
                      </TabsContent>
                      <TabsContent value="adset" className="outline-none">
                        <DashboardPerformanceTable
                          rows={perfRows.adset}
                          labelEmpty="Nenhum conjunto no período."
                          nameHeader="Conjunto"
                          subNameKey="campaign"
                          businessGoalMode={goalCtx.businessGoalMode}
                          levelLabel="Conjuntos de anúncios"
                          filterResetKey={`meta-adset-${perfPlatform}`}
                        />
                      </TabsContent>
                      <TabsContent value="ad" className="outline-none">
                        <DashboardPerformanceTable
                          rows={perfRows.ad}
                          labelEmpty="Nenhum anúncio no período."
                          nameHeader="Anúncio"
                          subNameKey="adset"
                          businessGoalMode={goalCtx.businessGoalMode}
                          levelLabel="Anúncios"
                          filterResetKey={`meta-ad-${perfPlatform}`}
                        />
                      </TabsContent>
                    </Tabs>
                  </TabsContent>
                  <TabsContent value="google" className="mt-4 outline-none">
                    <Tabs
                      value={googleTableLevel}
                      onValueChange={(v) => setGoogleTableLevel(v as GoogleTableLevel)}
                      className="w-full"
                    >
                      <TabsList className="mb-4 h-10 w-full flex-wrap justify-start gap-1 rounded-xl bg-muted/30 p-1 sm:w-auto">
                        <TabsTrigger value="campaign" className="rounded-lg text-xs sm:text-sm">
                          Campanhas
                        </TabsTrigger>
                        <TabsTrigger value="adgroup" className="rounded-lg text-xs sm:text-sm">
                          Grupos de anúncios
                        </TabsTrigger>
                        <TabsTrigger value="ad" className="rounded-lg text-xs sm:text-sm">
                          Anúncios
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="campaign" className="outline-none">
                        {googleBlockError ? (
                          <div className="rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-8 text-center text-sm text-destructive">
                            {googleBlockError}
                          </div>
                        ) : hasGoogle && metricsLoading && !googleOk ? (
                          <div className="h-48 animate-pulse rounded-xl bg-muted/30" />
                        ) : (
                          <DashboardPerformanceTable
                            rows={googlePerfCampaigns}
                            labelEmpty={
                              !hasGoogle
                                ? "Google Ads não configurado para este workspace."
                                : googleNotConnected
                                  ? "Conecte o Google Ads em Integrações."
                                  : googleEmptyPeriod
                                    ? "Sem campanhas com dados no período."
                                    : "Nenhuma campanha no período."
                            }
                            nameHeader="Campanha"
                            levelLabel="Campanhas"
                            filterResetKey={`google-campaign-${perfPlatform}`}
                            businessGoalMode={goalCtx.businessGoalMode}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="adgroup" className="outline-none">
                        {googleBlockError ? (
                          <div className="rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-8 text-center text-sm text-destructive">
                            {googleBlockError}
                          </div>
                        ) : googleDeepLoading && googlePerfAdGroups.length === 0 ? (
                          <div className="h-48 animate-pulse rounded-xl bg-muted/30" />
                        ) : googleDeepError && googlePerfAdGroups.length === 0 ? (
                          <div className="rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-8 text-center text-sm text-destructive">
                            {googleDeepError}
                          </div>
                        ) : (
                          <DashboardPerformanceTable
                            rows={googlePerfAdGroups}
                            labelEmpty="Nenhum grupo de anúncios no período."
                            nameHeader="Grupo de anúncios"
                            subNameKey="campaign"
                            businessGoalMode={goalCtx.businessGoalMode}
                            levelLabel="Grupos de anúncios"
                            filterResetKey={`google-adgroup-${perfPlatform}`}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="ad" className="outline-none">
                        {googleBlockError ? (
                          <div className="rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-8 text-center text-sm text-destructive">
                            {googleBlockError}
                          </div>
                        ) : googleDeepLoading && googlePerfAds.length === 0 ? (
                          <div className="h-48 animate-pulse rounded-xl bg-muted/30" />
                        ) : googleDeepError && googlePerfAds.length === 0 ? (
                          <div className="rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-8 text-center text-sm text-destructive">
                            {googleDeepError}
                          </div>
                        ) : (
                          <DashboardPerformanceTable
                            rows={googlePerfAds}
                            labelEmpty="Nenhum anúncio no período."
                            nameHeader="Anúncio"
                            subNameKey="campaign"
                            subNameHeader="Campanha · grupo"
                            businessGoalMode={goalCtx.businessGoalMode}
                            levelLabel="Anúncios"
                            filterResetKey={`google-ad-${perfPlatform}`}
                          />
                        )}
                      </TabsContent>
                    </Tabs>
                  </TabsContent>
                </Tabs>
              )}
            </section>

          </div>
        ) : (
          <div className="rounded-2xl border border-border/55 bg-card p-6 text-sm text-muted-foreground" role="status">
            Conecte a Meta Ads para ver o painel.
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
