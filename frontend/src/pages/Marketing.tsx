import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, RefreshCw, Share2, Clock, Eye, MousePointer, DollarSign, Target, Filter } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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
          {/* Google Ads */}
          {hasIntegrations && (
            <>
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
            </>
          )}

          {/* Meta Ads */}
          {hasMeta && (
            <>
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
            </>
          )}

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
