import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
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
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardPanel, KpiStat, SectionLabel } from "@/components/dashboard/DashboardPrimitives";
import { formatCost, formatNumber, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import { PerformanceAlerts } from "@/components/marketing/PerformanceAlerts";

const periods = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
] as const;

function greetingName(email: string | undefined): string {
  if (!email) return "Bem-vindo";
  const local = email.split("@")[0]?.trim();
  if (!local) return "Bem-vindo";
  const first = local.split(/[._-]/)[0];
  if (!first) return "Bem-vindo";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
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

  const hasAnyChannel = hasGoogle || hasMeta;
  const dataLoading = (hasGoogle && metricsLoading && !metrics) || (hasMeta && metaMetricsLoading && !metaMetrics);
  const googleOk = metrics?.ok;
  const metaOk = metaMetrics?.ok;

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LayoutDashboard className="h-4 w-4" />
            <span>Início</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Olá, {greetingName(user?.email)}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Resumo da operação e dos canais conectados. Ajuste o período e abra o Marketing para o detalhe
            completo.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {lastUpdated && (
            <p className="text-xs text-muted-foreground sm:order-2 sm:text-right">
              Atualizado{" "}
              <span className="font-medium text-foreground">
                {lastUpdated.toLocaleDateString("pt-BR")}{" "}
                {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as "7d" | "30d" | "90d")}>
              <SelectTrigger className="h-9 min-w-0 w-full max-w-[170px] rounded-lg border-border/80 bg-background text-sm sm:w-[170px]">
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
            {hasAnyChannel && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg border-border/80"
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
            )}
          </div>
        </div>
      </div>

      <DashboardPanel className="px-4 py-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Integrações
        </p>
        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
              hasGoogle
                ? "border-success/30 bg-success/10 text-success"
                : "border-border bg-muted/40 text-muted-foreground"
            )}
          >
            {hasGoogle ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            Google Ads
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
              hasMeta
                ? "border-success/30 bg-success/10 text-success"
                : "border-border bg-muted/40 text-muted-foreground"
            )}
          >
            {hasMeta ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            Meta Ads
          </span>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs" asChild>
            <Link to="/marketing/integracoes" className="gap-1">
              <Plug className="h-3.5 w-3.5" />
              Gerenciar
            </Link>
          </Button>
        </div>
      </DashboardPanel>

      <PerformanceAlerts alerts={insightData?.alerts} loading={insightLoading} />

      {!hasAnyChannel ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <EmptyState
              icon={BarChart3}
              title="Comece pelas integrações"
              description="Conecte Google Ads ou Meta para ver investimento, tráfego e resultados neste painel. Tudo que você configurar aqui alimenta o Marketing."
              actionLabel="Abrir integrações"
              onAction={() => navigate("/marketing/integracoes")}
              className="min-h-[280px] border-border/80 bg-card"
            />
          </div>
          <div className="space-y-3">
            <DashboardPanel className="overflow-hidden">
              <div className="border-b border-border/60 bg-muted/25 px-4 py-3">
                <h2 className="text-sm font-semibold">Atalhos</h2>
              </div>
              <ul className="divide-y divide-border/60 p-2">
                <li>
                  <Link
                    to="/marketing"
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Marketing
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/marketing/integracoes"
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Plug className="h-4 w-4 text-primary" />
                      Integrações
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              </ul>
            </DashboardPanel>
          </div>
        </div>
      ) : dataLoading ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-border/80 bg-card">
          <p className="text-sm text-muted-foreground">Carregando resumo…</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(googleOk || metaOk) && (
            <DashboardPanel className="overflow-hidden">
              <div className="border-b border-border/60 bg-muted/30 px-5 py-4">
                <h2 className="text-base font-semibold tracking-tight">Resumo do período</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Indicadores consolidados · mesmo recorte usado em Marketing
                </p>
              </div>
              <div className="p-5">
                <div className="grid gap-8 xl:grid-cols-12">
                  <div className="space-y-6 xl:col-span-8">
                    <div>
                      <SectionLabel>Tráfego e investimento</SectionLabel>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <KpiStat title="Impressões" value={formatNumber(totalImpressions)} icon={Eye} />
                        <KpiStat title="Cliques" value={formatNumber(totalClicks)} icon={MousePointer} />
                        <KpiStat title="Investimento" value={formatSpend(totalSpend)} icon={DollarSign} />
                        <KpiStat
                          title="CPC médio"
                          value={totalClicks > 0 ? formatSpend(cpc) : "—"}
                          icon={Target}
                        />
                      </div>
                    </div>
                    <div>
                      <SectionLabel>Resultados</SectionLabel>
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
                          icon={ShoppingBag}
                        />
                        <KpiStat
                          title="Conversões (Google)"
                          value={formatNumber(googleConversions)}
                          icon={Target}
                        />
                        <KpiStat title="Resultados totais" value={formatNumber(totalResults)} icon={TrendingUp} />
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <KpiStat
                          title="CPA por resultado"
                          value={totalResults > 0 ? formatSpend(cpaResults) : "—"}
                          icon={DollarSign}
                        />
                        <KpiStat
                          title="Valor atribuído"
                          value={totalResultValue > 0 ? formatSpend(totalResultValue) : "—"}
                          hint="Google + Meta"
                          icon={TrendingUp}
                        />
                      </div>
                    </div>
                  </div>
                  {hasGoogle && hasMeta && donutData.length > 0 && (
                    <div className="flex flex-col xl:col-span-4">
                      <SectionLabel>Gasto por plataforma</SectionLabel>
                      <div className="flex flex-1 flex-col rounded-lg border border-border/80 bg-muted/20 p-4">
                        <div className="min-h-[220px] flex-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={donutData}
                                cx="50%"
                                cy="50%"
                                innerRadius={48}
                                outerRadius={72}
                                paddingAngle={2}
                                dataKey="value"
                                nameKey="name"
                              >
                                {donutData.map((entry, i) => (
                                  <Cell key={i} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: number) => [formatSpend(v), "Gasto"]} />
                              <Legend verticalAlign="bottom" height={32} wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </DashboardPanel>
          )}

          {(metricsError && hasGoogle) || (metaMetricsError && hasMeta) ? (
            <div className="rounded-xl border border-border/80 bg-card p-4 text-sm text-muted-foreground">
              {metricsError && hasGoogle && <p>Google Ads: {metricsError}</p>}
              {metaMetricsError && hasMeta && <p className={metricsError && hasGoogle ? "mt-2" : ""}>Meta: {metaMetricsError}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
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
            <p className="rounded-xl border border-border/80 bg-card p-6 text-sm text-muted-foreground">
              Nenhum dado no período selecionado. Tente outro intervalo ou confira as contas nas integrações.
            </p>
          )}

          {(topGoogle.length > 0 || topMeta.length > 0) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {topGoogle.length > 0 && (
                <DashboardPanel className="overflow-hidden">
                  <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                    <h3 className="text-sm font-semibold">Top campanhas · Google Ads</h3>
                    <p className="text-xs text-muted-foreground">Por custo no período</p>
                  </div>
                  <ul className="divide-y divide-border/50 p-2">
                    {topGoogle.map((row, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                        <span className="min-w-0 truncate font-medium">{row.campaignName || "—"}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{formatCost(row.costMicros)}</span>
                      </li>
                    ))}
                  </ul>
                </DashboardPanel>
              )}
              {topMeta.length > 0 && (
                <DashboardPanel className="overflow-hidden">
                  <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
                    <h3 className="text-sm font-semibold">Top campanhas · Meta Ads</h3>
                    <p className="text-xs text-muted-foreground">Por gasto no período</p>
                  </div>
                  <ul className="divide-y divide-border/50 p-2">
                    {topMeta.map((row, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                        <span className="min-w-0 truncate font-medium">{row.campaignName || "—"}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{formatSpend(row.spend)}</span>
                      </li>
                    ))}
                  </ul>
                </DashboardPanel>
              )}
            </div>
          )}

          <DashboardPanel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Análise detalhada</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Gráficos, abas por rede e tabelas completas estão em Marketing.
              </p>
            </div>
            <Button className="rounded-lg shrink-0" asChild>
              <Link to="/marketing" className="gap-2">
                Abrir Marketing
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </DashboardPanel>
        </div>
      )}
    </div>
  );
}
