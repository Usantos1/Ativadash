import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  fetchIntegrations,
  fetchGoogleAdsMetrics,
  fetchMetaAdsMetrics,
  type GoogleAdsMetricsResponse,
  type MetaAdsMetricsResponse,
  type MetaAdsCampaignRow,
} from "@/lib/integrations-api";

const periods = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
] as const;

function formatCost(micros: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(micros / 1_000_000);
}

function formatSpend(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

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
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [hasIntegrations, setHasIntegrations] = useState(false);
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
          setHasIntegrations(list.some((i) => i.status === "connected"));
          setHasMeta(list.some((i) => i.slug === "meta" && i.status === "connected"));
        }
      })
      .catch(() => {
        if (!cancelled) setHasIntegrations(false);
      });
    return () => { cancelled = true; };
  }, []);

  const loadMetrics = useCallback(async () => {
    if (!hasIntegrations) return;
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const data = await fetchGoogleAdsMetrics(period);
      if (!data) {
        setMetrics(null);
        setMetricsError("Não foi possível carregar os dados. Verifique se o Developer Token do Google Ads está configurado no servidor.");
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
  }, [hasIntegrations, period]);

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
    if (hasIntegrations) loadMetrics();
    else setMetrics(null);
  }, [hasIntegrations, period, loadMetrics]);

  useEffect(() => {
    if (hasMeta) loadMetaMetrics();
    else setMetaMetrics(null);
  }, [hasMeta, period, loadMetaMetrics]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
        <p className="text-muted-foreground">
          Análise de resultado · Captação, conversão e receita
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select value="none" disabled>
            <SelectTrigger className="w-[220px] rounded-lg">
              <SelectValue placeholder="Lançamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum lançamento</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as "7d" | "30d" | "90d")}>
            <SelectTrigger className="w-[160px] rounded-lg">
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Última atualização: {lastUpdated.toLocaleDateString("pt-BR")} às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {hasIntegrations || hasMeta ? (
            <>
              {hasIntegrations && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Google Ads
                </span>
              )}
              {hasMeta && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Meta Ads
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={metricsLoading || metaMetricsLoading}
                onClick={() => {
                  loadMetrics();
                  loadMetaMetrics();
                }}
              >
                <RefreshCw className={`h-4 w-4 ${(metricsLoading || metaMetricsLoading) ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Conecte uma integração para ver dados
            </span>
          )}
          <Button size="sm" className="rounded-lg bg-primary" disabled>
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>
        </div>
      </div>

      {!hasIntegrations && !hasMeta ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhum dado de marketing ainda"
          description="Conecte o Google Ads ou Meta Ads nas Integrações para começar a ver métricas aqui."
          actionLabel="Ir para Integrações"
          onAction={() => navigate("/marketing/integracoes")}
          className="min-h-[320px]"
        />
      ) : (
        <div className="space-y-8">
          {/* Desempenho geral da captação */}
          {(metrics?.ok || metaMetrics?.ok) && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Desempenho geral da captação</h2>
              {(() => {
                const totalImpressions = (metrics?.ok ? metrics.summary.impressions : 0) + (metaMetrics?.ok ? metaMetrics.summary.impressions : 0);
                const totalClicks = (metrics?.ok ? metrics.summary.clicks : 0) + (metaMetrics?.ok ? metaMetrics.summary.clicks : 0);
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
                return (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Card className="rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Impressões totais</CardTitle>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-semibold">{formatNumber(totalImpressions)}</span>
                        </CardContent>
                      </Card>
                      <Card className="rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Cliques totais</CardTitle>
                          <MousePointer className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-semibold">{formatNumber(totalClicks)}</span>
                        </CardContent>
                      </Card>
                      <Card className="rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Valor investido</CardTitle>
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-semibold">{formatSpend(totalSpend)}</span>
                        </CardContent>
                      </Card>
                      <Card className="rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">CPC médio</CardTitle>
                          <Target className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-semibold">{totalClicks > 0 ? formatSpend(cpc) : "—"}</span>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Card className="rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Leads (Meta)</CardTitle>
                          <UserPlus className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-semibold">{formatNumber(metaLeads)}</span>
                          <p className="mt-1 text-xs text-muted-foreground">Formulários e lead ads</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Vendas (Meta)</CardTitle>
                          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-semibold">{formatNumber(metaPurchases)}</span>
                          <p className="mt-1 text-xs text-muted-foreground">Compras rastreadas (pixel)</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Conversões (Google)</CardTitle>
                          <Target className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-semibold">{formatNumber(googleConversions)}</span>
                          <p className="mt-1 text-xs text-muted-foreground">Resultados configurados na conta</p>
                        </CardContent>
                      </Card>
                      <Card className="rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Resultados combinados</CardTitle>
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-semibold">{formatNumber(totalResults)}</span>
                          <p className="mt-1 text-xs text-muted-foreground">Google conv. + Meta leads + vendas</p>
                        </CardContent>
                      </Card>
                    </div>
                    {(totalResultValue > 0 || googleConvValue > 0 || metaPurchaseVal > 0) && (
                      <Card className="rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Valor atribuído (vendas / conversões)</CardTitle>
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <span className="text-2xl font-semibold">{formatSpend(totalResultValue)}</span>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Google (valor de conversões) + Meta (valor de compras no pixel)
                          </p>
                        </CardContent>
                      </Card>
                    )}
                    {hasIntegrations && hasMeta && (googleSpend > 0 || metaSpend > 0) && (
                      <Card className="rounded-xl">
                        <CardHeader>
                          <CardTitle className="text-base">Gasto por plataforma</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[220px] w-full max-w-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: "Meta Ads", value: metaSpend, fill: "hsl(var(--primary))" },
                                    { name: "Google Ads", value: googleSpend, fill: "hsl(217 91% 60%)" },
                                  ].filter((d) => d.value > 0)}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={75}
                                  paddingAngle={2}
                                  dataKey="value"
                                  nameKey="name"
                                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                  {[
                                    { name: "Meta Ads", value: metaSpend, fill: "hsl(var(--primary))" },
                                    { name: "Google Ads", value: googleSpend, fill: "hsl(217 91% 60%)" },
                                  ]
                                    .filter((d) => d.value > 0)
                                    .map((entry, i) => (
                                      <Cell key={i} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v: number) => [formatSpend(v), "Gasto"]} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Desempenho por plataformas (abas) */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Desempenho por plataformas</h2>
            <Tabs defaultValue={hasMeta ? "meta-ads" : "google-ads"} className="w-full">
              <TabsList className="rounded-lg">
                {hasMeta && <TabsTrigger value="meta-ads">Meta Ads</TabsTrigger>}
                {hasIntegrations && <TabsTrigger value="google-ads">Google Ads</TabsTrigger>}
              </TabsList>

              {/* Google Ads */}
              {hasIntegrations && (
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
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Google Ads</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="rounded-xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Impressões</CardTitle>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <span className="text-2xl font-semibold">{formatNumber(metrics.summary.impressions)}</span>
                      </CardContent>
                    </Card>
                    <Card className="rounded-xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Cliques</CardTitle>
                        <MousePointer className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <span className="text-2xl font-semibold">{formatNumber(metrics.summary.clicks)}</span>
                      </CardContent>
                    </Card>
                    <Card className="rounded-xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Custo</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <span className="text-2xl font-semibold">{formatCost(metrics.summary.costMicros)}</span>
                      </CardContent>
                    </Card>
                    <Card className="rounded-xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Conversões</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <span className="text-2xl font-semibold">{formatNumber(metrics.summary.conversions)}</span>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Card className="rounded-xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Valor das conversões</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <span className="text-2xl font-semibold">
                          {formatSpend(metrics.summary.conversionsValue ?? 0)}
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">Atribuído no Google Ads</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">CPA (custo / conversão)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <span className="text-2xl font-semibold">
                          {metrics.summary.conversions > 0
                            ? formatCost(metrics.summary.costMicros / metrics.summary.conversions)
                            : "—"}
                        </span>
                      </CardContent>
                    </Card>
                  </div>
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
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold">Meta Ads</h2>

                  {/* KPIs */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Card className="rounded-xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Impressões</CardTitle>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <span className="text-2xl font-semibold">{formatNumber(metaMetrics.summary.impressions)}</span>
                      </CardContent>
                    </Card>
                    <Card className="rounded-xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Cliques</CardTitle>
                        <MousePointer className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <span className="text-2xl font-semibold">{formatNumber(metaMetrics.summary.clicks)}</span>
                      </CardContent>
                    </Card>
                    <Card className="rounded-xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Gasto</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <span className="text-2xl font-semibold">{formatSpend(metaMetrics.summary.spend)}</span>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Card className="rounded-xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Leads</CardTitle>
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <span className="text-2xl font-semibold">
                          {formatNumber(metaMetrics.summary.leads ?? 0)}
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">Lead ads, formulários</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Vendas</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <span className="text-2xl font-semibold">
                          {formatNumber(metaMetrics.summary.purchases ?? 0)}
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">Eventos de compra (pixel)</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Valor vendas</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <span className="text-2xl font-semibold">
                          {metaMetrics.summary.purchaseValue != null && metaMetrics.summary.purchaseValue > 0
                            ? formatSpend(metaMetrics.summary.purchaseValue)
                            : "—"}
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">Atribuído no Meta</p>
                      </CardContent>
                    </Card>
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

          {hasIntegrations && !metrics?.ok && !metricsError && !metricsLoading && hasMeta && !metaMetrics?.ok && !metaMetricsError && !metaMetricsLoading && (
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
