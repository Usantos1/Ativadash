import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  BarChart3,
  CalendarRange,
  DollarSign,
  Eye,
  Layers,
  LayoutDashboard,
  LineChart,
  Megaphone,
  MessageCircle,
  MousePointer,
  Plug,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Zap,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
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
  DataTablePremium,
} from "@/components/premium";
import {
  fetchMarketingDashboard,
  type MarketingDashboardPayload,
  type MarketingDashboardPerfRow,
  type MarketingDashboardSummary,
} from "@/lib/marketing-dashboard-api";
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

/** Cliques no link: distingue “não retornado” de zero real. */
function formatLinkClicks(s: MarketingDashboardSummary): { text: string; hint?: string } {
  if (!s.linkClicksReturned) {
    return {
      text: "Indisponível",
      hint: "A Meta não retornou o campo inline_link_clicks nos insights deste período.",
    };
  }
  return { text: formatNumber(s.linkClicks ?? 0) };
}

function formatReach(s: MarketingDashboardSummary): { text: string; hint?: string } {
  if (s.reach == null || s.reach <= 0) {
    if (s.reachNote === "unavailable") {
      return { text: "Indisponível", hint: "Alcance não retornado pela API para este período." };
    }
    return { text: formatNumber(0), hint: "Nenhum alcance reportado." };
  }
  return {
    text: formatNumber(s.reach),
    hint:
      s.reachNote === "sum_daily_per_account"
        ? "Soma dos alcances diários por conta (aproximação)."
        : "Agregado ao nível de conta no período (soma entre contas de anúncio).",
  };
}

function formatFrequency(s: MarketingDashboardSummary): { text: string; hint?: string } {
  if (s.frequency == null || s.frequency <= 0) {
    return {
      text: "Indisponível",
      hint:
        s.frequencySource == null
          ? "Calcule a partir de alcance e impressões ou verifique se a Meta devolveu frequência."
          : undefined,
    };
  }
  return {
    text: s.frequency.toFixed(2).replace(".", ","),
    hint:
      s.frequencySource === "api"
        ? "Frequência reportada pela Meta."
        : "Calculada como impressões ÷ alcance (quando o alcance está disponível).",
  };
}

function formatNullableRatio(n: number | null, asPercent: boolean): { text: string; hint?: string } {
  if (n == null || !Number.isFinite(n)) {
    return { text: "Indisponível", hint: "Divisão inválida ou dados insuficientes (ex.: zero impressões ou zero cliques)." };
  }
  if (asPercent) return { text: formatPercent(n), hint: undefined };
  return { text: `${n.toFixed(2).replace(".", ",")}×`, hint: undefined };
}

type MetaLevel = "campaign" | "adset" | "ad";

