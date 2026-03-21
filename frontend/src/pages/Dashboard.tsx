import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CalendarRange,
  DollarSign,
  Eye,
  LayoutDashboard,
  MousePointer,
  Plug,
  RefreshCw,
  ShoppingBag,
  Target,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCost, formatNumber, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import { PerformanceAlerts } from "@/components/marketing/PerformanceAlerts";
import { MarketingDateRangeDialog } from "@/components/marketing/MarketingDateRangeDialog";
import { IndeterminateLoadingBar } from "@/components/ui/indeterminate-loading-bar";
import { AnalyticsSection } from "@/components/analytics/AnalyticsSection";
import {
  PageHeaderPremium,
  FilterBarPremium,
  KpiCardPremium,
  ChartPanelPremium,
  StatusBadge,
} from "@/components/premium";

function greetingName(email: string | undefined): string {
  if (!email) return "Bem-vindo";
  const local = email.split("@")[0]?.trim();
  if (!local) return "Bem-vindo";
  const first = local.split(/[._-]/)[0];
  if (!first) return "Bem-vindo";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function relDelta(
  current: number,
  prev: number,
  compareEnabled: boolean
): { pct: number } | undefined {
  if (!compareEnabled || prev <= 0 || !Number.isFinite(current) || !Number.isFinite(prev)) return undefined;
  return { pct: ((current - prev) / prev) * 100 };
}

export function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
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

  const dashCurrentSpend =
    (metrics?.ok ? metrics.summary.costMicros / 1_000_000 : 0) +
    (metaMetrics?.ok ? metaMetrics.summary.spend : 0);
  const dashPrevSpend =
    (cmpMetrics?.ok ? cmpMetrics.summary.costMicros / 1_000_000 : 0) +
    (cmpMetaMetrics?.ok ? cmpMetaMetrics.summary.spend : 0);

  const hasAnyChannel = hasGoogle || hasMeta;
  const dataLoading = (hasGoogle && metricsLoading) || (hasMeta && metaMetricsLoading);
  const googleOk = metrics?.ok;
  const metaOk = metaMetrics?.ok;
  const dataHealthy =
    (hasGoogle && googleOk && !metricsError) || (hasMeta && metaOk && !metaMetricsError);

  const totalImpressions =
    (googleOk ? metrics.summary.impressions : 0) + (metaOk ? metaMetrics.summary.impressions : 0);
  const totalClicks =
    (googleOk ? metrics.summary.clicks : 0) + (metaOk ? metaMetrics.summary.clicks : 0);
  const googleSpend = googleOk ? metrics.summary.costMicros / 1_000_000 : 0;
  const metaSpend = metaOk ? metaMetrics.summary.spend : 0;
  const totalSpend = googleSpend + metaSpend;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const metaLeads = metaOk ? (metaMetrics.summary.leads ?? 0) : 0;
  const metaPurchases = metaOk ? (metaMetrics.summary.purchases ?? 0) : 0;
  const metaPurchaseVal = metaOk ? (metaMetrics.summary.purchaseValue ?? 0) : 0;
  const googleConversions = googleOk ? (metrics.summary.conversions ?? 0) : 0;
  const googleConvValue = googleOk ? (metrics.summary.conversionsValue ?? 0) : 0;
  const totalResultValue = googleConvValue + metaPurchaseVal;
  const totalResults = googleConversions + metaLeads + metaPurchases;
  const cpaResults = totalResults > 0 ? totalSpend / totalResults : 0;

  const dataSourceLabel =
    hasMeta && hasGoogle ? "Meta + Google Ads" : hasMeta ? "Meta Ads" : hasGoogle ? "Google Ads" : "—";

  const donutData = [
    { name: "Meta Ads", value: metaSpend, fill: "hsl(var(--primary))" },
    { name: "Google Ads", value: googleSpend, fill: "hsl(217 91% 60%)" },
  ].filter((d) => d.value > 0);

  const topGoogle =
    googleOk && metrics.campaigns.length > 0
      ? [...metrics.campaigns].sort((a, b) => b.costMicros - a.costMicros).slice(0, 4)
      : [];
  const topMeta =
    metaOk && metaMetrics.campaigns.length > 0
      ? [...metaMetrics.campaigns].sort((a, b) => b.spend - a.spend).slice(0, 4)
      : [];

  return (
    <div
      className={cn(
        "w-full space-y-6",
        sidebarCollapsed ? "max-w-none" : "mx-auto max-w-[1600px]"
      )}
    >
      <PageHeaderPremium
        eyebrow="Visão geral"
        title={`Olá, ${greetingName(user?.email)}`}
        subtitle="Resumo executivo do período e das conexões. Para gráficos completos, tabelas e filtros por lançamento, abra Marketing."
        meta={
          <>
            {lastUpdated ? (
              <span className="flex items-center gap-1.5">
                <LayoutDashboard className="h-3.5 w-3.5 opacity-70" aria-hidden />
                Atualizado{" "}
                <span className="font-medium text-foreground">
                  {lastUpdated.toLocaleDateString("pt-BR")}{" "}
                  {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
            ) : null}
            {compareEnabled ? (
              <span className="rounded-md border border-primary/20 bg-primary/[0.08] px-2 py-0.5 text-[11px] font-semibold text-primary">
                Comparação ativa
              </span>
            ) : null}
            {hasAnyChannel ? (
              <>
                <span>
                  Fonte: <span className="font-medium text-foreground">{dataSourceLabel}</span>
                </span>
                <StatusBadge tone={dataHealthy && !dataLoading ? "healthy" : "alert"} dot>
                  {dataLoading ? "Carregando" : dataHealthy ? "Sinal OK" : "Verificar APIs"}
                </StatusBadge>
              </>
            ) : null}
            <Link to="/marketing" className="font-semibold text-primary underline-offset-4 hover:underline">
              Ir para Marketing
            </Link>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 max-w-full justify-start gap-2 rounded-lg border-border/70 bg-background/80 shadow-sm sm:max-w-[280px]"
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
            {hasAnyChannel ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg border-border/70 shadow-sm"
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
            ) : null}
            <Button variant="secondary" size="sm" className="h-9 rounded-lg shadow-sm" asChild>
              <Link to="/marketing/integracoes" className="gap-1.5">
                <Plug className="h-3.5 w-3.5" />
                Integrações
              </Link>
            </Button>
          </div>
        }
      />

      <FilterBarPremium
        label="Período e contexto"
        footer="O mesmo intervalo e opção de comparação são usados na visão Marketing e neste resumo."
      >
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Período selecionado: <span className="font-semibold text-foreground">{dateRangeLabel}</span>
            {compareEnabled ? (
              <span className="ml-2 text-xs">· deltas de investimento quando aplicável</span>
            ) : null}
          </p>
          {hasAnyChannel ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={hasGoogle ? "connected" : "disconnected"} dot>
                Google Ads
              </StatusBadge>
              <StatusBadge tone={hasMeta ? "connected" : "disconnected"} dot>
                Meta Ads
              </StatusBadge>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Nenhuma rede conectada ainda.</span>
          )}
        </div>
      </FilterBarPremium>

      {hasAnyChannel && (
        <AnalyticsSection
          eyebrow="Governança"
          title="Comparação e alertas"
          description="Mesmos insights de metas e performance usados no Marketing."
          dense
        >
          <div className="space-y-4">
            {compareEnabled ? (
              <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                {cmpLoading ? (
                  <span>Carregando comparação com o período anterior…</span>
                ) : dashPrevSpend <= 0 && dashCurrentSpend <= 0 ? (
                  <span>Comparação ativa — sem gasto no período atual nem no anterior.</span>
                ) : (
                  <span>
                    <strong className="font-semibold text-foreground">Gasto no período anterior:</strong>{" "}
                    <span className="font-semibold tabular-nums text-foreground">{formatSpend(dashPrevSpend)}</span>
                    {dashCurrentSpend > 0 && dashPrevSpend > 0 && (
                      <>
                        {" "}
                        (
                        {dashCurrentSpend >= dashPrevSpend ? "+" : ""}
                        {(((dashCurrentSpend - dashPrevSpend) / dashPrevSpend) * 100).toFixed(1)}% vs. anterior)
                      </>
                    )}
                  </span>
                )}
              </div>
            ) : null}
            <PerformanceAlerts alerts={insightData?.alerts} loading={insightLoading} />
          </div>
        </AnalyticsSection>
      )}

      {!hasAnyChannel ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <EmptyState
              icon={BarChart3}
              title="Comece pelas integrações"
              description="Conecte Google Ads ou Meta para ver investimento, tráfego e resultados neste painel. Tudo que você configurar aqui alimenta o Marketing."
              actionLabel="Abrir integrações"
              onAction={() => navigate("/marketing/integracoes")}
              className="min-h-[280px] rounded-2xl border-border/55 bg-card shadow-[var(--shadow-surface)]"
            />
          </div>
          <AnalyticsSection title="Atalhos" description="Acesso rápido ao núcleo analítico." dense>
            <ul className="space-y-1">
              <li>
                <Link
                  to="/marketing"
                  className="flex items-center justify-between rounded-xl border border-transparent px-3 py-3 text-sm transition-colors hover:border-border/60 hover:bg-muted/30"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Marketing
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
              <li>
                <Link
                  to="/marketing/integracoes"
                  className="flex items-center justify-between rounded-xl border border-transparent px-3 py-3 text-sm transition-colors hover:border-border/60 hover:bg-muted/30"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Plug className="h-4 w-4 text-primary" />
                    Integrações
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            </ul>
          </AnalyticsSection>
        </div>
      ) : dataLoading ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-2xl border border-border/55 bg-card px-8 py-10 shadow-[var(--shadow-surface-sm)]">
          <div className="w-full max-w-md">
            <IndeterminateLoadingBar label="Carregando resumo do período…" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {(googleOk || metaOk) && (
            <>
              <AnalyticsSection
                eyebrow="Faixa executiva"
                title="Tráfego e investimento"
                description="Totais consolidados no período — alinhados ao recorte do Marketing."
                dense
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCardPremium
                    variant="primary"
                    label="Investimento"
                    value={formatSpend(totalSpend)}
                    icon={DollarSign}
                    source={dataSourceLabel}
                    delta={relDelta(dashCurrentSpend, dashPrevSpend, compareEnabled)}
                  />
                  <KpiCardPremium
                    variant="primary"
                    label="Impressões"
                    value={formatNumber(totalImpressions)}
                    icon={Eye}
                    source={dataSourceLabel}
                  />
                  <KpiCardPremium
                    variant="primary"
                    label="Cliques"
                    value={formatNumber(totalClicks)}
                    icon={MousePointer}
                    source={dataSourceLabel}
                  />
                  <KpiCardPremium
                    variant="primary"
                    label="CPC médio"
                    value={totalClicks > 0 ? formatSpend(cpc) : "—"}
                    icon={Target}
                    source={dataSourceLabel}
                    deltaInvert
                  />
                </div>
              </AnalyticsSection>

              <AnalyticsSection
                eyebrow="Resultados"
                title="Volume e atribuição"
                description="Leads e conversões por API; valor atribuído soma Google e Meta."
                dense
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCardPremium
                    variant="compact"
                    label="Leads (Meta)"
                    value={formatNumber(metaLeads)}
                    hint="WhatsApp, Messenger e formulários"
                    icon={UserPlus}
                    source="Meta Ads"
                  />
                  <KpiCardPremium
                    variant="compact"
                    label="Vendas (Meta)"
                    value={formatNumber(metaPurchases)}
                    icon={ShoppingBag}
                    source="Meta Ads"
                  />
                  <KpiCardPremium
                    variant="compact"
                    label="Conversões (Google)"
                    value={formatNumber(googleConversions)}
                    icon={Target}
                    source="Google Ads"
                  />
                  <KpiCardPremium
                    variant="compact"
                    label="Resultados totais"
                    value={formatNumber(totalResults)}
                    icon={TrendingUp}
                    source={dataSourceLabel}
                  />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <KpiCardPremium
                    variant="compact"
                    label="CPA por resultado"
                    value={totalResults > 0 ? formatSpend(cpaResults) : "—"}
                    icon={DollarSign}
                    source={dataSourceLabel}
                    deltaInvert
                  />
                  <KpiCardPremium
                    variant="compact"
                    label="Valor atribuído"
                    value={totalResultValue > 0 ? formatSpend(totalResultValue) : "—"}
                    hint="Google + Meta"
                    icon={TrendingUp}
                    source={dataSourceLabel}
                  />
                </div>
              </AnalyticsSection>

              {hasGoogle && hasMeta && donutData.length > 0 && (
                <ChartPanelPremium
                  title="Participação no investimento"
                  description="Distribuição do gasto entre redes no período."
                  contentClassName="pt-2"
                >
                  <div className="mx-auto min-h-[240px] max-w-md flex-1">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={78}
                          paddingAngle={2.5}
                          dataKey="value"
                          nameKey="name"
                          stroke="hsl(var(--card))"
                          strokeWidth={2}
                        >
                          {donutData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            fontSize: 12,
                            border: "1px solid hsl(var(--border))",
                          }}
                          formatter={(v: number) => [formatSpend(v), "Gasto"]}
                        />
                        <Legend
                          verticalAlign="bottom"
                          wrapperStyle={{ fontSize: 12 }}
                          formatter={(value) => <span className="text-muted-foreground">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </ChartPanelPremium>
              )}
            </>
          )}

          {(metricsError && hasGoogle) || (metaMetricsError && hasMeta) ? (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-5 text-sm text-muted-foreground shadow-[var(--shadow-surface-sm)]">
              {metricsError && hasGoogle && <p>Google Ads: {metricsError}</p>}
              {metaMetricsError && hasMeta && (
                <p className={metricsError && hasGoogle ? "mt-2" : ""}>Meta: {metaMetricsError}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {hasGoogle && (
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={loadMetrics}>
                    Tentar Google
                  </Button>
                )}
                {hasMeta && (
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={loadMetaMetrics}>
                    Tentar Meta
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {hasAnyChannel && !googleOk && !metaOk && !metricsError && !metaMetricsError && !dataLoading && (
            <div
              className="rounded-2xl border border-border/55 bg-card p-6 text-sm leading-relaxed text-muted-foreground shadow-[var(--shadow-surface-sm)]"
              role="status"
            >
              Nenhum dado no período selecionado. Tente outro intervalo ou confira as contas nas integrações.
            </div>
          )}

          {(topGoogle.length > 0 || topMeta.length > 0) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {topGoogle.length > 0 && (
                <AnalyticsSection
                  title="Top campanhas · Google Ads"
                  description="Ordenadas por custo no período."
                  dense
                >
                  <ul className="space-y-0 divide-y divide-border/40">
                    {topGoogle.map((row, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0 transition-colors hover:bg-muted/20"
                      >
                        <span className="min-w-0 truncate font-medium text-foreground">
                          {row.campaignName || "—"}
                        </span>
                        <span className="shrink-0 tabular-nums font-semibold text-foreground">
                          {formatCost(row.costMicros)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </AnalyticsSection>
              )}
              {topMeta.length > 0 && (
                <AnalyticsSection title="Top campanhas · Meta Ads" description="Ordenadas por gasto no período." dense>
                  <ul className="space-y-0 divide-y divide-border/40">
                    {topMeta.map((row, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0 transition-colors hover:bg-muted/20"
                      >
                        <span className="min-w-0 truncate font-medium text-foreground">
                          {row.campaignName || "—"}
                        </span>
                        <span className="shrink-0 tabular-nums font-semibold text-foreground">
                          {formatSpend(row.spend)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </AnalyticsSection>
              )}
            </div>
          )}

          <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-primary/25 bg-gradient-to-r from-primary/[0.04] via-muted/15 to-transparent px-5 py-5 shadow-[var(--shadow-surface-sm)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">Análise detalhada</p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                Gráficos compostos, tabela consolidada Meta + Google, filtros por lançamento e abas por rede estão em
                Marketing.
              </p>
            </div>
            <Button className="shrink-0 rounded-xl shadow-sm" asChild>
              <Link to="/marketing" className="gap-2">
                Abrir Marketing
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
