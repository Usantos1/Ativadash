import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardPanel, KpiStat, SectionLabel } from "@/components/dashboard/DashboardPrimitives";
import { PerformanceAlerts } from "@/components/marketing/PerformanceAlerts";
import { formatCost, formatNumber, formatSpend } from "@/lib/metrics-format";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

const periods = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
] as const;

export type FunnelVariant = "captacao" | "conversao" | "receita";

const copy: Record<
  FunnelVariant,
  { title: string; subtitle: string; emptyHint: string }
> = {
  captacao: {
    title: "Captação",
    subtitle: "Alcance, cliques e eficiência de mídia (Meta + Google)",
    emptyHint: "Conecte as integrações para ver impressões, cliques e CPC.",
  },
  conversao: {
    title: "Conversão",
    subtitle: "Leads, vendas e custo por resultado consolidados",
    emptyHint: "Com integrações ativas, mostramos conversões, CPA e funil de cliques.",
  },
  receita: {
    title: "Receita",
    subtitle: "Valor atribuído e ROAS no período",
    emptyHint: "Valor de conversões Google e compras Meta aparecem aqui após a conexão.",
  },
};

export function MarketingFunnelPage({ variant }: { variant: FunnelVariant }) {
  const navigate = useNavigate();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const c = copy[variant];
  const {
    period,
    setPeriod,
    hasGoogle,
    hasMeta,
    metrics,
    metaMetrics,
    metricsLoading,
    metaMetricsLoading,
    refreshAll,
    lastUpdated,
    insightData,
    insightLoading,
  } = useMarketingMetrics();

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
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const metaLeads = metaOk ? (metaMetrics.summary.leads ?? 0) : 0;
  const metaPurchases = metaOk ? (metaMetrics.summary.purchases ?? 0) : 0;
  const googleConversions = googleOk ? metrics.summary.conversions : 0;
  const totalResults = googleConversions + metaLeads + metaPurchases;
  const cpaResults = totalResults > 0 ? totalSpend / totalResults : 0;
  const googleConvValue = googleOk ? (metrics.summary.conversionsValue ?? 0) : 0;
  const metaPurchaseVal = metaOk ? (metaMetrics.summary.purchaseValue ?? 0) : 0;
  const totalAttributed = googleConvValue + metaPurchaseVal;
  const roas = totalSpend > 0 && totalAttributed > 0 ? totalAttributed / totalSpend : null;

  const hasData = googleOk || metaOk;
  const loadingBlock =
    (hasGoogle && metricsLoading && !metrics) || (hasMeta && metaMetricsLoading && !metaMetrics);

  return (
    <div
      className={cn(
        "w-full space-y-6",
        sidebarCollapsed ? "max-w-none" : "mx-auto max-w-[1600px]"
      )}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
          <p className="text-sm text-muted-foreground">{c.subtitle}</p>
        </div>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Atualizado{" "}
            <span className="font-medium text-foreground">
              {lastUpdated.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </span>
          </p>
        )}
      </div>

      <DashboardPanel className="px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as "7d" | "30d" | "90d")}>
              <SelectTrigger className="h-9 min-w-0 w-full max-w-[170px] rounded-md border-border/80 bg-background text-sm sm:w-[170px]">
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
            {hasGoogle || hasMeta ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-md border-border/80"
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
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Conecte integrações
              </span>
            )}
            <Button size="sm" variant="secondary" className="h-9 rounded-md" disabled>
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
              Compartilhar
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-md" asChild>
              <Link to="/marketing/configuracoes">Metas e alertas</Link>
            </Button>
          </div>
        </div>
      </DashboardPanel>

      <PerformanceAlerts alerts={insightData?.alerts} loading={insightLoading} />

      {!hasGoogle && !hasMeta ? (
        <EmptyState
          icon={BarChart3}
          title="Sem integrações"
          description={c.emptyHint}
          actionLabel="Integrações"
          onAction={() => navigate("/marketing/integracoes")}
          className="min-h-[280px]"
        />
      ) : loadingBlock ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-border/80 bg-card">
          <p className="text-muted-foreground">Carregando…</p>
        </div>
      ) : !hasData ? (
        <p className="rounded-xl border border-border/80 bg-card p-6 text-sm text-muted-foreground">
          Sem dados no período. Ajuste o intervalo ou abra a visão completa em{" "}
          <Link to="/marketing" className="font-medium text-primary underline-offset-4 hover:underline">
            Marketing
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-6">
          {variant === "captacao" && (
            <DashboardPanel className="overflow-hidden p-5">
              <SectionLabel>Tráfego pago</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <KpiStat title="Impressões" value={formatNumber(totalImpressions)} icon={Eye} />
                <KpiStat title="Cliques" value={formatNumber(totalClicks)} icon={MousePointer} />
                <KpiStat title="CTR médio" value={totalImpressions > 0 ? `${ctr.toFixed(2)}%` : "—"} icon={Target} />
                <KpiStat title="CPC médio" value={totalClicks > 0 ? formatSpend(cpc) : "—"} icon={MousePointer} />
                <KpiStat title="Investimento" value={formatSpend(totalSpend)} icon={DollarSign} />
              </div>
            </DashboardPanel>
          )}

          {variant === "conversao" && (
            <DashboardPanel className="overflow-hidden p-5">
              <SectionLabel>Resultados e custo</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiStat title="Conversões (Google)" value={formatNumber(googleConversions)} icon={Target} />
                <KpiStat title="Leads (Meta)" value={formatNumber(metaLeads)} icon={UserPlus} />
                <KpiStat title="Vendas (Meta)" value={formatNumber(metaPurchases)} icon={ShoppingBag} />
                <KpiStat title="Resultados totais" value={formatNumber(totalResults)} icon={TrendingUp} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <KpiStat
                  title="CPA consolidado"
                  value={totalResults > 0 ? formatSpend(cpaResults) : "—"}
                  hint="Investimento ÷ resultados"
                  icon={DollarSign}
                />
                <KpiStat title="Investimento" value={formatSpend(totalSpend)} icon={DollarSign} />
              </div>
            </DashboardPanel>
          )}

          {variant === "receita" && (
            <DashboardPanel className="overflow-hidden p-5">
              <SectionLabel>Receita atribuída</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <KpiStat
                  title="Valor atribuído"
                  value={totalAttributed > 0 ? formatSpend(totalAttributed) : "—"}
                  hint="Google + Meta"
                  icon={TrendingUp}
                />
                <KpiStat title="Investimento" value={formatSpend(totalSpend)} icon={DollarSign} />
                <KpiStat
                  title="ROAS"
                  value={roas != null ? `${roas.toFixed(2)}x` : "—"}
                  hint="Valor atribuído ÷ investimento"
                  icon={BarChart3}
                />
              </div>
              {googleOk && metrics.summary.conversions > 0 && (
                <p className="mt-4 text-xs text-muted-foreground">
                  CPA Google (só conversões da rede):{" "}
                  <span className="font-medium text-foreground">
                    {formatCost(metrics.summary.costMicros / metrics.summary.conversions)}
                  </span>
                </p>
              )}
            </DashboardPanel>
          )}

          <DashboardPanel className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Comparativos, gráficos e tabelas por campanha estão na visão geral de Marketing.
            </p>
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