export function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  const [dash, setDash] = useState<MarketingDashboardPayload | undefined>(undefined);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashUpdatedAt, setDashUpdatedAt] = useState<Date | null>(null);

  const dashboardMetaSummary = useMemo(() => {
    if (dash?.ok === true) return dash.summary;
    return undefined;
  }, [dash]);

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
    cmpMetaMetrics,
    cmpLoading,
    metricsLoading,
    metaMetricsLoading,
    metricsError,
    refreshAll,
    insightData,
    insightLoading,
  } = useMarketingMetrics({ dashboardMetaSummary });

  const loadDashboard = useCallback(async () => {
    if (!hasMeta) {
      setDash(undefined);
      return;
    }
    setDashLoading(true);
    try {
      const res = await fetchMarketingDashboard(dateRange);
      setDash(res);
      setDashUpdatedAt(new Date());
    } catch {
      setDash({ ok: false, message: "Erro inesperado ao carregar o painel agregado." });
    } finally {
      setDashLoading(false);
    }
  }, [hasMeta, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const googleOk = metrics?.ok === true;
  const metaOk = dash?.ok === true;
  const summary = metaOk ? dash.summary : null;

  const metaSpend = summary?.spend ?? 0;
  const cmpMetaSpend = cmpMetaMetrics?.ok ? cmpMetaMetrics.summary.spend : 0;

  const hasAnyChannel = hasGoogle || hasMeta;
  const dataLoading =
    (hasGoogle && metricsLoading) || (hasMeta && (dashLoading || dash === undefined));
  const metaHealthy = hasMeta && metaOk;

  const [metaLevel, setMetaLevel] = useState<MetaLevel>("campaign");
  const [chartExtra, setChartExtra] = useState<"none" | "ctr">("none");

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

  const metaResultsTotal = summary
    ? summary.leads + summary.messagingConversations + summary.purchases
    : 0;
  const metaCostPerResult =
    summary && metaSpend > 0 && metaResultsTotal > 0 ? metaSpend / metaResultsTotal : null;

  const derived = summary?.derived;

  const refresh = useCallback(async () => {
    await refreshAll();
    await loadDashboard();
  }, [refreshAll, loadDashboard]);

  const displayUpdatedAt = dashUpdatedAt ?? null;

  const googleStatusLabel =
    metaOk && dash.integrationStatus.googleAds.status === "pending_approval"
      ? "Em ativação"
      : googleOk
        ? "Ativo"
        : hasGoogle
          ? "Em ativação"
          : "Não conectado";

  return (
    <div
      className={cn(
        "w-full space-y-6 pb-24 lg:pb-6",
        sidebarCollapsed ? "max-w-none" : "mx-auto max-w-[1680px]"
      )}
    >
      <PageHeaderPremium
        eyebrow="Visão geral"
        title="Painel executivo"
        subtitle={`Olá, ${greetingName(user?.email)} — dados agregados no servidor (Meta Ads). Resumo e série diária usam a mesma base para bater investimento e volumes.`}
        meta={
          <>
            {displayUpdatedAt ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <LayoutDashboard className="h-3.5 w-3.5 opacity-70" aria-hidden />
                Atualizado{" "}
                <span className="font-medium text-foreground">
                  {displayUpdatedAt.toLocaleDateString("pt-BR")}{" "}
                  {displayUpdatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
            ) : null}
            <span className="text-muted-foreground">
              Fonte principal: <span className="font-semibold text-foreground">Meta Ads</span>
            </span>
            {compareEnabled ? (
              <span className="rounded-md border border-primary/20 bg-primary/[0.08] px-2 py-0.5 text-[11px] font-semibold text-primary">
                Comparação ativa
              </span>
            ) : null}
            <StatusBadge tone={metaHealthy && !dataLoading ? "healthy" : hasMeta ? "alert" : "disconnected"} dot>
              {dataLoading ? "Carregando" : metaHealthy ? "Meta OK" : hasMeta ? "Meta indisponível" : "Sem Meta"}
            </StatusBadge>
            <Link to="/marketing" className="font-semibold text-primary underline-offset-4 hover:underline">
              Marketing completo
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
            {hasMeta ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg border-border/70 shadow-sm"
                disabled={dashLoading || metaMetricsLoading}
                onClick={() => void refresh()}
              >
                <RefreshCw
                  className={cn(
                    "mr-1.5 h-3.5 w-3.5",
                    dashLoading || metaMetricsLoading ? "animate-spin" : ""
                  )}
                />
                Atualizar
              </Button>
            ) : null}
            <Button size="sm" className="h-9 rounded-lg shadow-sm" asChild>
              <Link to="/marketing" className="gap-1.5">
                <Megaphone className="h-3.5 w-3.5" />
                Marketing
              </Link>
            </Button>
          </div>
        }
      />

      <FilterBarPremium
        label="Integrações"
        footer="Google Ads permanece em ativação até a API aprovada. Métricas Meta vêm do endpoint agregado /marketing/dashboard."
      >
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Período: <span className="font-semibold text-foreground">{dateRangeLabel}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={hasMeta ? (metaOk ? "connected" : "alert") : "disconnected"} dot>
              Meta Ads
            </StatusBadge>
            {hasGoogle ? (
              <StatusBadge tone={googleOk ? "connected" : "disconnected"} dot>
                Google Ads
              </StatusBadge>
            ) : (
              <span className="text-xs text-muted-foreground">Google Ads não conectado</span>
            )}
          </div>
        </div>
      </FilterBarPremium>

      {hasGoogle && !metricsLoading && !googleOk ? (
        <div
          className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] via-card to-card p-5 shadow-[var(--shadow-surface-sm)]"
          role="status"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-200">
                <Sparkles className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Google Ads · integração em ativação</p>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {metricsError ??
                    "Google Ads ainda não está disponível neste ambiente. O pedido de ativação da API está em análise."}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 rounded-lg" asChild>
              <Link to="/marketing/integracoes">Ver integrações</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {hasMeta && (
        <AnalyticsSection
          eyebrow="Governança"
          title="Metas e alertas"
          description="Totais combinam resumo Meta (dashboard) + Google quando existir."
          dense
        >
          <PerformanceAlerts alerts={insightData?.alerts} loading={insightLoading} />
          {compareEnabled ? (
            <div className="mt-4 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              {cmpLoading ? (
                <span>Carregando comparação com o período anterior…</span>
              ) : cmpMetaSpend <= 0 && metaSpend <= 0 ? (
                <span>Comparação ativa — sem gasto Meta no período atual nem no anterior.</span>
              ) : (
                <span>
                  <strong className="font-semibold text-foreground">Gasto Meta (período anterior):</strong>{" "}
                  <span className="font-semibold tabular-nums text-foreground">{formatSpend(cmpMetaSpend)}</span>
                  {metaSpend > 0 && cmpMetaSpend > 0 ? (
                    <>
                      {" "}
                      (
                      {metaSpend >= cmpMetaSpend ? "+" : ""}
                      {(((metaSpend - cmpMetaSpend) / cmpMetaSpend) * 100).toFixed(1)}% vs. anterior)
                    </>
                  ) : null}
                </span>
              )}
            </div>
          ) : null}
        </AnalyticsSection>
      )}

      {!hasAnyChannel ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <EmptyState
              icon={BarChart3}
              title="Conecte a Meta Ads"
              description="O painel executivo usa o payload agregado da API. Conecte a Meta em Integrações."
              actionLabel="Abrir integrações"
              onAction={() => navigate("/marketing/integracoes")}
              className="min-h-[280px] rounded-2xl border-border/55 bg-card shadow-[var(--shadow-surface)]"
            />
          </div>
          <AnalyticsSection title="Atalhos" description="Núcleo analítico." dense>
            <ul className="space-y-1">
              <li>
                <Link
                  to="/marketing"
                  className="flex items-center justify-between rounded-xl border border-transparent px-3 py-3 text-sm transition-colors hover:border-border/60 hover:bg-muted/30"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Megaphone className="h-4 w-4 text-primary" />
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
      ) : hasMeta && (dash === undefined || (dashLoading && !metaOk)) ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-2xl border border-border/55 bg-card px-8 py-10 shadow-[var(--shadow-surface-sm)]">
          <div className="w-full max-w-md">
            <IndeterminateLoadingBar label="Carregando painel agregado (Meta)…" />
          </div>
        </div>
      ) : hasMeta && dash && !dash.ok ? (
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-surface)]" role="alert">
          <p className="text-sm font-semibold text-foreground">Painel agregado (Meta)</p>
          <p className="mt-2 text-sm text-muted-foreground">{dash.message}</p>
          <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => void loadDashboard()}>
            Tentar novamente
          </Button>
        </div>
      ) : metaOk && summary && dash ? (
        <div className="space-y-8">
          {summary.reconciliation && !summary.reconciliation.spendMatchesSummary ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              Aviso interno: conferência gasto — resumo {formatSpend(summary.spend)} vs. série{" "}
              {formatSpend(summary.reconciliation.spendFromTimeseries)}. Se persistir, verifique logs do servidor
              (DEBUG_META_INSIGHTS).
            </p>
          ) : null}

          <section className="space-y-3">
            <div className="flex flex-col gap-1 px-0.5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">Faixa principal · Meta Ads</h2>
                <p className="text-xs text-muted-foreground">
                  Totais = soma da série diária (investimento, impressões, cliques, conversões parseadas).
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <KpiCardPremium
                variant="primary"
                label="Investimento"
                value={formatSpend(metaSpend)}
                icon={DollarSign}
                source="Meta Ads"
                delta={relDelta(metaSpend, cmpMetaSpend, compareEnabled)}
              />
              <KpiCardPremium
                variant="primary"
                label="Impressões"
                value={formatNumber(summary.impressions)}
                icon={Eye}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="primary"
                label="Alcance"
                value={formatReach(summary).text}
                hint={formatReach(summary).hint}
                icon={Target}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="primary"
                label="Frequência"
                value={formatFrequency(summary).text}
                hint={formatFrequency(summary).hint}
                icon={Zap}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="primary"
                label="Cliques (todos)"
                value={formatNumber(summary.clicks)}
                icon={MousePointer}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="primary"
                label="Cliques no link"
                value={formatLinkClicks(summary).text}
                hint={formatLinkClicks(summary).hint}
                icon={MousePointer}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="primary"
                label="CTR"
                value={derived?.ctrPct != null ? formatPercent(derived.ctrPct) : "Indisponível"}
                hint={derived?.ctrPct == null ? "Sem impressões no período." : undefined}
                icon={BarChart3}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="primary"
                label="CPC médio"
                value={derived?.cpc != null ? formatSpend(derived.cpc) : "Indisponível"}
                hint={derived?.cpc == null ? "Requer cliques e gasto > 0." : undefined}
                icon={Target}
                source="Meta Ads"
                deltaInvert
              />
              <KpiCardPremium
                variant="primary"
                label="CPM"
                value={derived?.cpm != null ? formatSpend(derived.cpm) : "Indisponível"}
                hint={derived?.cpm == null ? "Requer impressões e gasto > 0." : undefined}
                icon={Layers}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="primary"
                label="Leads"
                value={formatNumber(summary.leads)}
                hint="Eventos mapeados em actions (lead, pixel lead, contatos, etc.)."
                icon={UserPlus}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="primary"
                label="CPL (leads)"
                value={derived?.cplLeads != null ? formatSpend(derived.cplLeads) : "Indisponível"}
                hint={derived?.cplLeads == null ? "Sem leads ou sem gasto para dividir." : undefined}
                icon={DollarSign}
                source="Meta Ads"
                deltaInvert
              />
              <KpiCardPremium
                variant="primary"
                label="Checkout iniciado"
                value={formatNumber(summary.initiateCheckout)}
                hint="initiate_checkout / pixel."
                icon={ShoppingBag}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="primary"
                label="Add to cart"
                value={formatNumber(summary.addToCart)}
                icon={ShoppingBag}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="primary"
                label="Cadastro completo"
                value={formatNumber(summary.completeRegistration)}
                icon={UserPlus}
                source="Meta Ads"
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="px-0.5">
              <h2 className="text-lg font-bold tracking-tight text-foreground">Resultados e atribuição</h2>
              <p className="text-xs text-muted-foreground">
                Zero é valor real quando não houve evento. “Indisponível” indica métrica derivada que não pôde ser
                calculada.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCardPremium
                variant="compact"
                label="Conversas iniciadas"
                value={formatNumber(summary.messagingConversations)}
                hint="WhatsApp/Messenger (7d ou 28d, conforme Meta)."
                icon={MessageCircle}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="compact"
                label="Landing page views"
                value={formatNumber(summary.landingPageViews)}
                hint="Ações landing_page_view mapeadas."
                icon={Eye}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="compact"
                label="Compras"
                value={formatNumber(summary.purchases)}
                icon={ShoppingBag}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="compact"
                label="Valor de compra"
                value={
                  summary.purchaseValue > 0
                    ? formatSpend(summary.purchaseValue)
                    : summary.purchases > 0
                      ? formatSpend(0)
                      : "Indisponível"
                }
                hint={
                  summary.purchaseValue <= 0 && summary.purchases > 0
                    ? "Compras sem valor em action_values."
                    : summary.purchases <= 0
                      ? "Sem compras no período."
                      : undefined
                }
                icon={TrendingUp}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="compact"
                label="ROAS"
                value={formatNullableRatio(derived?.roas ?? null, false).text}
                hint={formatNullableRatio(derived?.roas ?? null, false).hint ?? undefined}
                icon={TrendingUp}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="compact"
                label="Custo por compra"
                value={derived?.costPerPurchase != null ? formatSpend(derived.costPerPurchase) : "Indisponível"}
                hint={derived?.costPerPurchase == null ? "Sem compras ou sem gasto." : undefined}
                icon={DollarSign}
                source="Meta Ads"
                deltaInvert
              />
              <KpiCardPremium
                variant="compact"
                label="Custo / resultado"
                value={metaCostPerResult != null ? formatSpend(metaCostPerResult) : "Indisponível"}
                hint="Gasto ÷ (leads + conversas + compras)."
                icon={Target}
                source="Meta Ads"
                deltaInvert
              />
              <KpiCardPremium
                variant="compact"
                label="Taxa clique → lead"
                value={
                  derived?.clickToLeadRate != null
                    ? formatPercent(derived.clickToLeadRate * 100, 2)
                    : "Indisponível"
                }
                hint={derived?.clickToLeadRate == null ? "Sem base de cliques (link ou total)." : undefined}
                icon={LineChart}
                source="Meta Ads"
              />
              <KpiCardPremium
                variant="compact"
                label="Taxa lead → venda"
                value={
                  derived?.leadToPurchaseRate != null
                    ? formatPercent(derived.leadToPurchaseRate * 100, 2)
                    : "Indisponível"
                }
                hint={derived?.leadToPurchaseRate == null ? "Sem leads ou sem compras." : undefined}
                icon={ShoppingBag}
                source="Meta Ads"
              />
            </div>
          </section>

          <ChartPanelPremium
            title="Série diária · investimento e leads"
            description="Pontos alinhados ao intervalo; dias sem dados aparecem como zero."
            actions={
              <Button
                type="button"
                variant={chartExtra === "ctr" ? "secondary" : "outline"}
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={() => setChartExtra((v) => (v === "ctr" ? "none" : "ctr"))}
              >
                {chartExtra === "ctr" ? "Ocultar CTR" : "Mostrar CTR"}
              </Button>
            }
            contentClassName="pt-2"
          >
            <div className="h-[320px] w-full min-w-0">
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
                    tickFormatter={(v) => String(v)}
                  />
                  <Tooltip
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
          </ChartPanelPremium>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartPanelPremium title="Distribuição por plataforma" contentClassName="pt-2">
              <div className="flex flex-col gap-4">
                {dash.distribution.byPlatform.map((p) => (
                  <div key={p.platform} className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-foreground">{p.platform}</span>
                      <span className="text-lg font-bold tabular-nums text-primary">
                        {p.spendSharePct.toFixed(1).replace(".", ",")}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Investimento: <span className="font-semibold text-foreground">R$ {p.spend}</span>
                    </p>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
                        style={{ width: `${Math.min(100, p.spendSharePct)}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div
                  className={cn(
                    "rounded-xl border p-4",
                    googleOk ? "border-border/60 bg-muted/20" : "border-dashed border-border/70 bg-muted/10"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">Google Ads</span>
                    <span className="text-xs font-medium text-muted-foreground">{googleStatusLabel}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {googleOk
                      ? `Gasto Google: ${formatSpend(metrics!.summary.costMicros / 1_000_000)} (detalhe no Marketing).`
                      : "Sem misturar zeros do Google com métricas Meta neste painel."}
                  </p>
                </div>
              </div>
            </ChartPanelPremium>

            <ChartPanelPremium
              title="Participação interna (heurística)"
              description="Temperatura por nome da campanha; score por quartil de CTR."
              contentClassName="pt-2"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/55 bg-card/80 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Temperatura · gasto</p>
                  {!dash.distribution.byTemperature.length ? (
                    <p className="mt-2 text-sm text-muted-foreground">Sem gasto para distribuir.</p>
                  ) : (
                    <ul className="mt-3 space-y-2 text-sm">
                      {dash.distribution.byTemperature.map((t) => (
                        <li key={t.segment} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">
                            {t.segment === "hot" ? "Quente" : "Frio"} (heurística de nome)
                          </span>
                          <span className="font-semibold tabular-nums">
                            {formatPercent(t.spendSharePct)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-xl border border-border/55 bg-card/80 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Score CTR (peso)</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {(["A", "B", "C", "D"] as const).map((g) => (
                      <li key={g} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Faixa {g}</span>
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

          <section className="space-y-3">
            <div className="px-0.5">
              <h2 className="text-lg font-bold tracking-tight text-foreground">Performance por nível</h2>
              <p className="text-xs text-muted-foreground">Dados carregados no mesmo payload agregado.</p>
            </div>
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
          </section>

          <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.05] via-card to-transparent px-5 py-5 shadow-[var(--shadow-surface-sm)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">Ir além do resumo</p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                Marketing: filtros, funis e visão Google quando liberada.
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
      ) : (
        <div
          className="rounded-2xl border border-border/55 bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-surface-sm)]"
          role="status"
        >
          Conecte a Meta Ads para ver o painel executivo.
        </div>
      )}
    </div>
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
          <th className="text-right">Investimento</th>
          <th className="text-right">Impr.</th>
          <th className="text-right">Alcance</th>
          <th className="text-right">Cliques</th>
          <th className="text-right">CTR</th>
          <th className="text-right">CPC</th>
          <th className="text-right">Leads</th>
          <th className="text-right">CPL</th>
          <th className="text-right">Compras</th>
          <th className="text-right">Valor compra</th>
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
              {row.purchaseValue > 0 ? formatSpend(row.purchaseValue) : formatNumber(0)}
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
