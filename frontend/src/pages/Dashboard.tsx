import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, BarChart3, CalendarRange, Megaphone, RefreshCw } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import { PerformanceAlerts } from "@/components/marketing/PerformanceAlerts";
import { MarketingDateRangeDialog } from "@/components/marketing/MarketingDateRangeDialog";
import { ChartPanelPremium, DataTablePremium } from "@/components/premium";
import type { MarketingDashboardPerfRow, MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import type { MetaAdsMetricsSummary } from "@/lib/integrations-api";
import { defaultMarketingGoalContext } from "@/lib/business-goal-mode";
import {
  deriveChannelPerformanceSignals,
  type ChannelPerformanceSignal,
} from "@/lib/channel-performance-compare";
import { ExecutiveFunnel, type FunnelSegmentBreak } from "@/components/dashboard/ExecutiveFunnel";
import {
  buildAdaptiveFunnelModelFromSteps,
  buildGoogleAdsFunnelModel,
  buildStepsFromSummaryForBusinessGoal,
} from "@/components/dashboard/funnel-flow.logic";
import {
  buildGoogleChannelPerformanceLayout,
  buildMetaChannelPerformanceLayout,
} from "@/components/dashboard/build-channel-performance-layout";
import { ChannelSummaryWidget } from "@/components/dashboard/ChannelSummaryWidget";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { useMarketingDashboardBlocks } from "@/hooks/useMarketingDashboardBlocks";
import { DashboardAlertOccurrences } from "@/components/dashboard/dashboard-alert-occurrences";
import { DashboardFunnelRatesWidget } from "@/components/dashboard/dashboard-funnel-rates-widget";
import {
  buildDashboardQuickInsightsByGoal,
  DashboardQuickInsightsStrip,
  type QuickInsight,
} from "@/components/dashboard/dashboard-quick-insights";

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

type MetaLevel = "campaign" | "adset" | "ad";

export function Dashboard() {
  const navigate = useNavigate();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

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
    cmpLoading,
    metricsLoading,
    metaMetricsLoading,
    metricsError,
    refreshAll,
    insightData,
    insightLoading,
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

  const metaFunnelSegmentBreaks = useMemo((): FunnelSegmentBreak[] | undefined => {
    if (goalCtx.dashboardModeConfig.funnelVariant !== "hybrid") return undefined;
    return [
      { afterStepId: "link", label: "LPV e resultado" },
      { afterStepId: "lead", label: "Monetização" },
    ];
  }, [goalCtx.dashboardModeConfig.funnelVariant]);

  const metaSpend = summary?.spend ?? 0;
  const googleSpendBrl = googleOk ? metrics.summary.costMicros / 1_000_000 : 0;
  const cmpMetaSpend = cmpMetaMetrics?.ok ? cmpMetaMetrics.summary.spend : 0;
  const cmpGoogleSpendBrl = cmpMetrics?.ok ? cmpMetrics.summary.costMicros / 1_000_000 : 0;

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

  const metaFunnelModel = useMemo(() => {
    if (!metaOk || !summary) return null;
    const fv = goalCtx.dashboardModeConfig.funnelVariant;
    const steps = buildStepsFromSummaryForBusinessGoal(summary, fv, goalCtx.primaryConversionLabel);
    return buildAdaptiveFunnelModelFromSteps(steps, "meta");
  }, [metaOk, summary, goalCtx.dashboardModeConfig.funnelVariant, goalCtx.primaryConversionLabel]);

  const googleFunnelModel = useMemo(() => {
    if (!googleOk || !metrics?.ok) return null;
    return buildGoogleAdsFunnelModel(metrics.summary);
  }, [googleOk, metrics]);

  const hasAnyChannel = hasGoogle || hasMeta;

  const [metaLevel, setMetaLevel] = useState<MetaLevel>("campaign");
  const [chartExtra, setChartExtra] = useState<"none" | "ctr">("none");
  const [alertHistoryTick, setAlertHistoryTick] = useState(0);

  const chartData = useMemo(() => {
    if (!metaOk || !dash.timeseries.length) return [];
    const map = new Map(dash.timeseries.map((t) => [t.date, t]));
    const from = parseISO(dateRange.startDate);
    const to = parseISO(dateRange.endDate);
    const days = eachDayOfInterval({ start: from, end: to });
    return days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const row = map.get(key);
      const imp = row?.impressions ?? 0;
      const clk = row?.clicks ?? 0;
      return {
        label: format(day, "d/MMM", { locale: ptBR }),
        spend: row?.spend ?? 0,
        leads: row?.leads ?? 0,
        ctr: row?.ctrPct ?? (imp > 0 ? (clk / imp) * 100 : null) as number | null,
      };
    });
  }, [metaOk, dash, dateRange.startDate, dateRange.endDate]);

  const perfRows = useMemo(() => {
    if (!metaOk) return { campaign: [] as MarketingDashboardPerfRow[], adset: [], ad: [] };
    return {
      campaign: dash.performanceByLevel.campaigns,
      adset: dash.performanceByLevel.adsets,
      ad: dash.performanceByLevel.ads,
    };
  }, [metaOk, dash]);

  const derived = summary?.derived;

  const refresh = useCallback(async () => {
    await refreshAll();
    await loadDashboard(true);
    setAlertHistoryTick((t) => t + 1);
  }, [refreshAll, loadDashboard]);

  const displayUpdatedAt = dashUpdatedAt ?? null;

  const googlePending =
    metaOk &&
    (dash.integrationStatus.googleAds.status === "api_not_ready" ||
      dash.integrationStatus.googleAds.status === "pending_configuration");

  const quickInsightPack = useMemo((): {
    primary: QuickInsight[];
    secondary?: QuickInsight[];
  } => {
    if (!metaOk || !dash || dash.ok !== true) {
      return { primary: [] };
    }
    return buildDashboardQuickInsightsByGoal({
      dash,
      campaigns: dash.performanceByLevel.campaigns,
      googleOk,
      googlePending,
      businessGoalMode: goalCtx.businessGoalMode,
      primaryConversionLabel: goalCtx.primaryConversionLabel,
      showRevenueInLeadMode: goalCtx.showRevenueBlocksInLeadMode,
    });
  }, [metaOk, dash, googleOk, googlePending, goalCtx]);

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
    });
  }, [
    summary,
    goalCtx.businessGoalMode,
    metaSpend,
    cmpMetaSpend,
    compareEnabled,
    goalCtx.primaryConversionLabel,
    cmpMetaSummary,
  ]);

  const googleChannelLayout = useMemo(() => {
    if (!googleOk || !metrics?.ok || !googleDerived) return undefined;
    return buildGoogleChannelPerformanceLayout(goalCtx.businessGoalMode, {
      googleDerived,
      metrics: metrics.summary,
      cmpGoogleSummary,
      compareEnabled,
      relDelta,
    });
  }, [googleOk, metrics, googleDerived, goalCtx.businessGoalMode, cmpGoogleSummary, compareEnabled]);

  const metaWidgetLoading = blocks.summary.refreshing || metaMetricsLoading;
  const metaEmptyPeriod =
    metaSpend <= 0 && summary !== null && summary.impressions <= 0 && summary.clicks <= 0;

  const googleWidgetLoading = hasGoogle && metricsLoading && !googleOk;
  const googleStatus = metaOk && dash.ok ? dash.integrationStatus.googleAds.status : "not_connected";
  const googleNotConnected = hasGoogle && googleStatus === "not_connected";
  const googleEmptyPeriod =
    googleOk &&
    googleDerived &&
    googleDerived.spend <= 0 &&
    metrics!.summary.impressions <= 0 &&
    metrics!.summary.clicks <= 0;

  const channelPerformanceSignals = useMemo((): {
    meta: ChannelPerformanceSignal;
    google: ChannelPerformanceSignal;
  } => {
    const empty = { meta: null, google: null } satisfies {
      meta: ChannelPerformanceSignal;
      google: ChannelPerformanceSignal;
    };
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

  return (
    <TooltipProvider delayDuration={180}>
      <div
        className={cn(
          "w-full space-y-6 pb-24 lg:pb-6",
          sidebarCollapsed ? "max-w-none" : "mx-auto max-w-[1680px]"
        )}
      >
        {/* Cabeçalho: saudação, período, ações */}
        <section className="rounded-2xl border border-border/55 bg-gradient-to-br from-card via-card to-muted/[0.25] p-5 shadow-[var(--shadow-surface)] sm:p-6">
          <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary/75">Visão geral</p>
              <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
                Painel executivo
              </h1>
              <p className="text-sm text-muted-foreground">
                Período: <span className="font-medium text-foreground/90">{dateRangeLabel}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-2 rounded-lg"
                onClick={() => setPickerOpen(true)}
              >
                <CalendarRange className="h-3.5 w-3.5 opacity-70" />
                <span className="max-w-[200px] truncate font-medium">{dateRangeLabel}</span>
              </Button>
              <MarketingDateRangeDialog
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                initial={dateRange}
                initialLabel={dateRangeLabel}
                initialPresetId={presetId}
                initialCompare={compareEnabled}
                onApply={applyDateFilter}
              />
              {hasMeta ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg"
                  disabled={anyRefreshing || metaMetricsLoading}
                  onClick={() => void refresh()}
                >
                  <RefreshCw
                    className={cn(
                      "mr-1.5 h-3.5 w-3.5",
                      anyRefreshing || metaMetricsLoading ? "animate-spin" : ""
                    )}
                  />
                  Atualizar
                </Button>
              ) : null}
              <Button size="sm" className="h-9 rounded-lg" asChild>
                <Link to="/marketing" className="gap-1.5">
                  <Megaphone className="h-3.5 w-3.5" />
                  Marketing
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="h-9 rounded-lg text-muted-foreground" asChild>
                <Link to="/marketing/configuracoes">Metas</Link>
              </Button>
            </div>
          </div>
        </section>

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
            <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => void loadDashboard(true)}>
              Tentar novamente
            </Button>
          </div>
        ) : metaOk && summary && dash ? (
          <div className="space-y-8">
            {anyRefreshing ? (
              <div
                className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 text-xs font-medium text-primary"
                role="status"
              >
                <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
                Atualizando dados do painel…
              </div>
            ) : null}
            {summary.reconciliation && !summary.reconciliation.spendMatchesSummary ? (
              <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                Aviso: divergência de gasto resumo vs. série — verifique logs do servidor se persistir.
              </p>
            ) : null}

            {/* Visão por canal — performance por plataforma */}
            <section className="relative space-y-2.5">
              {blocks.summary.refreshing ? (
                <span className="absolute right-0 top-0 z-10 flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Atualizando
                </span>
              ) : null}
              <div className="space-y-0.5 px-0.5">
                <h2 className="text-lg font-bold tracking-tight text-foreground">Visão por canal</h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Investimento e resultado em destaque; eficiência em linhas compactas. Indicadores «Melhor desempenho» e
                  «Atenção» comparam Meta e Google no período (CPL/CPA ou ROAS conforme o modo da conta).
                </p>
              </div>

              <div
                className={cn(
                  "grid items-stretch gap-3",
                  hasGoogle ? "lg:grid-cols-2" : "grid-cols-1"
                )}
              >
                <ChannelSummaryWidget
                  channel="meta"
                  accent="purple"
                  businessGoalMode={goalCtx.businessGoalMode}
                  title="Meta Ads"
                  syncAt={displayUpdatedAt}
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
                  performanceSignal={
                    !metaWidgetLoading &&
                    !metaEmptyPeriod &&
                    metaChannelLayout &&
                    dash.integrationStatus.metaAds.connected
                      ? channelPerformanceSignals.meta
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
                  <ChannelSummaryWidget
                    channel="google"
                    accent="green"
                    businessGoalMode={goalCtx.businessGoalMode}
                    title="Google Ads"
                    syncAt={displayUpdatedAt}
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
                    performanceSignal={
                      !googleWidgetLoading &&
                      !googleEmptyPeriod &&
                      googleChannelLayout &&
                      !googleNotConnected
                        ? channelPerformanceSignals.google
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

            <div
              className={cn(
                "grid gap-4",
                quickInsightPack.secondary?.length ? "lg:grid-cols-2" : ""
              )}
            >
              <DashboardQuickInsightsStrip
                title={
                  goalCtx.dashboardModeConfig.hybridInsightSplit
                    ? "Insights rápidos · topo do funil"
                    : "Insights rápidos"
                }
                items={quickInsightPack.primary}
              />
              {quickInsightPack.secondary?.length ? (
                <DashboardQuickInsightsStrip
                  title="Insights rápidos · fundo do funil"
                  items={quickInsightPack.secondary}
                />
              ) : null}
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/80 p-4 shadow-sm">
              <p className="text-xs font-semibold text-foreground">Metas e alertas</p>
              <div className="mt-2">
                <PerformanceAlerts alerts={insightData?.alerts} loading={insightLoading} />
              </div>
              <DashboardAlertOccurrences refreshKey={alertHistoryTick} />
              {compareEnabled ? (
                <div className="mt-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  {cmpLoading ? (
                    "Carregando período anterior…"
                  ) : googleOk ? (
                    <div className="space-y-2">
                      <p>
                        <span className="font-medium text-foreground">Meta Ads — gasto período anterior:</span>{" "}
                        {cmpMetaSpend <= 0 && metaSpend <= 0 ? (
                          <span>sem gasto nos dois períodos.</span>
                        ) : (
                          <>
                            <span className="tabular-nums text-foreground">{formatSpend(cmpMetaSpend)}</span>
                            {metaSpend > 0 && cmpMetaSpend > 0 ? (
                              <>
                                {" "}
                                ({metaSpend >= cmpMetaSpend ? "+" : ""}
                                {(((metaSpend - cmpMetaSpend) / cmpMetaSpend) * 100).toFixed(1)}%)
                              </>
                            ) : null}
                          </>
                        )}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Google Ads — gasto período anterior:</span>{" "}
                        {cmpGoogleSpendBrl <= 0 && googleSpendBrl <= 0 ? (
                          <span>sem gasto nos dois períodos.</span>
                        ) : (
                          <>
                            <span className="tabular-nums text-foreground">{formatSpend(cmpGoogleSpendBrl)}</span>
                            {googleSpendBrl > 0 && cmpGoogleSpendBrl > 0 ? (
                              <>
                                {" "}
                                ({googleSpendBrl >= cmpGoogleSpendBrl ? "+" : ""}
                                {(((googleSpendBrl - cmpGoogleSpendBrl) / cmpGoogleSpendBrl) * 100).toFixed(1)}%)
                              </>
                            ) : null}
                          </>
                        )}
                      </p>
                    </div>
                  ) : cmpMetaSpend <= 0 && metaSpend <= 0 ? (
                    "Comparação ativa — sem gasto Meta nos dois períodos."
                  ) : (
                    <>
                      <span className="font-medium text-foreground">Gasto período anterior (Meta):</span>{" "}
                      <span className="tabular-nums text-foreground">{formatSpend(cmpMetaSpend)}</span>
                      {metaSpend > 0 && cmpMetaSpend > 0 ? (
                        <>
                          {" "}
                          ({metaSpend >= cmpMetaSpend ? "+" : ""}
                          {(((metaSpend - cmpMetaSpend) / cmpMetaSpend) * 100).toFixed(1)}%)
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>

            {/* Funis Meta + Google (50%) e taxas Meta */}
            <div className="relative space-y-5">
              {blocks.summary.refreshing ? (
                <span className="absolute right-2 top-0 z-10 flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Atualizando
                </span>
              ) : null}
              <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
                {metaFunnelModel ? (
                  <ExecutiveFunnel
                    model={metaFunnelModel}
                    summary={summary}
                    spend={metaSpend}
                    platform="meta"
                    companionRatesPanel
                    segmentBreaks={metaFunnelSegmentBreaks}
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
              <div className={cn("grid gap-5", hasGoogle ? "lg:grid-cols-2 lg:items-stretch" : "")}>
                {metaFunnelModel ? (
                  <DashboardFunnelRatesWidget
                    model={metaFunnelModel}
                    platform="meta"
                    className="min-h-0"
                  />
                ) : (
                  <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-border/50 bg-card/80 p-5 text-sm text-muted-foreground shadow-[var(--shadow-surface)]">
                    Gargalos Meta indisponíveis no momento.
                  </div>
                )}
                {hasGoogle ? (
                  googleFunnelModel ? (
                    <DashboardFunnelRatesWidget
                      model={googleFunnelModel}
                      platform="google"
                      className="min-h-0"
                    />
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
            </div>

            {/* Receita / atribuição — bloco único */}
            <section
              className={cn(
                "rounded-2xl border bg-muted/[0.2] p-5",
                revenueMuted
                  ? "border-dashed border-muted-foreground/25 opacity-[0.92]"
                  : "border-border/50"
              )}
            >
              <h2 className="text-sm font-bold text-foreground">Receita e atribuição</h2>
              {revenueMuted ? (
                <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                  Conta configurada para priorizar captação. Este bloco fica em segundo plano até você ativar
                  &quot;Mostrar monetização mesmo em contas focadas em lead&quot; em{" "}
                  <Link to="/marketing/configuracoes" className="font-medium text-primary underline-offset-4 hover:underline">
                    Metas e alertas
                  </Link>
                  .
                </p>
              ) : null}
              {summary.purchases === 0 && summary.purchaseValue <= 0 ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  ROAS, valor de compra e custo por compra aparecem quando a Meta retornar eventos de compra no período.
                  Conversas e views de LP seguem no funil Meta acima.
                </p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-border/40 bg-card/90 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Compras</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">{formatNumber(summary.purchases)}</p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-card/90 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Valor atribuído
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums">
                      {summary.purchaseValue > 0 ? formatSpend(summary.purchaseValue) : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-card/90 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">ROAS</p>
                    <p className="mt-1 text-xl font-bold tabular-nums">
                      {derived?.roas != null && Number.isFinite(derived.roas)
                        ? `${derived.roas.toFixed(2).replace(".", ",")}×`
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-card/90 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Custo / compra
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums">
                      {derived?.costPerPurchase != null ? formatSpend(derived.costPerPurchase) : "—"}
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">Conversas:</span>{" "}
                  {formatNumber(summary.messagingConversations)}
                </span>
                <span>
                  <span className="font-medium text-foreground">Views LP:</span>{" "}
                  {formatNumber(summary.landingPageViews)}
                </span>
              </div>
            </section>

            {/* FAIXA 4 — Gráfico */}
            <ChartPanelPremium
              title="Gráfico diário · investimento e leads"
              actions={
                <div className="flex items-center gap-2">
                  {blocks.timeseries.refreshing ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Atualizando
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant={chartExtra === "ctr" ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={() => setChartExtra((v) => (v === "ctr" ? "none" : "ctr"))}
                  >
                    CTR
                  </Button>
                </div>
              }
              contentClassName="pt-2"
            >
              {blocks.timeseries.error ? (
                <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">{blocks.timeseries.error}</p>
              ) : null}
              {blocks.timeseries.loading && slice.timeseries === undefined ? (
                <Skeleton className="h-[300px] w-full rounded-lg" />
              ) : (
              <div className="h-[300px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => `R$${v}`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: 12,
                        fontSize: 12,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                      }}
                      formatter={(val: number, name: string) => {
                        if (name === "spend") return [formatSpend(val), "Investimento"];
                        if (name === "leads") return [formatNumber(val), "Leads"];
                        if (name === "ctr" && val != null) return [formatPercent(val), "CTR"];
                        return [val, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      yAxisId="left"
                      dataKey="spend"
                      name="Investimento"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      opacity={0.88}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="leads"
                      name="Leads"
                      stroke="hsl(199 89% 48%)"
                      strokeWidth={2}
                      dot={false}
                    />
                    {chartExtra === "ctr" ? (
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="ctr"
                        name="CTR %"
                        stroke="hsl(280 65% 52%)"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ) : null}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              )}
            </ChartPanelPremium>

            {/* FAIXA 5 */}
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartPanelPremium title="Plataforma · investimento" contentClassName="pt-2">
                <div className="flex flex-col gap-3">
                  {dash.distribution.byPlatform.map((p) => (
                    <div key={p.platform} className="rounded-xl border border-primary/15 bg-primary/[0.06] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">{p.platform}</span>
                        <span className="text-lg font-bold tabular-nums text-primary">
                          {p.spendSharePct.toFixed(1).replace(".", ",")}%
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">R$ {p.spend}</span>
                      </p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
                          style={{ width: `${Math.min(100, p.spendSharePct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ChartPanelPremium>

              <ChartPanelPremium title="Temperatura e score (heurística)" contentClassName="pt-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/50 bg-card/80 p-4">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Gasto por temperatura</p>
                    {!dash.distribution.byTemperature.length ? (
                      <p className="mt-2 text-sm text-muted-foreground">Sem dados.</p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm">
                        {dash.distribution.byTemperature.map((t) => (
                          <li key={t.segment} className="flex justify-between gap-2">
                            <span className="text-muted-foreground">
                              {t.segment === "hot" ? "Quente" : "Frio"}
                            </span>
                            <span className="font-semibold tabular-nums">{formatPercent(t.spendSharePct)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-xl border border-border/50 bg-card/80 p-4">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Score CTR</p>
                    <ul className="mt-2 space-y-2 text-sm">
                      {(["A", "B", "C", "D"] as const).map((g) => (
                        <li key={g} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{g}</span>
                          <span className="font-semibold tabular-nums">
                            {formatPercent(dash.distribution.byScore[g])}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </ChartPanelPremium>
            </div>

            {/* FAIXA 6 */}
            <section className="relative space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                <h2 className="text-lg font-bold tracking-tight text-foreground">Performance por nível</h2>
                {blocks.performance.refreshing ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-primary">
                    <RefreshCw className="h-3 w-3 animate-spin" />
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
              <Tabs value={metaLevel} onValueChange={(v) => setMetaLevel(v as MetaLevel)} className="w-full">
                <TabsList className="h-10 w-full justify-start rounded-xl bg-muted/50 p-1 sm:w-auto">
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
                <TabsContent value="campaign" className="mt-4 outline-none">
                  <PerfTable rows={perfRows.campaign} labelEmpty="Nenhuma campanha no período." nameHeader="Campanha" />
                </TabsContent>
                <TabsContent value="adset" className="mt-4 outline-none">
                  <PerfTable
                    rows={perfRows.adset}
                    labelEmpty="Nenhum conjunto no período."
                    nameHeader="Conjunto"
                    subNameKey="campaign"
                  />
                </TabsContent>
                <TabsContent value="ad" className="mt-4 outline-none">
                  <PerfTable
                    rows={perfRows.ad}
                    labelEmpty="Nenhum anúncio no período."
                    nameHeader="Anúncio"
                    subNameKey="adset"
                  />
                </TabsContent>
              </Tabs>
              )}
            </section>

            <div className="flex flex-col gap-3 rounded-2xl border border-primary/15 bg-primary/[0.04] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-foreground">Análise detalhada com filtros e Google</p>
              <Button className="shrink-0 rounded-xl" asChild>
                <Link to="/marketing" className="gap-2">
                  Marketing
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <section className="relative rounded-2xl border border-border/50 bg-muted/[0.15] p-4 sm:p-5">
              {blocks.integration.refreshing ? (
                <span className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Atualizando
                </span>
              ) : null}
              <h2 className="text-sm font-bold tracking-tight text-foreground sm:text-base">Status das integrações</h2>
              {blocks.integration.error ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{blocks.integration.error}</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                Conexões usadas neste painel. Ajustes em{" "}
                <Link to="/marketing/integracoes" className="font-medium text-primary underline-offset-4 hover:underline">
                  Integrações
                </Link>
                .
              </p>
              <ul className="mt-4 space-y-3">
                <li className="flex flex-col gap-0.5 rounded-lg border border-border/45 bg-card/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-medium text-foreground">Meta Ads</span>
                  <span className="text-xs font-semibold text-muted-foreground sm:text-sm">
                    {metaOk ? "Ativo" : hasMeta ? "Carregando…" : "Não conectado"}
                  </span>
                </li>
                <li className="flex flex-col gap-1 rounded-lg border border-border/45 bg-card/80 px-3 py-2.5">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-medium text-foreground">Google Ads</span>
                    <span className="text-xs font-semibold text-muted-foreground sm:text-sm">
                      {googlePending
                        ? "Em ativação"
                        : googleOk
                          ? "Ativo"
                          : hasGoogle
                            ? "Sincronização pendente"
                            : "Não conectado"}
                    </span>
                  </div>
                  {googlePending ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {googleAdsPendingHint(dash.integrationStatus.googleAds.status)}
                    </p>
                  ) : hasGoogle && !googleOk && !metricsLoading ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {metricsError ?? "Métricas de busca indisponíveis no momento."}
                    </p>
                  ) : null}
                </li>
              </ul>
              {displayUpdatedAt ? (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Painel Meta atualizado em{" "}
                  <span className="tabular-nums font-medium text-foreground">
                    {displayUpdatedAt.toLocaleDateString("pt-BR")}{" "}
                    {displayUpdatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  .
                </p>
              ) : null}
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

function PerfTable({
  rows,
  labelEmpty,
  nameHeader,
  subNameKey,
}: {
  rows: MarketingDashboardPerfRow[];
  labelEmpty: string;
  nameHeader: string;
  subNameKey?: "campaign" | "adset";
}) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-8 text-center text-sm text-muted-foreground">
        {labelEmpty}
      </div>
    );
  }
  return (
    <DataTablePremium zebra minHeight="min-h-[200px]">
      <thead>
        <tr>
          <th className="text-left">{nameHeader}</th>
          {subNameKey ? (
            <th className="text-left">{subNameKey === "campaign" ? "Campanha" : "Conjunto"}</th>
          ) : null}
          <th className="text-right">Invest.</th>
          <th className="text-right">Impr.</th>
          <th className="text-right">Alcance</th>
          <th className="text-right">Cliques</th>
          <th className="text-right">CTR</th>
          <th className="text-right">CPC</th>
          <th className="text-right">Leads</th>
          <th className="text-right">CPL</th>
          <th className="text-right">Compras</th>
          <th className="text-right">Valor</th>
          <th className="text-right">ROAS</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 80).map((row) => (
          <tr key={row.id}>
            <td className="max-w-[200px] truncate font-medium text-foreground">{row.name}</td>
            {subNameKey ? (
              <td className="max-w-[160px] truncate text-muted-foreground">{row.parentName ?? "—"}</td>
            ) : null}
            <td className="text-right tabular-nums font-medium">{formatSpend(row.spend)}</td>
            <td className="text-right tabular-nums text-muted-foreground">{formatNumber(row.impressions)}</td>
            <td className="text-right tabular-nums text-muted-foreground">
              {!row.reachReturned ? "—" : formatNumber(row.reach ?? 0)}
            </td>
            <td className="text-right tabular-nums text-muted-foreground">{formatNumber(row.clicks)}</td>
            <td className="text-right tabular-nums">
              {row.ctrPct != null ? formatPercent(row.ctrPct) : "—"}
            </td>
            <td className="text-right tabular-nums">{row.cpc != null ? formatSpend(row.cpc) : "—"}</td>
            <td className="text-right tabular-nums">{formatNumber(row.leads)}</td>
            <td className="text-right tabular-nums">{row.cpl != null ? formatSpend(row.cpl) : "—"}</td>
            <td className="text-right tabular-nums">{formatNumber(row.purchases)}</td>
            <td className="text-right tabular-nums">
              {row.purchaseValue > 0 ? formatSpend(row.purchaseValue) : "—"}
            </td>
            <td className="text-right tabular-nums">
              {row.roas != null ? `${row.roas.toFixed(2).replace(".", ",")}×` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </DataTablePremium>
  );
}
