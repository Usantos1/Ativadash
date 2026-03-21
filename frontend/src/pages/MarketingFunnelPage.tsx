import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CalendarRange,
  Clock,
  DollarSign,
  Eye,
  MousePointer,
  RefreshCw,
  Share2,
  ShoppingBag,
  Target,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IndeterminateLoadingBar } from "@/components/ui/indeterminate-loading-bar";
import { ScrollRegion } from "@/components/ui/scroll-region";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarketingDateRangeDialog } from "@/components/marketing/MarketingDateRangeDialog";
import { PerformanceAlerts } from "@/components/marketing/PerformanceAlerts";
import { CaptureTrendComposedChart } from "@/components/marketing/CaptureTrendComposedChart";
import { CaptureDualDonuts } from "@/components/marketing/CaptureDualDonuts";
import { RevenueDetailModal } from "@/components/marketing/RevenueDetailModal";
import { AnalyticsPageHeader } from "@/components/analytics/AnalyticsPageHeader";
import { AnalyticsSection } from "@/components/analytics/AnalyticsSection";
import { KpiPremium } from "@/components/analytics/KpiPremium";
import { formatCost, formatNumber, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import { useMarketingFilteredAggregates } from "@/hooks/useMarketingFilteredAggregates";
import {
  enrichCampaignsWithGrades,
  inferPseudoUtmCampaign,
  type TempFilter,
} from "@/lib/marketing-capture-aggregate";

export type FunnelVariant = "captacao" | "conversao" | "receita";

const VARIANT_COPY: Record<
  FunnelVariant,
  { title: string; subtitle: string; emptyHint: string }
> = {
  captacao: {
    title: "Captação",
    subtitle: "Tráfego, aquisição e eficiência de mídia — mesmo contexto de filtros da visão Marketing.",
    emptyHint: "Conecte Google Ads e/ou Meta Ads para ver impressões, cliques, CPL e comparativos.",
  },
  conversao: {
    title: "Conversão",
    subtitle: "Leads, vendas, faixas de performance e temperatura — leitura operacional densa.",
    emptyHint: "Com as integrações ativas, exibimos funil, CPA e tabelas por qualificação.",
  },
  receita: {
    title: "Receita",
    subtitle: "Monetização atribuída, ROAS, ticket e composição estimada do faturamento.",
    emptyHint: "Valor de conversão do Google e compras do Meta alimentam esta visão.",
  },
};

function relDelta(current: number, prev: number, compareEnabled: boolean): { pct: number } | undefined {
  if (!compareEnabled || prev <= 0 || !Number.isFinite(current) || !Number.isFinite(prev)) return undefined;
  return { pct: ((current - prev) / prev) * 100 };
}

function DataTable({
  minWidth,
  children,
}: {
  minWidth: string;
  children: ReactNode;
}) {
  return (
    <ScrollRegion className="scrollbar-thin">
      <table className={cn("w-full text-sm", minWidth)}>{children}</table>
    </ScrollRegion>
  );
}

export function MarketingFunnelPage({ variant }: { variant: FunnelVariant }) {
  const navigate = useNavigate();
  const vc = VARIANT_COPY[variant];
  const {
    dateRange,
    dateRangeLabel,
    presetId,
    compareEnabled,
    pickerOpen,
    setPickerOpen,
    applyDateFilter,
    cmpLoading,
    hasGoogle,
    hasMeta,
    metrics,
    metaMetrics,
    cmpMetrics,
    cmpMetaMetrics,
    metricsLoading,
    metaMetricsLoading,
    refreshAll,
    lastUpdated,
    insightData,
    insightLoading,
    launches,
    launchId,
    setLaunchId,
    tempFilter,
    setTempFilter,
    selectedLaunch,
    aggG,
    aggM,
    filteredSpend,
    mergedChartData,
    leadsReais,
    prevFilteredSpend,
    prevLeadsReais,
    prevAttributedRevenue,
    attributedRevenue,
    impressionsT,
    clicksT,
    ctrT,
    cpcT,
    cpmT,
    cplLeads,
    unifiedCampaignRows,
    mqlNumerator,
    grades,
    hotCold,
    googleOnlyHotCold,
    metaOnlyHotCold,
    dataHealthy,
    loadingAny,
    googleCampaignsFiltered,
    metaCampaignsFiltered,
  } = useMarketingFilteredAggregates();

  const [shareHint, setShareHint] = useState<string | null>(null);

  const funnelCurrentSpend =
    (metrics?.ok ? metrics.summary.costMicros / 1_000_000 : 0) +
    (metaMetrics?.ok ? metaMetrics.summary.spend : 0);
  const funnelPrevSpend =
    (cmpMetrics?.ok ? cmpMetrics.summary.costMicros / 1_000_000 : 0) +
    (cmpMetaMetrics?.ok ? cmpMetaMetrics.summary.spend : 0);

  const hasData = metrics?.ok || metaMetrics?.ok;
  const loadingBlock =
    (hasGoogle && metricsLoading && !metrics) || (hasMeta && metaMetricsLoading && !metaMetrics);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareHint("Link copiado.");
    } catch {
      setShareHint("Não foi possível copiar.");
    }
    setTimeout(() => setShareHint(null), 2200);
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

  const gradedCampaigns = useMemo(
    () => enrichCampaignsWithGrades(googleCampaignsFiltered, metaCampaignsFiltered),
    [googleCampaignsFiltered, metaCampaignsFiltered]
  );

  const gradeSummary = useMemo(() => {
    const b = {
      A: { n: 0, spend: 0, leads: 0, sales: 0, revenue: 0 },
      B: { n: 0, spend: 0, leads: 0, sales: 0, revenue: 0 },
      C: { n: 0, spend: 0, leads: 0, sales: 0, revenue: 0 },
      D: { n: 0, spend: 0, leads: 0, sales: 0, revenue: 0 },
    };
    for (const r of gradedCampaigns) {
      const x = b[r.grade];
      x.n += 1;
      x.spend += r.spend;
      x.leads += r.leads;
      x.sales += r.sales;
      x.revenue += r.revenue;
    }
    return b;
  }, [gradedCampaigns]);

  const utmRollup = useMemo(() => {
    const m = new Map<string, { spend: number; leads: number; sales: number; revenue: number }>();
    for (const r of unifiedCampaignRows) {
      const k = inferPseudoUtmCampaign(r.campaignName);
      const cur = m.get(k) ?? { spend: 0, leads: 0, sales: 0, revenue: 0 };
      cur.spend += r.spend;
      cur.leads += r.leads;
      cur.sales += r.sales;
      cur.revenue += r.revenue;
      m.set(k, cur);
    }
    return [...m.entries()]
      .map(([utm, v]) => ({ utm, ...v }))
      .sort((a, b) => b.spend - a.spend);
  }, [unifiedCampaignRows]);

  const originRollup = useMemo(() => {
    const gSpend = aggG.costMicros / 1_000_000;
    const mSpend = aggM.spend;
    return [
      {
        origem: "Google Ads",
        spend: gSpend,
        impr: aggG.impressions,
        clk: aggG.clicks,
        leads: aggG.conversions,
        rev: aggG.conversionsValue,
      },
      {
        origem: "Meta Ads",
        spend: mSpend,
        impr: aggM.impressions,
        clk: aggM.clicks,
        leads: aggM.leads,
        rev: aggM.purchaseValue,
      },
    ].filter((o) => o.spend > 0 || o.impr > 0 || o.leads > 0);
  }, [aggG, aggM]);

  const deepFunnel = useMemo(() => {
    const withValue = gradedCampaigns.filter((r) => r.revenue > 0 || r.sales > 0);
    const topOnly = gradedCampaigns.filter((r) => !(r.revenue > 0 || r.sales > 0));
    const sum = (rows: typeof gradedCampaigns) =>
      rows.reduce(
        (a, r) => ({
          spend: a.spend + r.spend,
          leads: a.leads + r.leads,
          sales: a.sales + r.sales,
        }),
        { spend: 0, leads: 0, sales: 0 }
      );
    return { withValue, topOnly, deepAgg: sum(withValue), topAgg: sum(topOnly) };
  }, [gradedCampaigns]);

  const roas = filteredSpend > 0 && attributedRevenue > 0 ? attributedRevenue / filteredSpend : null;
  const ticketMedio = aggM.purchases > 0 ? attributedRevenue / aggM.purchases : null;
  const prevRoas =
    prevFilteredSpend > 0 && prevAttributedRevenue > 0 ? prevAttributedRevenue / prevFilteredSpend : null;

  const revenueModalRows = useMemo(() => {
    const g = aggG.conversionsValue;
    const m = aggM.purchaseValue;
    const t = g + m;
    if (t <= 0) return [];
    const bump = m > 0 ? Math.min(m * 0.14, t * 0.22) : Math.min(g * 0.1, t * 0.15);
    const principal = Math.max(0, t - bump);
    return [
      { label: "Oferta principal (est.)", valor: principal, percentual: (principal / t) * 100 },
      { label: "Order bump / complementos (est.)", valor: bump, percentual: (bump / t) * 100 },
      { label: "Google — valor de conversão", valor: g, percentual: (g / t) * 100 },
      { label: "Meta — valor de compra", valor: m, percentual: (m / t) * 100 },
    ];
  }, [aggG.conversionsValue, aggM.purchaseValue]);

  const dataSourceLabel =
    hasMeta && hasGoogle ? "Meta + Google Ads" : hasMeta ? "Meta Ads" : hasGoogle ? "Google Ads" : "—";

  return (
    <div className="w-full space-y-6">
      <AnalyticsPageHeader
        title={vc.title}
        subtitle={vc.subtitle}
        meta={
          <>
            {lastUpdated ? (
              <span>
                Sincronizado:{" "}
                <span className="font-medium text-foreground">
                  {lastUpdated.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </span>
            ) : null}
            {compareEnabled ? (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">Comparação ativa</span>
            ) : null}
            <span>{dataSourceLabel}</span>
            <Link to="/marketing" className="font-medium text-primary underline-offset-4 hover:underline">
              Visão completa Marketing
            </Link>
          </>
        }
      />

      <div className="rounded-xl border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 max-w-full items-center gap-2 sm:max-w-[min(100%,360px)]">
              <Select value={launchId} onValueChange={setLaunchId}>
                <SelectTrigger className="h-9 min-w-0 flex-1 rounded-lg border-border/80 bg-background text-sm shadow-sm">
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
            <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-muted/40 p-0.5">
              {tempBtn("geral", "Geral")}
              {tempBtn("frio", "Frio")}
              {tempBtn("quente", "Quente")}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2 rounded-lg border-border/80 bg-background shadow-sm"
              onClick={() => setPickerOpen(true)}
            >
              <CalendarRange className="h-3.5 w-3.5 opacity-70" />
              <span className="font-medium">{dateRangeLabel}</span>
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
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasGoogle || hasMeta ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg shadow-sm"
                  disabled={metricsLoading || metaMetricsLoading}
                  onClick={() => refreshAll()}
                >
                  <RefreshCw
                    className={cn(
                      "mr-1.5 h-3.5 w-3.5",
                      metricsLoading || metaMetricsLoading ? "animate-spin" : ""
                    )}
                  />
                  Atualizar
                </Button>
                <Button size="sm" variant="secondary" className="h-9 rounded-lg shadow-sm" type="button" onClick={handleShare}>
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  Compartilhar
                </Button>
                {shareHint ? <span className="text-xs text-muted-foreground">{shareHint}</span> : null}
              </>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Conecte integrações
              </span>
            )}
          </div>
        </div>
      </div>

      {compareEnabled && (hasGoogle || hasMeta) && (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          {cmpLoading ? (
            <span>Carregando período anterior…</span>
          ) : funnelPrevSpend <= 0 && funnelCurrentSpend <= 0 ? (
            <span>Sem gasto registrado nos dois períodos.</span>
          ) : (
            <span>
              <strong className="font-medium text-foreground">Gasto anterior:</strong> {formatSpend(funnelPrevSpend)}
              {funnelCurrentSpend > 0 && funnelPrevSpend > 0 && (
                <>
                  {" "}
                  (
                  {funnelCurrentSpend >= funnelPrevSpend ? "+" : ""}
                  {(((funnelCurrentSpend - funnelPrevSpend) / funnelPrevSpend) * 100).toFixed(1)}%)
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
          title="Sem integrações"
          description={vc.emptyHint}
          actionLabel="Abrir integrações"
          onAction={() => navigate("/marketing/integracoes")}
          className="min-h-[280px]"
        />
      ) : loadingBlock ? (
        <div className="rounded-xl border border-border/70 bg-card px-6 py-10">
          <IndeterminateLoadingBar label="Carregando métricas…" />
        </div>
      ) : !hasData ? (
        <div className="rounded-xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
          Sem dados no período. Ajuste o intervalo ou revise{" "}
          <Link to="/marketing" className="font-medium text-primary underline-offset-4 hover:underline">
            Marketing
          </Link>
          .
        </div>
      ) : variant === "captacao" ? (
        <div className="space-y-6">
          <AnalyticsSection
            title="KPIs de tráfego e aquisição"
            description="Consolidado filtrado · CPL usa leads totais (Google conversões + Meta leads)."
            dense
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <KpiPremium label="Impressões" value={formatNumber(impressionsT)} icon={Eye} source={dataSourceLabel} />
              <KpiPremium
                label="Alcance (proxy)"
                value={formatNumber(impressionsT)}
                hint="Sem alcance único na API; usamos impressões como proxy."
                icon={Eye}
                source={dataSourceLabel}
              />
              <KpiPremium label="Cliques" value={formatNumber(clicksT)} icon={MousePointer} source={dataSourceLabel} />
              <KpiPremium
                label="CTR"
                value={ctrT != null ? `${ctrT.toFixed(2)}%` : "—"}
                icon={Target}
                source={dataSourceLabel}
              />
              <KpiPremium
                label="CPC"
                value={cpcT != null ? formatSpend(cpcT) : "—"}
                icon={MousePointer}
                source={dataSourceLabel}
                deltaInvert
              />
              <KpiPremium
                label="CPM"
                value={cpmT != null ? formatSpend(cpmT) : "—"}
                icon={BarChart3}
                source={dataSourceLabel}
                deltaInvert
              />
              <KpiPremium
                label="CPL"
                value={cplLeads != null ? formatSpend(cplLeads) : "—"}
                icon={DollarSign}
                source={dataSourceLabel}
                deltaInvert
              />
              <KpiPremium
                label="Investimento"
                value={formatSpend(filteredSpend)}
                icon={DollarSign}
                source={dataSourceLabel}
                delta={relDelta(filteredSpend, prevFilteredSpend, compareEnabled)}
              />
            </div>
          </AnalyticsSection>

          <div className="grid gap-6 xl:grid-cols-2">
            <AnalyticsSection title="Meta vs Google (filtrado)" description="Comparativo de investimento e volume." dense>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-muted/10 p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Google Ads</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums">{formatCost(aggG.costMicros)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(aggG.impressions)} impr. · {formatNumber(aggG.clicks)} cliques ·{" "}
                    {formatNumber(aggG.conversions)} conv.
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/10 p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Meta Ads</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums">{formatSpend(aggM.spend)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(aggM.impressions)} impr. · {formatNumber(aggM.clicks)} cliques ·{" "}
                    {formatNumber(aggM.leads)} leads
                  </p>
                </div>
              </div>
            </AnalyticsSection>
            <AnalyticsSection title="Funil clique → lead" description="Volume relativo no período filtrado." dense>
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Cliques</span>
                    <span>{formatNumber(clicksT)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-full rounded-full bg-primary/80" />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Leads (conv. Google + leads Meta)</span>
                    <span>{formatNumber(leadsReais)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${clicksT > 0 ? Math.min(100, (leadsReais / clicksT) * 100) : 0}%`,
                        minWidth: leadsReais > 0 ? "6px" : undefined,
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Taxa clique → lead:{" "}
                  <span className="font-medium text-foreground">
                    {clicksT > 0 ? `${((leadsReais / clicksT) * 100).toFixed(2)}%` : "—"}
                  </span>
                </p>
              </div>
            </AnalyticsSection>
          </div>

          <AnalyticsSection title="Evolução diária" description="Gasto, leads e CPA consolidados." dense>
            <CaptureTrendComposedChart data={mergedChartData} />
          </AnalyticsSection>

          <AnalyticsSection title="Por origem (canal)" dense>
            <DataTable minWidth="min-w-[720px]">
              <thead>
                <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3">Origem</th>
                  <th className="pb-2 pr-3 text-right">Investimento</th>
                  <th className="pb-2 pr-3 text-right">Impressões</th>
                  <th className="pb-2 pr-3 text-right">Cliques</th>
                  <th className="pb-2 pr-3 text-right">CTR</th>
                  <th className="pb-2 pr-3 text-right">CPC</th>
                  <th className="pb-2 pr-3 text-right">Leads / conv.</th>
                  <th className="pb-2 text-right">Receita atrib.</th>
                </tr>
              </thead>
              <tbody>
                {originRollup.map((o) => {
                  const ctr = o.impr > 0 ? (o.clk / o.impr) * 100 : null;
                  const cpc = o.clk > 0 ? o.spend / o.clk : null;
                  return (
                    <tr key={o.origem} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-2.5 pr-3 font-medium">{o.origem}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{formatSpend(o.spend)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumber(o.impr)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumber(o.clk)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{ctr != null ? `${ctr.toFixed(2)}%` : "—"}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{cpc != null ? formatSpend(cpc) : "—"}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumber(o.leads)}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatSpend(o.rev)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </AnalyticsSection>

          <AnalyticsSection
            title="Agrupamento tipo UTM (heurística)"
            description="Deriva do nome da campanha (segmentos). Para UTMs reais, integre dados de landing/CRM."
            dense
          >
            <DataTable minWidth="min-w-[640px]">
              <thead>
                <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                  <th className="pb-2 pr-3">Campanha / grupo</th>
                  <th className="pb-2 pr-3 text-right">Investimento</th>
                  <th className="pb-2 pr-3 text-right">Leads</th>
                  <th className="pb-2 pr-3 text-right">Vendas</th>
                  <th className="pb-2 text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {utmRollup.slice(0, 40).map((u) => (
                  <tr key={u.utm} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="max-w-[280px] truncate py-2.5 pr-3 font-medium" title={u.utm}>
                      {u.utm}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatSpend(u.spend)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumber(u.leads)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumber(u.sales)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatSpend(u.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </AnalyticsSection>

          <AnalyticsSection title="Campanhas (top investimento)" dense>
            <DataTable minWidth="min-w-[800px]">
              <thead>
                <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                  <th className="pb-2 pr-3">Canal</th>
                  <th className="pb-2 pr-3">Campanha</th>
                  <th className="pb-2 pr-3 text-right">Investimento</th>
                  <th className="pb-2 pr-3 text-right">CTR</th>
                  <th className="pb-2 pr-3 text-right">CPC</th>
                  <th className="pb-2 pr-3 text-right">Leads</th>
                  <th className="pb-2 text-right">CPL</th>
                </tr>
              </thead>
              <tbody>
                {unifiedCampaignRows.slice(0, 35).map((r, i) => {
                  const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : null;
                  const cpc = r.clicks > 0 ? r.spend / r.clicks : null;
                  const cpl = r.leads > 0 ? r.spend / r.leads : null;
                  return (
                    <tr key={`${r.channel}-${i}`} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-2.5 pr-3 text-xs font-semibold text-muted-foreground">{r.channel}</td>
                      <td className="max-w-[240px] truncate py-2.5 pr-3 font-medium" title={r.campaignName}>
                        {r.campaignName}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{formatSpend(r.spend)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{ctr != null ? `${ctr.toFixed(2)}%` : "—"}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{cpc != null ? formatSpend(cpc) : "—"}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumber(r.leads)}</td>
                      <td className="py-2.5 text-right tabular-nums">{cpl != null ? formatSpend(cpl) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </AnalyticsSection>
        </div>
      ) : variant === "conversao" ? (
        <div className="space-y-6">
          <AnalyticsSection title="Resultados totais" description="Volume e custo no filtro atual." dense>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <KpiPremium label="Leads" value={formatNumber(leadsReais)} icon={UserPlus} source={dataSourceLabel} />
              <KpiPremium
                label="Qualificados (est.)"
                value={formatNumber(Math.round(mqlNumerator))}
                icon={Target}
                hint="Conv. Google + vendas Meta."
                source={dataSourceLabel}
              />
              <KpiPremium label="Vendas Meta" value={formatNumber(aggM.purchases)} icon={ShoppingBag} source="Meta" />
              <KpiPremium
                label="CPA tráfego"
                value={leadsReais > 0 ? formatSpend(filteredSpend / leadsReais) : "—"}
                icon={DollarSign}
                deltaInvert
                source={dataSourceLabel}
              />
              <KpiPremium
                label="Custo / qualif."
                value={
                  mqlNumerator > 0 ? formatSpend(filteredSpend / mqlNumerator) : leadsReais > 0 ? formatSpend(filteredSpend / leadsReais) : "—"
                }
                icon={DollarSign}
                deltaInvert
              />
              <KpiPremium
                label="Conv. lead → venda"
                value={aggM.leads > 0 ? `${((aggM.purchases / aggM.leads) * 100).toFixed(2)}%` : "—"}
                icon={TrendingUp}
                source="Meta"
              />
              <KpiPremium
                label="Distribuição score A"
                value={`${grades.A.toFixed(0)}%`}
                icon={BarChart3}
                hint="Peso por CTR de campanha."
              />
              <KpiPremium label="Investimento" value={formatSpend(filteredSpend)} icon={DollarSign} />
            </div>
          </AnalyticsSection>

          <div className="grid gap-6 lg:grid-cols-2">
            <AnalyticsSection title="Quente × frio (resultados)" dense>
              <CaptureDualDonuts
                hotLeads={hotCold.hotLeads}
                coldLeads={hotCold.coldLeads}
                hotSpend={hotCold.hotSpend}
                coldSpend={hotCold.coldSpend}
              />
            </AnalyticsSection>
            <AnalyticsSection title="Temperatura por plataforma" dense>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 p-3 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground">Google</p>
                  <p className="mt-1 text-muted-foreground">
                    Quente: {formatNumber(googleOnlyHotCold.hotLeads)} leads · {formatSpend(googleOnlyHotCold.hotSpend)}
                  </p>
                  <p className="text-muted-foreground">
                    Frio: {formatNumber(googleOnlyHotCold.coldLeads)} · {formatSpend(googleOnlyHotCold.coldSpend)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 p-3 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground">Meta</p>
                  <p className="mt-1 text-muted-foreground">
                    Quente: {formatNumber(metaOnlyHotCold.hotLeads)} · {formatSpend(metaOnlyHotCold.hotSpend)}
                  </p>
                  <p className="text-muted-foreground">
                    Frio: {formatNumber(metaOnlyHotCold.coldLeads)} · {formatSpend(metaOnlyHotCold.coldSpend)}
                  </p>
                </div>
              </div>
            </AnalyticsSection>
          </div>

          <AnalyticsSection title="Agregado por faixa de score (CTR)" dense>
            <DataTable minWidth="min-w-[640px]">
              <thead>
                <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                  <th className="pb-2 pr-3">Faixa</th>
                  <th className="pb-2 pr-3 text-right">Campanhas</th>
                  <th className="pb-2 pr-3 text-right">Investimento</th>
                  <th className="pb-2 pr-3 text-right">Leads</th>
                  <th className="pb-2 pr-3 text-right">Vendas</th>
                  <th className="pb-2 text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {(["A", "B", "C", "D"] as const).map((g) => {
                  const x = gradeSummary[g];
                  return (
                    <tr key={g} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-2.5 pr-3 font-semibold">{g}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumber(x.n)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{formatSpend(x.spend)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumber(x.leads)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumber(x.sales)}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatSpend(x.revenue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </AnalyticsSection>

          <AnalyticsSection
            title="Profundo (receita/venda) × topo de funil"
            description="Profundo: campanhas com receita ou venda Meta. Topo: demais."
            dense
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-300">Com valor / venda</p>
                <p className="mt-2 text-lg font-semibold tabular-nums">{formatSpend(deepFunnel.deepAgg.spend)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(deepFunnel.withValue.length)} campanhas · {formatNumber(deepFunnel.deepAgg.leads)} conv.
                  leads · {formatNumber(deepFunnel.deepAgg.sales)} vendas
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/10 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Topo de funil</p>
                <p className="mt-2 text-lg font-semibold tabular-nums">{formatSpend(deepFunnel.topAgg.spend)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(deepFunnel.topOnly.length)} campanhas · {formatNumber(deepFunnel.topAgg.leads)} leads
                </p>
              </div>
            </div>
            <DataTable minWidth="min-w-[900px]">
              <thead>
                <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                  <th className="pb-2 pr-3">Canal</th>
                  <th className="pb-2 pr-3">Campanha</th>
                  <th className="pb-2 pr-3">Faixa</th>
                  <th className="pb-2 pr-3 text-right">Investimento</th>
                  <th className="pb-2 pr-3 text-right">Leads</th>
                  <th className="pb-2 pr-3 text-right">Vendas</th>
                  <th className="pb-2 text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {gradedCampaigns.slice(0, 45).map((r, i) => (
                  <tr key={`${r.channel}-${i}`} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-2.5 pr-3 text-xs font-medium text-muted-foreground">{r.channel}</td>
                    <td className="max-w-[220px] truncate py-2.5 pr-3 font-medium" title={r.campaignName}>
                      {r.campaignName}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold">{r.grade}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatSpend(r.spend)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumber(r.leads)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatNumber(r.sales)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatSpend(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </AnalyticsSection>
        </div>
      ) : (
        <div className="space-y-6">
          <AnalyticsSection title="Monetização" description="Valores atribuídos pelas APIs das plataformas." dense>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <KpiPremium label="Investimento" value={formatSpend(filteredSpend)} icon={DollarSign} />
              <KpiPremium
                label="Valor atribuído"
                value={formatSpend(attributedRevenue)}
                icon={TrendingUp}
                delta={relDelta(attributedRevenue, prevAttributedRevenue, compareEnabled)}
              />
              <KpiPremium
                label="ROAS"
                value={roas != null ? `${roas.toFixed(2)}x` : "—"}
                icon={BarChart3}
                delta={roas != null && prevRoas != null ? relDelta(roas, prevRoas, compareEnabled) : undefined}
              />
              <KpiPremium
                label="Ticket médio"
                value={ticketMedio != null ? formatSpend(ticketMedio) : "—"}
                hint={aggM.purchases === 0 ? "Sem vendas Meta no filtro." : undefined}
                icon={ShoppingBag}
              />
              <KpiPremium label="Google — valor conv." value={formatSpend(aggG.conversionsValue)} icon={Target} />
              <KpiPremium label="Meta — compras" value={formatSpend(aggM.purchaseValue)} icon={ShoppingBag} />
              <KpiPremium label="Vendas Meta" value={formatNumber(aggM.purchases)} icon={UserPlus} />
              <KpiPremium
                label="Leads (funil)"
                value={formatNumber(leadsReais)}
                icon={UserPlus}
                delta={relDelta(leadsReais, prevLeadsReais, compareEnabled)}
              />
            </div>
            {attributedRevenue > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
                <RevenueDetailModal
                  total={attributedRevenue}
                  rows={revenueModalRows}
                  trigger={
                    <Button type="button" variant="outline" size="sm" className="rounded-lg">
                      Composição do faturamento (est.)
                    </Button>
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Estimativa ilustrativa de principal vs bump; ajuste com dados reais de checkout quando integrados.
                </p>
              </div>
            )}
          </AnalyticsSection>

          <div className="grid gap-6 lg:grid-cols-2">
            <AnalyticsSection title="Receita por canal" dense>
              <DataTable minWidth="min-w-[480px]">
                <thead>
                  <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                    <th className="pb-2 pr-3">Canal</th>
                    <th className="pb-2 pr-3 text-right">Investimento</th>
                    <th className="pb-2 pr-3 text-right">Receita</th>
                    <th className="pb-2 text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      nome: "Google Ads",
                      sp: aggG.costMicros / 1_000_000,
                      rev: aggG.conversionsValue,
                    },
                    { nome: "Meta Ads", sp: aggM.spend, rev: aggM.purchaseValue },
                  ].map((row) => {
                    const r = row.sp > 0 && row.rev > 0 ? row.rev / row.sp : null;
                    return (
                      <tr key={row.nome} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="py-2.5 pr-3 font-medium">{row.nome}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{formatSpend(row.sp)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{formatSpend(row.rev)}</td>
                        <td className="py-2.5 text-right tabular-nums">{r != null ? `${r.toFixed(2)}x` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </AnalyticsSection>
            <AnalyticsSection title="Top campanhas por receita" dense>
              <DataTable minWidth="min-w-[520px]">
                <thead>
                  <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                    <th className="pb-2 pr-3">Campanha</th>
                    <th className="pb-2 pr-3 text-right">Investimento</th>
                    <th className="pb-2 text-right">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {[...unifiedCampaignRows]
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 12)
                    .map((r, i) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="max-w-[240px] truncate py-2.5 pr-3 text-sm font-medium" title={r.campaignName}>
                          <span className="mr-2 text-[10px] text-muted-foreground">{r.channel}</span>
                          {r.campaignName}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{formatSpend(r.spend)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatSpend(r.revenue)}</td>
                      </tr>
                    ))}
                </tbody>
              </DataTable>
            </AnalyticsSection>
          </div>

          <AnalyticsSection title="Série no período" dense>
            <CaptureTrendComposedChart data={mergedChartData} />
          </AnalyticsSection>
        </div>
      )}

      {hasData && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            Relatórios avançados e tabela consolidada completa na visão principal.
          </p>
          <Button className="rounded-lg" asChild>
            <Link to="/marketing" className="gap-2">
              Abrir Marketing
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
