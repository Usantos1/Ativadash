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
  UserPlus,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticTable } from "@/components/marketing/AnalyticTable";
import { DashboardPanel, KpiStat, SectionLabel } from "@/components/dashboard/DashboardPrimitives";
import { formatCost, formatNumber, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import type { MetaAdsCampaignRow } from "@/lib/integrations-api";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import { PerformanceAlerts } from "@/components/marketing/PerformanceAlerts";

const periods = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
] as const;

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
    insightData,
    insightLoading,
  } = useMarketingMetrics();

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
            Visão executiva · Captação, conversão e receita (Meta + Google)
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
            <Select value="none" disabled>
              <SelectTrigger className="h-9 w-[200px] rounded-md border-border/80 bg-background text-sm">
                <SelectValue placeholder="Lançamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum lançamento</SelectItem>
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={(v) => setPeriod(v as "7d" | "30d" | "90d")}>
              <SelectTrigger className="h-9 w-[170px] rounded-md border-border/80 bg-background text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <Button size="sm" className="h-9 rounded-md" variant="secondary" disabled>
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  Compartilhar
                </Button>
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
      </DashboardPanel>

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
          {/* Desempenho geral da captação */}
          {(metrics?.ok || metaMetrics?.ok) && (
            <DashboardPanel className="overflow-hidden">
              <div className="border-b border-border/60 bg-muted/30 px-5 py-4">
                <h2 className="text-base font-semibold tracking-tight">Desempenho geral da captação</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Indicadores consolidados no período selecionado
                </p>
              </div>
              <div className="p-5">
                {(() => {
                  const totalImpressions =
                    (metrics?.ok ? metrics.summary.impressions : 0) +
                    (metaMetrics?.ok ? metaMetrics.summary.impressions : 0);
                  const totalClicks =
                    (metrics?.ok ? metrics.summary.clicks : 0) +
                    (metaMetrics?.ok ? metaMetrics.summary.clicks : 0);
                  const googleSpend = metrics?.ok ? metrics.summary.costMicros / 1_000_000 : 0;
                  const metaSpend = metaMetrics?.ok ? metaMetrics.summary.spend : 0;
                  const totalSpend = googleSpend + metaSpend;
                  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
                  const metaLeads = metaMetrics?.ok ? (metaMetrics.summary.leads ?? 0) : 0;
                  const metaPurchases = metaMetrics?.ok ? (metaMetrics.summary.purchases ?? 0) : 0;
                  const metaPurchaseVal = metaMetrics?.ok ? (metaMetrics.summary.purchaseValue ?? 0) : 0;
                  const googleConversions = metrics?.ok ? (metrics.summary.conversions ?? 0) : 0;
                  const googleConvValue = metrics?.ok ? (metrics.summary.conversionsValue ?? 0) : 0;
                  const totalResultValue = googleConvValue + metaPurchaseVal;
                  const totalResults = googleConversions + metaLeads + metaPurchases;
                  const cpaResults = totalResults > 0 ? totalSpend / totalResults : 0;
                  const donutData = [
                    { name: "Meta Ads", value: metaSpend, fill: "hsl(var(--primary))" },
                    { name: "Google Ads", value: googleSpend, fill: "hsl(217 91% 60%)" },
                  ].filter((d) => d.value > 0);
                  return (
                    <div className="grid gap-8 xl:grid-cols-12">
                      <div className="space-y-6 xl:col-span-8">
                        <div>
                          <SectionLabel>Tráfego e investimento</SectionLabel>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <KpiStat title="Impressões totais" value={formatNumber(totalImpressions)} icon={Eye} />
                            <KpiStat title="Cliques totais" value={formatNumber(totalClicks)} icon={MousePointer} />
                            <KpiStat title="Valor investido" value={formatSpend(totalSpend)} icon={DollarSign} />
                            <KpiStat
                              title="CPC médio"
                              value={totalClicks > 0 ? formatSpend(cpc) : "—"}
                              icon={Target}
                            />
                          </div>
                        </div>
                        <div>
                          <SectionLabel>Captação e resultados</SectionLabel>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <KpiStat
                              title="Leads (Meta)"
                              value={formatNumber(metaLeads)}
                              hint="WhatsApp, Messenger e formulários"
                              icon={UserPlus}
                            />
                            <KpiStat
                              title="Vendas (Meta)"
                              value={formatNumber(metaPurchases)}
                              hint="Compras rastreadas (pixel)"
                              icon={ShoppingBag}
                            />
                            <KpiStat
                              title="Conversões (Google)"
                              value={formatNumber(googleConversions)}
                              hint="Ações de conversão na conta"
                              icon={Target}
                            />
                            <KpiStat
                              title="Resultados totais"
                              value={formatNumber(totalResults)}
                              hint="Soma Google + Meta (referência)"
                              icon={TrendingUp}
                            />
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <KpiStat
                              title="CPA por resultado"
                              value={totalResults > 0 ? formatSpend(cpaResults) : "—"}
                              hint="Investimento ÷ resultados totais"
                              icon={DollarSign}
                            />
                            <KpiStat
                              title="Valor atribuído"
                              value={
                                totalResultValue > 0 ? formatSpend(totalResultValue) : "—"
                              }
                              hint="Valor conversões Google + compras Meta"
                              icon={TrendingUp}
                            />
                          </div>
                        </div>
                      </div>
                      {hasGoogle && hasMeta && donutData.length > 0 && (
                        <div className="flex flex-col xl:col-span-4">
                          <SectionLabel>Distribuição do gasto</SectionLabel>
                          <div className="flex flex-1 flex-col rounded-lg border border-border/80 bg-muted/20 p-4">
                            <p className="mb-2 text-xs text-muted-foreground">Por plataforma</p>
                            <div className="min-h-[240px] flex-1">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={donutData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={52}
                                    outerRadius={78}
                                    paddingAngle={2}
                                    dataKey="value"
                                    nameKey="name"
                                  >
                                    {donutData.map((entry, i) => (
                                      <Cell key={i} fill={entry.fill} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(v: number) => [formatSpend(v), "Gasto"]} />
                                  <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    wrapperStyle={{ fontSize: 12 }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </DashboardPanel>
          )}

          {/* Desempenho por plataformas (abas) */}
          <DashboardPanel className="overflow-hidden">
            <div className="border-b border-border/60 bg-muted/30 px-5 py-4">
              <h2 className="text-base font-semibold tracking-tight">Desempenho por plataformas</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Detalhe por rede — campanhas e tabelas
              </p>
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

              {/* Google Ads */}
              {hasGoogle && (
                <TabsContent value="google-ads" className="mt-4">
                  {metricsLoading && !metrics ? (
                <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-border/80 bg-card">
                  <p className="text-muted-foreground">Carregando métricas do Google Ads...</p>
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
                <div className="space-y-5 pt-2">
                  <SectionLabel>Resumo da conta</SectionLabel>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiStat title="Impressões" value={formatNumber(metrics.summary.impressions)} icon={Eye} />
                    <KpiStat title="Cliques" value={formatNumber(metrics.summary.clicks)} icon={MousePointer} />
                    <KpiStat title="Custo" value={formatCost(metrics.summary.costMicros)} icon={DollarSign} />
                    <KpiStat title="Conversões" value={formatNumber(metrics.summary.conversions)} icon={Target} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <KpiStat
                      title="Valor das conversões"
                      value={formatSpend(metrics.summary.conversionsValue ?? 0)}
                      hint="Atribuído no Google Ads"
                      icon={TrendingUp}
                    />
                    <KpiStat
                      title="CPA"
                      value={
                        metrics.summary.conversions > 0
                          ? formatCost(metrics.summary.costMicros / metrics.summary.conversions)
                          : "—"
                      }
                      hint="Custo por conversão"
                      icon={DollarSign}
                    />
                  </div>
                  <SectionLabel>Campanhas</SectionLabel>
                  {metrics.campaigns.length > 0 && (
                    <Card className="rounded-xl">
                      <CardHeader>
                        <CardTitle>Por campanha (Google Ads)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
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
                              {metrics.campaigns.map((row, i) => (
                                <tr key={i} className="border-b border-border/50 last:border-0">
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
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : null}
                </TabsContent>
              )}

              {/* Meta Ads */}
              {hasMeta && (
                <TabsContent value="meta-ads" className="mt-4">
              {metaMetricsLoading && !metaMetrics ? (
                <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-border/80 bg-card">
                  <p className="text-muted-foreground">Carregando métricas do Meta Ads...</p>
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
                <div className="space-y-5 pt-2">
                  <div>
                    <SectionLabel>Resumo da conta</SectionLabel>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <KpiStat
                        title="Impressões"
                        value={formatNumber(metaMetrics.summary.impressions)}
                        icon={Eye}
                      />
                      <KpiStat title="Cliques" value={formatNumber(metaMetrics.summary.clicks)} icon={MousePointer} />
                      <KpiStat title="Gasto" value={formatSpend(metaMetrics.summary.spend)} icon={DollarSign} />
                    </div>
                  </div>
                  <div>
                    <SectionLabel>Leads e vendas</SectionLabel>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <KpiStat
                        title="Leads"
                        value={formatNumber(metaMetrics.summary.leads ?? 0)}
                        hint="WhatsApp, Messenger e formulários"
                        icon={UserPlus}
                      />
                      <KpiStat
                        title="Vendas"
                        value={formatNumber(metaMetrics.summary.purchases ?? 0)}
                        hint="Compras rastreadas (pixel)"
                        icon={ShoppingBag}
                      />
                      <KpiStat
                        title="Valor vendas"
                        value={
                          metaMetrics.summary.purchaseValue != null && metaMetrics.summary.purchaseValue > 0
                            ? formatSpend(metaMetrics.summary.purchaseValue)
                            : "—"
                        }
                        hint="Atribuído no Meta"
                        icon={TrendingUp}
                      />
                    </div>
                  </div>

                  {/* Funil Impressões → Cliques */}
                  {metaMetrics.summary.impressions > 0 && (
                    <Card className="rounded-xl">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Filter className="h-4 w-4" />
                          Funil · Impressões → Cliques
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">
                          Taxa de cliques:{" "}
                          {metaMetrics.summary.impressions > 0
                            ? ((metaMetrics.summary.clicks / metaMetrics.summary.impressions) * 100).toFixed(2)
                            : "0"}%
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                              <span>Impressões</span>
                              <span>{formatNumber(metaMetrics.summary.impressions)}</span>
                            </div>
                            <div className="h-8 w-full overflow-hidden rounded-lg bg-muted">
                              <div
                                className="h-full rounded-lg bg-primary/80"
                                style={{ width: "100%" }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                              <span>Cliques</span>
                              <span>{formatNumber(metaMetrics.summary.clicks)}</span>
                            </div>
                            <div className="h-8 w-full overflow-hidden rounded-lg bg-muted">
                              <div
                                className="h-full rounded-lg bg-primary"
                                style={{
                                  width: `${metaMetrics.summary.impressions > 0 ? (metaMetrics.summary.clicks / metaMetrics.summary.impressions) * 100 : 0}%`,
                                  minWidth: metaMetrics.summary.clicks > 0 ? "4px" : "0",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Gráfico Gasto por campanha */}
                  {metaMetrics.campaigns.length > 0 && (
                    <Card className="rounded-xl">
                      <CardHeader>
                        <CardTitle className="text-base">Gasto por campanha</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[280px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={metaMetrics.campaigns
                                .map((c) => ({
                                  name: c.campaignName.length > 28 ? c.campaignName.slice(0, 26) + "…" : c.campaignName,
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

                  {/* Tabela por campanha com CTR e CPC */}
                  {metaMetrics.campaigns.length > 0 && (
                    <AnalyticTable
                      title="Por campanha (Meta Ads)"
                      columns={metaAdsCampaignColumns}
                      data={metaMetrics.campaigns}
                    />
                  )}
                </div>
              ) : null}
                </TabsContent>
              )}
            </Tabs>
            </div>
          </DashboardPanel>

          {hasGoogle && !metrics?.ok && !metricsError && !metricsLoading && hasMeta && !metaMetrics?.ok && !metaMetricsError && !metaMetricsLoading && (
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
