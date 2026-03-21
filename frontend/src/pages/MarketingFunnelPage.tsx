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
import { AnalyticsSection } from "@/components/analytics/AnalyticsSection";
import {
  PageHeaderPremium,
  FilterBarPremium,
  KpiCardPremium,
  DataTablePremium,
  StatusBadge,
} from "@/components/premium";
import { formatCost, formatNumber, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import { useMarketingFilteredAggregates } from "@/hooks/useMarketingFilteredAggregates";
import {
  enrichCampaignsWithGrades,
  inferPseudoUtmCampaign,
  type TempFilter,
} from "@/lib/marketing-capture-aggregate";

export type FunnelVariant = "captacao" | "conversao" | "receita";

const VARIANT_EYEBROW: Record<FunnelVariant, string> = {
  captacao: "Funil · aquisição",
  conversao: "Funil · conversão",
  receita: "Funil · monetização",
};

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

function ScrollTable({
  minWidth,
  children,
}: {
  minWidth: string;
  children: ReactNode;
}) {
  return (
    <ScrollRegion className="scrollbar-thin">
      <DataTablePremium zebra className={cn("text-[13px]", minWidth)}>
        {children}
      </DataTablePremium>
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
    leadGoalTarget,
    settings,
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

  const faltaMetaLeads =
    leadGoalTarget != null && leadGoalTarget > 0 ? Math.max(0, Math.round(leadGoalTarget - leadsReais)) : null;
  const targetCpa = settings?.targetCpaBrl ?? null;
  const faltaInvestir =
    leadGoalTarget != null && targetCpa != null && leadGoalTarget > 0
      ? leadGoalTarget * targetCpa - filteredSpend
      : null;

  return (
    <div className="w-full space-y-6">
      <PageHeaderPremium
        eyebrow={VARIANT_EYEBROW[variant]}
        breadcrumbs={[{ label: "Marketing", href: "/marketing" }, { label: vc.title }]}
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
              <span className="rounded-md border border-primary/20 bg-primary/[0.08] px-2 py-0.5 text-[11px] font-semibold text-primary">
                Comparação ativa
              </span>
            ) : null}
            <span>
              Fonte: <span className="font-medium text-foreground">{dataSourceLabel}</span>
            </span>
            {hasGoogle || hasMeta ? (
              <StatusBadge tone={dataHealthy && !loadingAny ? "healthy" : "alert"} dot>
                {loadingAny ? "Sincronizando" : dataHealthy ? "Dados OK" : "Checar integrações"}
              </StatusBadge>
            ) : null}
            <Link to="/marketing" className="font-semibold text-primary underline-offset-4 hover:underline">
              Visão completa Marketing
            </Link>
          </>
        }
        actions={
          hasGoogle || hasMeta ? (
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg border-border/70 bg-background/80 shadow-sm"
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
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9 rounded-lg shadow-sm"
                  type="button"
                  onClick={handleShare}
                >
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  Compartilhar
                </Button>
              </div>
              {shareHint ? <span className="text-right text-xs text-muted-foreground">{shareHint}</span> : null}
            </div>
          ) : null
        }
      />

      <FilterBarPremium
        label="Contexto e período"
        footer={
          launchId !== "all" && selectedLaunch ? (
            <>
              Filtro por lançamento alinhado a tokens de “{selectedLaunch.name}” nos nomes de campanha (Google/Meta).
            </>
          ) : undefined
        }
      >
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 max-w-full items-center gap-2 sm:max-w-[min(100%,380px)]">
              <Select value={launchId} onValueChange={setLaunchId}>
                <SelectTrigger className="h-9 min-w-0 flex-1 rounded-lg border-border/70 bg-background text-sm shadow-sm">
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
              {launchId !== "all" && selectedLaunch ? (
                <StatusBadge tone={dataHealthy && !loadingAny ? "connected" : "alert"} dot>
                  {dataHealthy && !loadingAny ? "Contexto OK" : "Aguardando"}
                </StatusBadge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1 rounded-xl border border-border/55 bg-muted/30 p-1 shadow-inner">
              {tempBtn("geral", "Geral")}
              {tempBtn("frio", "Frio")}
              {tempBtn("quente", "Quente")}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2 rounded-lg border-border/70 bg-background shadow-sm"
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
          {!(hasGoogle || hasMeta) ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              Conecte integrações para liberar esta visão.
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Deltas ao ativar comparação no calendário.</span>
          )}
        </div>
      </FilterBarPremium>

      {(hasGoogle || hasMeta) && (
        <AnalyticsSection
          eyebrow="Governança"
          title="Período, metas e alertas"
          description="Mesmo motor da visão Marketing — leitura compacta antes dos blocos analíticos."
          dense
        >
          <div className="space-y-4">
            {compareEnabled ? (
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                {cmpLoading ? (
                  <span>Carregando período anterior…</span>
                ) : funnelPrevSpend <= 0 && funnelCurrentSpend <= 0 ? (
                  <span>Sem gasto registrado nos dois períodos.</span>
                ) : (
                  <span>
                    <strong className="font-semibold text-foreground">Gasto anterior:</strong>{" "}
                    <span className="font-semibold tabular-nums text-foreground">{formatSpend(funnelPrevSpend)}</span>
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
            ) : null}
            <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
              <div className="grid gap-3 sm:grid-cols-2 lg:col-span-5">
                <KpiCardPremium
                  variant="compact"
                  label="Falta para meta de leads"
                  value={faltaMetaLeads != null ? formatNumber(faltaMetaLeads) : "—"}
                  icon={TrendingUp}
                  hint={
                    leadGoalTarget != null
                      ? `Meta: ${formatNumber(leadGoalTarget)} leads.`
                      : "Defina em Metas e alertas."
                  }
                />
                <KpiCardPremium
                  variant="compact"
                  label="Falta investir (est.)"
                  value={faltaInvestir != null ? formatSpend(faltaInvestir) : "—"}
                  icon={DollarSign}
                  hint="Meta × CPA alvo − gasto."
                />
              </div>
              <div className="lg:col-span-7">
                <PerformanceAlerts alerts={insightData?.alerts} loading={insightLoading} />
              </div>
            </div>
          </div>
        </AnalyticsSection>
      )}

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
            eyebrow="Faixa executiva"
            title="KPIs de tráfego e aquisição"
            description="Consolidado filtrado · CPL usa leads totais (Google conversões + Meta leads)."
            dense
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <KpiCardPremium
                variant="primary"
                label="Investimento"
                value={formatSpend(filteredSpend)}
                icon={DollarSign}
                source={dataSourceLabel}
                delta={relDelta(filteredSpend, prevFilteredSpend, compareEnabled)}
              />
              <KpiCardPremium
                variant="primary"
                label="Impressões"
                value={formatNumber(impressionsT)}
                icon={Eye}
                source={dataSourceLabel}
              />
              <KpiCardPremium
                variant="primary"
                label="Cliques"
                value={formatNumber(clicksT)}
                icon={MousePointer}
                source={dataSourceLabel}
              />
              <KpiCardPremium
                variant="primary"
                label="CPL"
                value={cplLeads != null ? formatSpend(cplLeads) : "—"}
                icon={DollarSign}
                source={dataSourceLabel}
                deltaInvert
                hint="Investimento ÷ leads totais."
              />
              <KpiCardPremium
                variant="compact"
                label="Alcance (proxy)"
                value={formatNumber(impressionsT)}
                hint="Sem alcance único na API; impressões como proxy."
                icon={Eye}
                source={dataSourceLabel}
              />
              <KpiCardPremium
                variant="compact"
                label="CTR"
                value={ctrT != null ? `${ctrT.toFixed(2)}%` : "—"}
                icon={Target}
                source={dataSourceLabel}
              />
              <KpiCardPremium
                variant="compact"
                label="CPC"
                value={cpcT != null ? formatSpend(cpcT) : "—"}
                icon={MousePointer}
                source={dataSourceLabel}
                deltaInvert
              />
              <KpiCardPremium
                variant="compact"
                label="CPM"
                value={cpmT != null ? formatSpend(cpmT) : "—"}
                icon={BarChart3}
                source={dataSourceLabel}
                deltaInvert
              />
            </div>
          </AnalyticsSection>

          <div className="grid gap-6 xl:grid-cols-2">
            <AnalyticsSection title="Meta vs Google (filtrado)" description="Comparativo de investimento e volume." dense>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/55 bg-gradient-to-br from-card to-muted/30 p-5 shadow-[var(--shadow-surface-sm)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Google Ads</p>
                    <StatusBadge tone="neutral" dot>
                      Canal
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">{formatCost(aggG.costMicros)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatNumber(aggG.impressions)} impr. · {formatNumber(aggG.clicks)} cliques ·{" "}
                    {formatNumber(aggG.conversions)} conv.
                  </p>
                </div>
                <div className="rounded-xl border border-border/55 bg-gradient-to-br from-card to-primary/[0.05] p-5 shadow-[var(--shadow-surface-sm)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Meta Ads</p>
                    <StatusBadge tone="connected" dot>
                      Canal
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">{formatSpend(aggM.spend)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
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

          <AnalyticsSection
            eyebrow="Série temporal"
            title="Evolução diária"
            description="Gasto, leads e CPA consolidados no período filtrado."
            dense
          >
            <CaptureTrendComposedChart
              embedded
              data={mergedChartData}
              description="Barras: gasto · linhas: CPA e leads."
            />
          </AnalyticsSection>

          <AnalyticsSection title="Por origem (canal)" dense>
            <ScrollTable minWidth="min-w-[720px]">
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
            </ScrollTable>
          </AnalyticsSection>

          <AnalyticsSection
            title="Agrupamento tipo UTM (heurística)"
            description="Deriva do nome da campanha (segmentos). Para UTMs reais, integre dados de landing/CRM."
            dense
          >
            <ScrollTable minWidth="min-w-[640px]">
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
            </ScrollTable>
          </AnalyticsSection>

          <AnalyticsSection title="Campanhas (top investimento)" dense>
            <ScrollTable minWidth="min-w-[800px]">
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
            </ScrollTable>
          </AnalyticsSection>
        </div>
      ) : variant === "conversao" ? (
        <div className="space-y-6">
          <AnalyticsSection
            eyebrow="Faixa executiva"
            title="Resultados totais"
            description="Volume e custo no filtro atual — topo e fundo de funil em um só olhar."
            dense
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <KpiCardPremium
                variant="primary"
                label="Leads"
                value={formatNumber(leadsReais)}
                icon={UserPlus}
                source={dataSourceLabel}
              />
              <KpiCardPremium
                variant="primary"
                label="Qualificados (est.)"
                value={formatNumber(Math.round(mqlNumerator))}
                icon={Target}
                hint="Conv. Google + vendas Meta."
                source={dataSourceLabel}
              />
              <KpiCardPremium
                variant="primary"
                label="Investimento"
                value={formatSpend(filteredSpend)}
                icon={DollarSign}
                source={dataSourceLabel}
              />
              <KpiCardPremium
                variant="primary"
                label="CPA tráfego"
                value={leadsReais > 0 ? formatSpend(filteredSpend / leadsReais) : "—"}
                icon={DollarSign}
                deltaInvert
                source={dataSourceLabel}
              />
              <KpiCardPremium
                variant="compact"
                label="Vendas Meta"
                value={formatNumber(aggM.purchases)}
                icon={ShoppingBag}
                source="Meta"
              />
              <KpiCardPremium
                variant="compact"
                label="Custo / qualif."
                value={
                  mqlNumerator > 0
                    ? formatSpend(filteredSpend / mqlNumerator)
                    : leadsReais > 0
                      ? formatSpend(filteredSpend / leadsReais)
                      : "—"
                }
                icon={DollarSign}
                deltaInvert
              />
              <KpiCardPremium
                variant="compact"
                label="Conv. lead → venda"
                value={aggM.leads > 0 ? `${((aggM.purchases / aggM.leads) * 100).toFixed(2)}%` : "—"}
                icon={TrendingUp}
                source="Meta"
              />
              <KpiCardPremium
                variant="compact"
                label="Peso faixa A"
                value={`${grades.A.toFixed(0)}%`}
                icon={BarChart3}
                hint="Participação em CTR ponderado."
              />
            </div>
          </AnalyticsSection>

          <div className="grid gap-6 lg:grid-cols-2">
            <AnalyticsSection title="Quente × frio (resultados)" description="Leads e gasto por heurística de nome." dense>
              <CaptureDualDonuts
                embedded
                hotLeads={hotCold.hotLeads}
                coldLeads={hotCold.coldLeads}
                hotSpend={hotCold.hotSpend}
                coldSpend={hotCold.coldSpend}
              />
            </AnalyticsSection>
            <AnalyticsSection title="Temperatura por plataforma" description="Mesma lógica, separada por rede." dense>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/55 bg-gradient-to-br from-card to-muted/25 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Google</p>
                    <StatusBadge tone="neutral" dot>
                      Ads
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Quente:</span>{" "}
                    {formatNumber(googleOnlyHotCold.hotLeads)} leads · {formatSpend(googleOnlyHotCold.hotSpend)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Frio:</span>{" "}
                    {formatNumber(googleOnlyHotCold.coldLeads)} · {formatSpend(googleOnlyHotCold.coldSpend)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/55 bg-gradient-to-br from-card to-primary/[0.04] p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Meta</p>
                    <StatusBadge tone="connected" dot>
                      Ads
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Quente:</span>{" "}
                    {formatNumber(metaOnlyHotCold.hotLeads)} · {formatSpend(metaOnlyHotCold.hotSpend)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Frio:</span>{" "}
                    {formatNumber(metaOnlyHotCold.coldLeads)} · {formatSpend(metaOnlyHotCold.coldSpend)}
                  </p>
                </div>
              </div>
            </AnalyticsSection>
          </div>

          <AnalyticsSection title="Agregado por faixa de score (CTR)" dense>
            <ScrollTable minWidth="min-w-[640px]">
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
            </ScrollTable>
          </AnalyticsSection>

          <AnalyticsSection
            title="Profundo (receita/venda) × topo de funil"
            description="Profundo: campanhas com receita ou venda Meta. Topo: demais."
            dense
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] to-card p-5 shadow-[var(--shadow-surface-sm)]">
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  Fundo de funil · valor / venda
                </p>
                <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">{formatSpend(deepFunnel.deepAgg.spend)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatNumber(deepFunnel.withValue.length)} campanhas · {formatNumber(deepFunnel.deepAgg.leads)} conv.
                  leads · {formatNumber(deepFunnel.deepAgg.sales)} vendas
                </p>
              </div>
              <div className="rounded-xl border border-border/55 bg-gradient-to-br from-muted/30 to-card p-5 shadow-[var(--shadow-surface-sm)]">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Topo de funil</p>
                <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">{formatSpend(deepFunnel.topAgg.spend)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatNumber(deepFunnel.topOnly.length)} campanhas · {formatNumber(deepFunnel.topAgg.leads)} leads
                </p>
              </div>
            </div>
            <ScrollTable minWidth="min-w-[900px]">
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
            </ScrollTable>
          </AnalyticsSection>
        </div>
      ) : (
        <div className="space-y-6">
          <AnalyticsSection
            eyebrow="Monetização"
            title="KPIs de receita atribuída"
            description="Valores enviados pelas APIs (Google conversões · Meta compras). Zero não é falha do painel — pode ser ausência de valor na conta ou período sem venda rastreada."
            dense
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <KpiCardPremium
                variant="primary"
                label="Valor atribuído"
                value={formatSpend(attributedRevenue)}
                icon={TrendingUp}
                source={dataSourceLabel}
                delta={relDelta(attributedRevenue, prevAttributedRevenue, compareEnabled)}
              />
              <KpiCardPremium
                variant="primary"
                label="ROAS"
                value={roas != null ? `${roas.toFixed(2)}x` : "—"}
                icon={BarChart3}
                source={dataSourceLabel}
                delta={roas != null && prevRoas != null ? relDelta(roas, prevRoas, compareEnabled) : undefined}
              />
              <KpiCardPremium
                variant="primary"
                label="Investimento"
                value={formatSpend(filteredSpend)}
                icon={DollarSign}
                source={dataSourceLabel}
              />
              <KpiCardPremium
                variant="primary"
                label="Ticket médio"
                value={ticketMedio != null ? formatSpend(ticketMedio) : "—"}
                hint={aggM.purchases === 0 ? "Sem vendas Meta no filtro." : undefined}
                icon={ShoppingBag}
                source="Meta"
              />
              <KpiCardPremium
                variant="compact"
                label="Google — valor conv."
                value={formatSpend(aggG.conversionsValue)}
                icon={Target}
              />
              <KpiCardPremium
                variant="compact"
                label="Meta — compras"
                value={formatSpend(aggM.purchaseValue)}
                icon={ShoppingBag}
              />
              <KpiCardPremium variant="compact" label="Vendas Meta" value={formatNumber(aggM.purchases)} icon={UserPlus} />
              <KpiCardPremium
                variant="compact"
                label="Leads (funil)"
                value={formatNumber(leadsReais)}
                icon={UserPlus}
                source={dataSourceLabel}
                delta={relDelta(leadsReais, prevLeadsReais, compareEnabled)}
              />
            </div>
            {attributedRevenue <= 0 && (
              <div
                className="mt-4 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-4 text-sm leading-relaxed text-muted-foreground dark:bg-sky-950/20"
                role="status"
              >
                <p className="font-semibold text-foreground">Nenhuma receita atribuída neste período</p>
                <p className="mt-2">
                  Use a visão <Link to="/marketing/conversao" className="font-medium text-primary underline-offset-4 hover:underline">Conversão</Link> para volume de leads e vendas Meta; confira se o pixel e os valores de conversão estão configurados nas contas.
                </p>
              </div>
            )}
            {attributedRevenue > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/50 pt-4">
                <RevenueDetailModal
                  total={attributedRevenue}
                  rows={revenueModalRows}
                  trigger={
                    <Button type="button" variant="outline" size="sm" className="rounded-lg border-border/70 shadow-sm">
                      Composição do faturamento (est.)
                    </Button>
                  }
                />
                <p className="max-w-xl text-xs text-muted-foreground">
                  Estimativa ilustrativa de principal vs bump; refine com checkout integrado quando disponível.
                </p>
              </div>
            )}
          </AnalyticsSection>

          <div className="grid gap-6 lg:grid-cols-2">
            <AnalyticsSection title="Receita por canal" dense>
              <ScrollTable minWidth="min-w-[480px]">
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
              </ScrollTable>
            </AnalyticsSection>
            <AnalyticsSection title="Top campanhas por receita" dense>
              <ScrollTable minWidth="min-w-[520px]">
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
              </ScrollTable>
            </AnalyticsSection>
          </div>

          <AnalyticsSection eyebrow="Série temporal" title="Gasto e resultados no período" dense>
            <CaptureTrendComposedChart
              embedded
              data={mergedChartData}
              description="Mesma série da visão Marketing — útil para cruzar picos de gasto com leads e CPA."
            />
          </AnalyticsSection>
        </div>
      )}

      {hasData && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-primary/25 bg-gradient-to-r from-primary/[0.04] via-muted/15 to-transparent px-5 py-5 shadow-[var(--shadow-surface-sm)]">
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Relatórios avançados, tabela consolidada Meta + Google e abas por plataforma estão na visão principal de Marketing.
          </p>
          <Button className="shrink-0 rounded-xl shadow-sm" asChild>
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
