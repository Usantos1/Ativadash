import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  RefreshCw,
  Share2,
  Clock,
  Eye,
  MousePointer,
  DollarSign,
  Target,
  Filter,
  CalendarRange,
  UserPlus,
  TrendingUp,
  Pencil,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createColumnHelper } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarketingDateRangeDialog } from "@/components/marketing/MarketingDateRangeDialog";
import { IndeterminateLoadingBar } from "@/components/ui/indeterminate-loading-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticTable } from "@/components/marketing/AnalyticTable";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { DashboardPanel, KpiStat, SectionLabel } from "@/components/dashboard/DashboardPrimitives";
import { CaptureTrendComposedChart } from "@/components/marketing/CaptureTrendComposedChart";
import { CaptureDualDonuts } from "@/components/marketing/CaptureDualDonuts";
import { formatCost, formatNumber, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import type { MetaAdsCampaignRow } from "@/lib/integrations-api";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import { PerformanceAlerts } from "@/components/marketing/PerformanceAlerts";
import { fetchLaunches, fetchGoals, type LaunchRow } from "@/lib/workspace-api";
import { fetchMarketingSettings, type MarketingSettingsDto } from "@/lib/marketing-settings-api";
import {
  type TempFilter,
  aggregateGoogle,
  aggregateMeta,
  buildGoogleOnlyDailyChart,
  buildMergedDailyChart,
  buildMetaOnlyDailyChart,
  campaignMatchesLaunch,
  computeScaleFactor,
  filterGoogleCampaigns,
  filterMetaCampaigns,
  gradeDistributionFromCampaigns,
  isHotCampaignName,
  matchesTempFilter,
  pickLeadGoalTarget,
  splitHotColdLeadsSpend,
} from "@/lib/marketing-capture-aggregate";

const columnHelper = createColumnHelper<MetaAdsCampaignRow>();
const metaAdsCampaignColumns = [
  columnHelper.accessor("campaignName", {
    header: "Campanha",
    cell: (ctx) => <span className="font-medium">{ctx.getValue() || "—"}</span>,
  }),
  columnHelper.accessor("impressions", {
    header: "Impressões",
    cell: (ctx) => formatNumber(ctx.getValue()),
  }),
  columnHelper.accessor("clicks", {
    header: "Cliques",
    cell: (ctx) => formatNumber(ctx.getValue()),
  }),
  columnHelper.accessor("spend", {
    header: "Gasto",
    cell: (ctx) => formatSpend(ctx.getValue()),
  }),
  columnHelper.accessor("leads", {
    header: "Leads",
    cell: (ctx) => formatNumber(ctx.getValue() ?? 0),
  }),
  columnHelper.accessor("purchases", {
    header: "Vendas",
    cell: (ctx) => formatNumber(ctx.getValue() ?? 0),
  }),
  columnHelper.display({
    id: "valorVendas",
    header: "Valor vendas",
    cell: (ctx) => {
      const v = ctx.row.original.purchaseValue;
      return v != null && v > 0 ? formatSpend(v) : "—";
    },
  }),
  columnHelper.display({
    id: "ctr",
    header: "CTR",
    cell: (ctx) => {
      const imp = ctx.row.original.impressions;
      const clk = ctx.row.original.clicks;
      return imp > 0 ? `${((clk / imp) * 100).toFixed(2)}%` : "—";
    },
  }),
  columnHelper.display({
    id: "cpc",
    header: "CPC",
    cell: (ctx) => {
      const clk = ctx.row.original.clicks;
      const sp = ctx.row.original.spend;
      return clk > 0 ? formatSpend(sp / clk) : "—";
    },
  }),
];

export function Marketing() {
  const navigate = useNavigate();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
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
    insightData,
    insightLoading,
  } = useMarketingMetrics();

  const [launches, setLaunches] = useState<LaunchRow[]>([]);
  const [launchId, setLaunchId] = useState<string>("all");
  const [tempFilter, setTempFilter] = useState<TempFilter>("geral");
  const [settings, setSettings] = useState<MarketingSettingsDto | null>(null);
  const [leadGoalTarget, setLeadGoalTarget] = useState<number | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    fetchLaunches()
      .then((list) => {
        if (!c) setLaunches(list);
      })
      .catch(() => {
        if (!c) setLaunches([]);
      });
    fetchGoals()
      .then((g) => {
        if (!c) setLeadGoalTarget(pickLeadGoalTarget(g));
      })
      .catch(() => {
        if (!c) setLeadGoalTarget(null);
      });
    fetchMarketingSettings()
      .then((s) => {
        if (!c) setSettings(s);
      })
      .catch(() => {
        if (!c) setSettings(null);
      });
    return () => {
      c = true;
    };
  }, []);

  const selectedLaunch = useMemo(
    () => (launchId === "all" ? null : launches.find((l) => l.id === launchId) ?? null),
    [launches, launchId]
  );
  const launchNameForFilter = selectedLaunch?.name ?? null;

  const googleDaily = metrics?.ok ? metrics.daily ?? [] : [];
  const metaDaily = metaMetrics?.ok ? metaMetrics.daily ?? [] : [];

  const googleCampaignsFiltered = useMemo(() => {
    if (!metrics?.ok) return [];
    return filterGoogleCampaigns(metrics.campaigns, launchNameForFilter, tempFilter);
  }, [metrics, launchNameForFilter, tempFilter]);

  const metaCampaignsFiltered = useMemo(() => {
    if (!metaMetrics?.ok) return [];
    return filterMetaCampaigns(metaMetrics.campaigns, launchNameForFilter, tempFilter);
  }, [metaMetrics, launchNameForFilter, tempFilter]);

  const aggG = useMemo(() => aggregateGoogle(googleCampaignsFiltered), [googleCampaignsFiltered]);
  const aggM = useMemo(() => aggregateMeta(metaCampaignsFiltered), [metaCampaignsFiltered]);

  const totalSpendSummary =
    (metrics?.ok ? metrics.summary.costMicros / 1_000_000 : 0) +
    (metaMetrics?.ok ? metaMetrics.summary.spend : 0);
  const filteredSpend = aggG.costMicros / 1_000_000 + aggM.spend;
  const chartScale = computeScaleFactor(filteredSpend, totalSpendSummary);

  const mergedChartData = useMemo(
    () =>
      buildMergedDailyChart(dateRange.startDate, dateRange.endDate, googleDaily, metaDaily, chartScale),
    [dateRange.startDate, dateRange.endDate, googleDaily, metaDaily, chartScale]
  );

  const googleSpendTotal = metrics?.ok ? metrics.summary.costMicros / 1_000_000 : 0;
  const metaSpendTotal = metaMetrics?.ok ? metaMetrics.summary.spend : 0;
  const googleScale = computeScaleFactor(aggG.costMicros / 1_000_000, googleSpendTotal || 0);
  const metaScale = computeScaleFactor(aggM.spend, metaSpendTotal || 0);

  const googleOnlyChart = useMemo(
    () => buildGoogleOnlyDailyChart(dateRange.startDate, dateRange.endDate, googleDaily, googleScale || chartScale),
    [dateRange.startDate, dateRange.endDate, googleDaily, googleScale, chartScale]
  );
  const metaOnlyChart = useMemo(
    () => buildMetaOnlyDailyChart(dateRange.startDate, dateRange.endDate, metaDaily, metaScale || chartScale),
    [dateRange.startDate, dateRange.endDate, metaDaily, metaScale, chartScale]
  );

  const leadsReais = aggG.conversions + aggM.leads;
  const totalClicksF = aggG.clicks + aggM.clicks;
  const mqlNumerator = aggG.conversions + aggM.purchases;
  const mqlDen = Math.max(1, aggG.conversions + aggM.leads + aggM.purchases);
  const mqlPct = (mqlNumerator / mqlDen) * 100;
  const cpaTrafego = leadsReais > 0 ? filteredSpend / leadsReais : 0;
  const surveyRatePct = totalClicksF > 0 ? (leadsReais / totalClicksF) * 100 : null;

  const faltaMetaLeads =
    leadGoalTarget != null && leadGoalTarget > 0 ? Math.max(0, Math.round(leadGoalTarget - leadsReais)) : null;

  const targetCpa = settings?.targetCpaBrl ?? null;
  const faltaInvestir =
    leadGoalTarget != null && targetCpa != null && leadGoalTarget > 0
      ? leadGoalTarget * targetCpa - filteredSpend
      : null;

  const grades = useMemo(
    () => gradeDistributionFromCampaigns(googleCampaignsFiltered, metaCampaignsFiltered),
    [googleCampaignsFiltered, metaCampaignsFiltered]
  );

  const hotCold = useMemo(
    () => splitHotColdLeadsSpend(googleCampaignsFiltered, metaCampaignsFiltered),
    [googleCampaignsFiltered, metaCampaignsFiltered]
  );

  const googleOnlyHotCold = useMemo(() => {
    const hot = googleCampaignsFiltered.filter((r) => isHotCampaignName(r.campaignName));
    const cold = googleCampaignsFiltered.filter((r) => !isHotCampaignName(r.campaignName));
    const h = aggregateGoogle(hot);
    const c = aggregateGoogle(cold);
    return {
      hotLeads: h.conversions,
      coldLeads: c.conversions,
      hotSpend: h.costMicros / 1_000_000,
      coldSpend: c.costMicros / 1_000_000,
    };
  }, [googleCampaignsFiltered]);

  const metaOnlyHotCold = useMemo(() => {
    const hot = metaCampaignsFiltered.filter((r) => isHotCampaignName(r.campaignName));
    const cold = metaCampaignsFiltered.filter((r) => !isHotCampaignName(r.campaignName));
    const h = aggregateMeta(hot);
    const c = aggregateMeta(cold);
    return {
      hotLeads: h.leads + h.purchases,
      coldLeads: c.leads + c.purchases,
      hotSpend: h.spend,
      coldSpend: c.spend,
    };
  }, [metaCampaignsFiltered]);

  const dataHealthy =
    (hasGoogle && metrics?.ok && !metricsError) || (hasMeta && metaMetrics?.ok && !metaMetricsError);
  const loadingAny = metricsLoading || metaMetricsLoading;

  const currentSpendBrl =
    (metrics?.ok ? metrics.summary.costMicros / 1_000_000 : 0) +
    (metaMetrics?.ok ? metaMetrics.summary.spend : 0);
  const prevSpendBrl =
    (cmpMetrics?.ok ? cmpMetrics.summary.costMicros / 1_000_000 : 0) +
    (cmpMetaMetrics?.ok ? cmpMetaMetrics.summary.spend : 0);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShareHint("Link copiado.");
    } catch {
      setShareHint("Não foi possível copiar.");
    }
    setTimeout(() => setShareHint(null), 2500);
  }, []);

  const tempBtn = (id: TempFilter, label: string) => (
    <Button
      type="button"
      size="sm"
      variant={tempFilter === id ? "default" : "outline"}
      className={cn("h-8 rounded-md px-3 text-xs font-medium", tempFilter !== id && "border-border/80 bg-background")}
      onClick={() => setTempFilter(id)}
    >
      {label}
    </Button>
  );

  return (
    <div
      className={cn(
        "w-full space-y-6",
        sidebarCollapsed ? "max-w-none" : "mx-auto max-w-[1600px]"
      )}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground">
            Captação por lançamento · Meta + Google (estilo Dash Fácil)
          </p>
        </div>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Última atualização:{" "}
            <span className="font-medium text-foreground">
              {lastUpdated.toLocaleDateString("pt-BR")} às{" "}
              {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </p>
        )}
      </div>

      <DashboardPanel className="px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 max-w-full items-center gap-2 sm:max-w-[320px]">
              <Select value={launchId} onValueChange={setLaunchId}>
                <SelectTrigger className="h-9 min-w-0 flex-1 rounded-md border-border/80 bg-background text-sm">
                  <SelectValue placeholder="Lançamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os lançamentos</SelectItem>
                  {launches.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} · {l.project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {launchId !== "all" && selectedLaunch && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    dataHealthy && !loadingAny
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-amber-500/15 text-amber-800 dark:text-amber-400"
                  )}
                >
                  {dataHealthy && !loadingAny ? "OK" : "…"}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-md border border-border/60 bg-muted/30 p-0.5">
              {tempBtn("geral", "Geral")}
              {tempBtn("frio", "Frio")}
              {tempBtn("quente", "Quente")}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 max-w-full justify-start gap-2 rounded-md border-border/80 sm:max-w-[280px]"
              onClick={() => setPickerOpen(true)}
            >
              <CalendarRange className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="truncate text-left font-medium">{dateRangeLabel}</span>
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
            {(hasGoogle || hasMeta) && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {hasMeta && hasGoogle ? "Meta + Google" : hasMeta ? "Meta Ads" : "Google Ads"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasGoogle || hasMeta ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-md border-border/80"
                  disabled={metricsLoading || metaMetricsLoading}
                  onClick={() => refreshAll()}
                >
                  <RefreshCw
                    className={`mr-1.5 h-3.5 w-3.5 ${metricsLoading || metaMetricsLoading ? "animate-spin" : ""}`}
                  />
                  Atualizar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-md border-border/80"
                  type="button"
                  onClick={() => navigate("/lancamentos")}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  className="h-9 rounded-md"
                  variant="secondary"
                  type="button"
                  onClick={handleShare}
                >
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  Compartilhar
                </Button>
                {shareHint ? <span className="text-xs text-muted-foreground">{shareHint}</span> : null}
                <Button variant="outline" size="sm" className="h-9 rounded-md border-border/80" asChild>
                  <Link to="/marketing/configuracoes">Metas e alertas</Link>
                </Button>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Conecte integrações para ver dados
              </span>
            )}
          </div>
        </div>
        {launchId !== "all" && selectedLaunch && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Campanhas filtradas quando o nome contém tokens do lançamento (“{selectedLaunch.name}”). Ajuste nomes no
            Google/Meta ou o título do lançamento para coincidir.
          </p>
        )}
      </DashboardPanel>

      {(hasGoogle || hasMeta) && loadingAny && (
        <div className="rounded-lg border border-primary/20 bg-primary/[0.06] px-4 py-3 shadow-sm">
          <IndeterminateLoadingBar label="Carregando métricas na API (Google / Meta)…" />
        </div>
      )}

      {compareEnabled && (hasGoogle || hasMeta) && (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          {cmpLoading ? (
            <span>Carregando comparação com o período anterior de mesmo tamanho…</span>
          ) : prevSpendBrl <= 0 && currentSpendBrl <= 0 ? (
            <span>Comparação ativa — sem gasto registrado no período atual nem no anterior.</span>
          ) : (
            <span>
              <strong className="font-medium text-foreground">Comparação:</strong> gasto no período anterior{" "}
              <span className="font-medium text-foreground">{formatSpend(prevSpendBrl)}</span>
              {currentSpendBrl > 0 && prevSpendBrl > 0 && (
                <>
                  {" "}
                  (
                  {currentSpendBrl >= prevSpendBrl ? "+" : ""}
                  {(((currentSpendBrl - prevSpendBrl) / prevSpendBrl) * 100).toFixed(1)}% em relação ao período
                  anterior)
                </>
              )}
            </span>
          )}
        </div>
      )}

      <PerformanceAlerts alerts={insightData?.alerts} loading={insightLoading} />

      {!hasGoogle && !hasMeta ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhum dado de marketing ainda"
          description="Conecte o Google Ads ou Meta Ads nas Integrações para começar a ver métricas aqui."
          actionLabel="Ir para Integrações"
          onAction={() => navigate("/marketing/integracoes")}
          className="min-h-[320px]"
        />
      ) : (
        <div className="space-y-6">
          {(metrics?.ok || metaMetrics?.ok) && (
            <DashboardPanel className="overflow-hidden">
              <div className="border-b border-border/60 bg-muted/30 px-5 py-4">
                <h2 className="text-base font-semibold tracking-tight">Desempenho geral da captação</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Indicadores no período · respeitam lançamento e temperatura selecionados
                </p>
              </div>
              <div className="space-y-6 p-5">
                <div>
                  <SectionLabel>Indicadores principais</SectionLabel>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                    <KpiStat title="Leads reais totais" value={formatNumber(Math.round(leadsReais))} icon={UserPlus} />
                    <KpiStat
                      title="Leads qualificados (MQL)"
                      value={`${mqlPct.toFixed(2)}%`}
                      hint="Conversões Google + vendas Meta ÷ volume com leads"
                      icon={Target}
                    />
                    <KpiStat
                      title="CPA tráfego"
                      value={leadsReais > 0 ? formatSpend(cpaTrafego) : "—"}
                      icon={DollarSign}
                    />
                    <KpiStat title="Valor investido" value={formatSpend(filteredSpend)} icon={DollarSign} />
                    <KpiStat
                      title="Falta para a meta"
                      value={faltaMetaLeads != null ? formatNumber(faltaMetaLeads) : "—"}
                      hint={
                        leadGoalTarget != null
                          ? `Meta: ${formatNumber(leadGoalTarget)} leads`
                          : "Sem meta de leads cadastrada (Goal)"
                      }
                      icon={TrendingUp}
                    />
                    <KpiStat
                      title="Falta investir (estim.)"
                      value={
                        faltaInvestir != null
                          ? formatSpend(faltaInvestir)
                          : "—"
                      }
                      hint="Meta de leads × CPA alvo − gasto (configurações)"
                      icon={DollarSign}
                    />
                    <KpiStat
                      title="Taxa clique → lead"
                      value={surveyRatePct != null ? `${surveyRatePct.toFixed(2)}%` : "—"}
                      hint="Proxy até integrar pesquisa/CRM"
                      icon={MousePointer}
                    />
                  </div>
                </div>

                <div>
                  <SectionLabel>Faixas de performance (por CTR ponderado)</SectionLabel>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        ["A", "Ótimos", grades.A],
                        ["B", "Bons", grades.B],
                        ["C", "Ok / fracos", grades.C],
                        ["D", "Atenção", grades.D],
                      ] as const
                    ).map(([k, label, pct]) => (
                      <div
                        key={k}
                        className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-center"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Faixa {k}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{label}</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">{pct.toFixed(0)}%</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-12">
                  <div className="space-y-4 xl:col-span-7">
                    <CaptureTrendComposedChart data={mergedChartData} />
                  </div>
                  <div className="xl:col-span-5">
                    <CaptureDualDonuts
                      hotLeads={hotCold.hotLeads}
                      coldLeads={hotCold.coldLeads}
                      hotSpend={hotCold.hotSpend}
                      coldSpend={hotCold.coldSpend}
                    />
                  </div>
                </div>
              </div>
            </DashboardPanel>
          )}

          <DashboardPanel className="overflow-hidden">
            <div className="border-b border-border/60 bg-muted/30 px-5 py-4">
              <h2 className="text-base font-semibold tracking-tight">Desempenho por plataformas</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Meta Ads e Google Ads · gráficos e campanhas</p>
            </div>
            <div className="p-5 pt-4">
              <Tabs defaultValue={hasMeta ? "meta-ads" : "google-ads"} className="w-full">
                <TabsList className="h-10 rounded-md border border-border/80 bg-muted/40 p-1">
                  {hasMeta && (
                    <TabsTrigger value="meta-ads" className="rounded-md text-xs font-semibold uppercase tracking-wide">
                      Meta Ads
                    </TabsTrigger>
                  )}
                  {hasGoogle && (
                    <TabsTrigger value="google-ads" className="rounded-md text-xs font-semibold uppercase tracking-wide">
                      Google Ads
                    </TabsTrigger>
                  )}
                </TabsList>

                {hasGoogle && (
                  <TabsContent value="google-ads" className="mt-4 space-y-5">
                    {metricsLoading ? (
                      <div className="space-y-3 rounded-xl border border-border/80 bg-card px-6 py-8">
                        <IndeterminateLoadingBar label="Carregando Google Ads…" />
                      </div>
                    ) : metricsError && !metrics ? (
                      <div className="rounded-xl border border-border/80 bg-card p-6">
                        <p className="text-sm font-medium text-muted-foreground">Google Ads</p>
                        <p className="mt-1 text-sm text-muted-foreground">{metricsError}</p>
                        <Button variant="outline" size="sm" className="mt-3 rounded-lg" onClick={loadMetrics}>
                          Tentar novamente
                        </Button>
                      </div>
                    ) : metrics?.ok ? (
                      <>
                        <SectionLabel>Resumo (filtrado)</SectionLabel>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <KpiStat title="Impressões" value={formatNumber(aggG.impressions)} icon={Eye} />
                          <KpiStat title="Cliques" value={formatNumber(aggG.clicks)} icon={MousePointer} />
                          <KpiStat title="Gasto" value={formatCost(aggG.costMicros)} icon={DollarSign} />
                          <KpiStat title="Conversões" value={formatNumber(aggG.conversions)} icon={Target} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <KpiStat
                            title="CPA"
                            value={
                              aggG.conversions > 0
                                ? formatCost(aggG.costMicros / aggG.conversions)
                                : "—"
                            }
                            icon={DollarSign}
                          />
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <CaptureDualDonuts
                            hotLeads={googleOnlyHotCold.hotLeads}
                            coldLeads={googleOnlyHotCold.coldLeads}
                            hotSpend={googleOnlyHotCold.hotSpend}
                            coldSpend={googleOnlyHotCold.coldSpend}
                          />
                          <CaptureTrendComposedChart
                            data={googleOnlyChart}
                            title="Gasto, CPA e conversões (Google · por dia)"
                          />
                        </div>
                        <SectionLabel>Campanhas</SectionLabel>
                        {metrics.campaigns.some((row) =>
                          campaignMatchesLaunch(row.campaignName, launchNameForFilter)
                        ) ? (
                          <Card className="min-w-0 rounded-xl">
                            <CardHeader>
                              <CardTitle>Por campanha (Google Ads)</CardTitle>
                              <CardDescription>
                                {launchNameForFilter || tempFilter !== "geral"
                                  ? "Filtrado pelo contexto acima"
                                  : "Todas as campanhas no período"}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="min-w-0">
                              <ScrollRegion className="scrollbar-thin">
                                <table className="w-full min-w-[640px] text-sm">
                                  <thead>
                                    <tr className="border-b text-left text-muted-foreground">
                                      <th className="pb-2 font-medium">Campanha</th>
                                      <th className="pb-2 font-medium text-right">Impressões</th>
                                      <th className="pb-2 font-medium text-right">Cliques</th>
                                      <th className="pb-2 font-medium text-right">Custo</th>
                                      <th className="pb-2 font-medium text-right">Conversões</th>
                                      <th className="pb-2 font-medium text-right">Valor conv.</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {metrics.campaigns
                                      .filter(
                                        (row) =>
                                          campaignMatchesLaunch(row.campaignName, launchNameForFilter) &&
                                          matchesTempFilter(row.campaignName, tempFilter)
                                      )
                                      .map((row, i) => (
                                        <tr key={`${row.campaignName}-${i}`} className="border-b border-border/50 last:border-0">
                                          <td className="py-2 font-medium">{row.campaignName || "—"}</td>
                                          <td className="py-2 text-right">{formatNumber(row.impressions)}</td>
                                          <td className="py-2 text-right">{formatNumber(row.clicks)}</td>
                                          <td className="py-2 text-right">{formatCost(row.costMicros)}</td>
                                          <td className="py-2 text-right">{formatNumber(row.conversions)}</td>
                                          <td className="py-2 text-right">{formatSpend(row.conversionsValue ?? 0)}</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </ScrollRegion>
                            </CardContent>
                          </Card>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma campanha corresponde ao filtro atual.
                          </p>
                        )}
                      </>
                    ) : null}
                  </TabsContent>
                )}

                {hasMeta && (
                  <TabsContent value="meta-ads" className="mt-4 space-y-5">
                    {metaMetricsLoading ? (
                      <div className="space-y-3 rounded-xl border border-border/80 bg-card px-6 py-8">
                        <IndeterminateLoadingBar label="Carregando Meta Ads…" />
                      </div>
                    ) : metaMetricsError && !metaMetrics ? (
                      <div className="rounded-xl border border-border/80 bg-card p-6">
                        <p className="text-sm font-medium text-muted-foreground">Meta Ads</p>
                        <p className="mt-1 text-sm text-muted-foreground">{metaMetricsError}</p>
                        <Button variant="outline" size="sm" className="mt-3 rounded-lg" onClick={loadMetaMetrics}>
                          Tentar novamente
                        </Button>
                      </div>
                    ) : metaMetrics?.ok ? (
                      <>
                        <SectionLabel>Resumo (filtrado)</SectionLabel>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <KpiStat title="Leads gerenciador" value={formatNumber(aggM.leads)} icon={UserPlus} />
                          <KpiStat
                            title="CPA"
                            value={
                              aggM.leads > 0 ? formatSpend(aggM.spend / aggM.leads) : "—"
                            }
                            icon={DollarSign}
                          />
                          <KpiStat title="Gasto" value={formatSpend(aggM.spend)} icon={DollarSign} />
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <CaptureDualDonuts
                            hotLeads={metaOnlyHotCold.hotLeads}
                            coldLeads={metaOnlyHotCold.coldLeads}
                            hotSpend={metaOnlyHotCold.hotSpend}
                            coldSpend={metaOnlyHotCold.coldSpend}
                          />
                          <CaptureTrendComposedChart
                            data={metaOnlyChart}
                            title="Gasto, CPA e resultados (Meta · por dia)"
                          />
                        </div>
                        {metaMetrics.summary.impressions > 0 && (
                          <Card className="rounded-xl">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2 text-base">
                                <Filter className="h-4 w-4" />
                                Funil · Impressões → Cliques
                              </CardTitle>
                              <CardDescription className="text-sm text-muted-foreground">
                                Taxa de cliques:{" "}
                                {aggM.impressions > 0
                                  ? ((aggM.clicks / aggM.impressions) * 100).toFixed(2)
                                  : "0"}
                                %
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div>
                                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                                    <span>Impressões</span>
                                    <span>{formatNumber(aggM.impressions)}</span>
                                  </div>
                                  <div className="h-8 w-full overflow-hidden rounded-lg bg-muted">
                                    <div className="h-full rounded-lg bg-primary/80" style={{ width: "100%" }} />
                                  </div>
                                </div>
                                <div>
                                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                                    <span>Cliques</span>
                                    <span>{formatNumber(aggM.clicks)}</span>
                                  </div>
                                  <div className="h-8 w-full overflow-hidden rounded-lg bg-muted">
                                    <div
                                      className="h-full rounded-lg bg-primary"
                                      style={{
                                        width: `${aggM.impressions > 0 ? (aggM.clicks / aggM.impressions) * 100 : 0}%`,
                                        minWidth: aggM.clicks > 0 ? "4px" : "0",
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        {metaMetrics.campaigns.some((c) =>
                          campaignMatchesLaunch(c.campaignName, launchNameForFilter)
                        ) ? (
                          <>
                            {metaMetrics.campaigns.filter(
                              (c) =>
                                campaignMatchesLaunch(c.campaignName, launchNameForFilter) &&
                                matchesTempFilter(c.campaignName, tempFilter)
                            ).length > 0 && (
                              <Card className="rounded-xl">
                                <CardHeader>
                                  <CardTitle className="text-base">Gasto por campanha</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="h-[280px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart
                                        data={metaMetrics.campaigns
                                          .filter(
                                            (c) =>
                                              campaignMatchesLaunch(c.campaignName, launchNameForFilter) &&
                                              matchesTempFilter(c.campaignName, tempFilter)
                                          )
                                          .map((c) => ({
                                            name:
                                              c.campaignName.length > 28
                                                ? c.campaignName.slice(0, 26) + "…"
                                                : c.campaignName,
                                            gasto: c.spend,
                                            fullName: c.campaignName,
                                          }))
                                          .sort((a, b) => b.gasto - a.gasto)
                                          .slice(0, 12)}
                                        margin={{ top: 8, right: 8, left: 0, bottom: 60 }}
                                        layout="vertical"
                                      >
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                                        <XAxis type="number" tickFormatter={(v) => formatSpend(v)} tick={{ fontSize: 11 }} />
                                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                                        <Tooltip
                                          formatter={(value: number) => [formatSpend(value), "Gasto"]}
                                          labelFormatter={(_, payload) => payload[0]?.payload?.fullName ?? ""}
                                        />
                                        <Bar dataKey="gasto" name="Gasto" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                            <AnalyticTable
                              title="Por campanha (Meta Ads)"
                              columns={metaAdsCampaignColumns}
                              data={metaMetrics.campaigns.filter(
                                (c) =>
                                  campaignMatchesLaunch(c.campaignName, launchNameForFilter) &&
                                  matchesTempFilter(c.campaignName, tempFilter)
                              )}
                            />
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma campanha corresponde ao filtro atual.
                          </p>
                        )}
                      </>
                    ) : null}
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </DashboardPanel>

          {hasGoogle &&
            !metrics?.ok &&
            !metricsError &&
            !metricsLoading &&
            hasMeta &&
            !metaMetrics?.ok &&
            !metaMetricsError &&
            !metaMetricsLoading && (
              <div className="rounded-xl border border-border/80 bg-card p-6">
                <p className="text-sm text-muted-foreground">
                  Nenhum dado no período. Altere o período ou confira as integrações.
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
