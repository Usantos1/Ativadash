import { useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  EyeOff,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BusinessGoalMode } from "@/lib/marketing-settings-api";
import type { InsightTotalsInput } from "@/lib/marketing-totals";
import { generateInsights } from "@/lib/marketing-insights-engine";
import { deriveAccountHealth, type AccountHealth } from "@/lib/marketing-strategic-insights";
import type { GoogleAdsMetricsResponse, MetaAdsMetricsResponse } from "@/lib/integrations-api";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  clearAllInsightUiStateForOrg,
  clearDismissedInsightsForOrg,
  clearResolvedInsightsForOrg,
  dismissInsightForOrg,
  getActiveDismissedInsightIds,
  getActiveResolvedInsightIds,
  INSIGHT_DISMISS_TTL_MS,
  INSIGHT_RESOLVED_TTL_MS,
  resolveInsightForOrg,
} from "@/lib/marketing-settings-insight-dismiss";

function formatBrl(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n);
}

function healthToScore(health: AccountHealth, hasTargets: boolean, hasIntegration: boolean): number {
  let base = health === "healthy" ? 76 : health === "attention" ? 54 : 32;
  if (hasTargets) base += 8;
  if (hasIntegration) base += 6;
  return Math.min(100, Math.round(base));
}

function mergeDailySeries(
  google: GoogleAdsMetricsResponse | null,
  meta: MetaAdsMetricsResponse | null
): { day: string; spend: number }[] {
  const map = new Map<string, number>();
  if (google?.ok && google.daily) {
    for (const r of google.daily) {
      map.set(r.date, (map.get(r.date) ?? 0) + r.costMicros / 1_000_000);
    }
  }
  if (meta?.ok && meta.daily) {
    for (const r of meta.daily) {
      map.set(r.date, (map.get(r.date) ?? 0) + r.spend);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, spend]) => ({ day: date.slice(5), spend }))
    .slice(-14);
}

function trendFromSeries(rows: { spend: number }[]): "up" | "down" | "flat" {
  if (rows.length < 4) return "flat";
  const mid = Math.floor(rows.length / 2);
  const a = rows.slice(0, mid).reduce((s, r) => s + r.spend, 0) / mid;
  const b = rows.slice(mid).reduce((s, r) => s + r.spend, 0) / (rows.length - mid);
  if (b > a * 1.08) return "up";
  if (b < a * 0.92) return "down";
  return "flat";
}

type GoalLineProps = {
  label: string;
  currentLabel: string;
  current: string;
  target: string | null;
  verdict: "ok" | "warn" | "bad" | "muted";
  hint: string;
};

function GoalStatusLine({ label, currentLabel, current, target, verdict, hint }: GoalLineProps) {
  const tone =
    verdict === "ok"
      ? "border-emerald-500/25 bg-emerald-500/[0.06]"
      : verdict === "warn"
        ? "border-amber-500/30 bg-amber-500/[0.07]"
        : verdict === "bad"
          ? "border-destructive/30 bg-destructive/[0.06]"
          : "border-border/50 bg-muted/20";
  return (
    <div className={cn("rounded-xl border px-3 py-2.5 sm:px-4", tone)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        {target ? (
          <p className="text-[10px] font-semibold text-muted-foreground">
            Meta: <span className="font-mono text-foreground">{target}</span>
          </p>
        ) : null}
      </div>
      <p className="mt-1 text-sm font-bold tabular-nums text-foreground">
        {currentLabel}: {current}
      </p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  pausar: "Pausar / conter",
  escalar: "Escalar",
  ajustar: "Ajustar criativo",
  pagina: "Landing / oferta",
  volume: "Volume",
};

const DISMISS_DAYS = Math.max(1, Math.round(INSIGHT_DISMISS_TTL_MS / 86400000));
const RESOLVED_DAYS = Math.max(1, Math.round(INSIGHT_RESOLVED_TTL_MS / 86400000));

export function MarketingSettingsCommandCenter({
  organizationId,
  goalMode,
  targetCpa,
  maxCpa,
  targetRoas,
  minSpendAlerts,
  insightTotals,
  metricsLoading,
  hasGoogle,
  hasMeta,
  metaMetrics,
  metrics,
  onApplySuggestedCpa,
  onApplySuggestedRoas,
}: {
  organizationId: string | null | undefined;
  goalMode: BusinessGoalMode;
  targetCpa: number | null;
  maxCpa: number | null;
  targetRoas: number | null;
  minSpendAlerts: number | null;
  insightTotals: InsightTotalsInput | null;
  metricsLoading: boolean;
  hasGoogle: boolean;
  hasMeta: boolean;
  metaMetrics: MetaAdsMetricsResponse | null;
  metrics: GoogleAdsMetricsResponse | null;
  onApplySuggestedCpa: (v: number) => void;
  onApplySuggestedRoas: (v: number) => void;
}) {
  const [dismissTick, setDismissTick] = useState(0);

  const dismissedIds = useMemo(() => {
    void dismissTick;
    return getActiveDismissedInsightIds(organizationId ?? null);
  }, [organizationId, dismissTick]);

  const resolvedIds = useMemo(() => {
    void dismissTick;
    return getActiveResolvedInsightIds(organizationId ?? null);
  }, [organizationId, dismissTick]);

  const handleDismissInsight = useCallback(
    (insightId: string) => {
      if (!organizationId) return;
      dismissInsightForOrg(organizationId, insightId);
      setDismissTick((n) => n + 1);
    },
    [organizationId]
  );

  const handleResolveInsight = useCallback(
    (insightId: string) => {
      if (!organizationId) return;
      resolveInsightForOrg(organizationId, insightId);
      setDismissTick((n) => n + 1);
    },
    [organizationId]
  );

  const handleRestoreDismissed = useCallback(() => {
    if (!organizationId) return;
    clearDismissedInsightsForOrg(organizationId);
    setDismissTick((n) => n + 1);
  }, [organizationId]);

  const handleRestoreResolved = useCallback(() => {
    if (!organizationId) return;
    clearResolvedInsightsForOrg(organizationId);
    setDismissTick((n) => n + 1);
  }, [organizationId]);

  const handleRestoreAllInsightUi = useCallback(() => {
    if (!organizationId) return;
    clearAllInsightUiStateForOrg(organizationId);
    setDismissTick((n) => n + 1);
  }, [organizationId]);
  const spend = insightTotals?.totalSpendBrl ?? 0;
  const leads = insightTotals?.totalResults ?? 0;
  const value = insightTotals?.totalAttributedValueBrl ?? 0;
  const impressions = insightTotals?.totalImpressions ?? 0;
  const clicks = insightTotals?.totalClicks ?? 0;

  const blendCpl = leads > 0 ? spend / leads : 0;
  const roasBlend = spend > 0 ? value / spend : null;
  const ctrT = impressions > 0 && clicks > 0 ? (clicks / impressions) * 100 : null;

  const purchases = metaMetrics?.ok ? metaMetrics.summary.purchases ?? 0 : 0;
  const landingPv = metaMetrics?.ok ? metaMetrics.summary.landingPageViews ?? 0 : 0;

  const health = useMemo(
    () =>
      deriveAccountHealth({
        mode: goalMode,
        filteredSpend: spend,
        leadsReais: leads,
        roasBlend,
        blendCpl: leads > 0 ? blendCpl : 0,
        ctrT,
        targetCpa,
        maxCpa,
        targetRoas,
      }),
    [goalMode, spend, leads, roasBlend, blendCpl, ctrT, targetCpa, maxCpa, targetRoas]
  );

  const score = useMemo(
    () =>
      healthToScore(
        health,
        targetCpa != null || targetRoas != null,
        hasGoogle || hasMeta
      ),
    [health, targetCpa, targetRoas, hasGoogle, hasMeta]
  );

  const allInsights = useMemo(
    () =>
      generateInsights({
        goalMode,
        spend,
        clicks,
        leads,
        impressions,
        landingPageViews: landingPv,
        cpl: leads > 0 ? blendCpl : null,
        cplTarget: targetCpa,
        maxCpl: maxCpa,
        ctrPct: ctrT,
        purchases,
      }),
    [
      goalMode,
      spend,
      clicks,
      leads,
      impressions,
      landingPv,
      blendCpl,
      targetCpa,
      maxCpa,
      ctrT,
      purchases,
    ]
  );

  const insights = useMemo(
    () => allInsights.filter((i) => !dismissedIds.has(i.id) && !resolvedIds.has(i.id)),
    [allInsights, dismissedIds, resolvedIds]
  );

  const chartData = useMemo(() => mergeDailySeries(metrics, metaMetrics), [metrics, metaMetrics]);
  const spendTrend = useMemo(() => trendFromSeries(chartData), [chartData]);

  const suggestedCpa =
    leads >= 3 && blendCpl > 0 ? Math.round(blendCpl * 1.12 * 100) / 100 : null;
  const suggestedRoas =
    roasBlend != null && roasBlend > 0 ? Math.round(roasBlend * 1.08 * 10) / 10 : null;

  const cplVerdict: GoalLineProps["verdict"] =
    leads < 1
      ? "muted"
      : targetCpa == null
        ? "muted"
        : blendCpl <= targetCpa
          ? "ok"
          : blendCpl <= targetCpa * 1.15
            ? "warn"
            : "bad";

  const roasVerdict: GoalLineProps["verdict"] =
    roasBlend == null || targetRoas == null
      ? "muted"
      : roasBlend >= targetRoas
        ? "ok"
        : roasBlend >= targetRoas * 0.85
          ? "warn"
          : "bad";

  const spendVerdict: GoalLineProps["verdict"] =
    minSpendAlerts == null ? "muted" : spend >= minSpendAlerts ? "ok" : "warn";

  const noData = !insightTotals && !metricsLoading;
  const disconnected = !hasGoogle && !hasMeta;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/[0.07] via-card/80 to-card shadow-[var(--shadow-surface-sm)]">
        <div className="border-b border-border/40 bg-muted/20 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Central de decisão</p>
              <h2 className="text-lg font-black tracking-tight text-foreground sm:text-xl">Status das metas · últimos 30 dias</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Leitura automática dos canais conectados. Ajuste as metas abaixo e execute ações no Painel ADS.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2 rounded-xl border border-border/50 bg-background/80 px-4 py-3 text-right shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Activity className="h-4 w-4 text-primary" aria-hidden />
                Score orientativo
              </div>
              <p className="text-3xl font-black tabular-nums text-foreground">{score}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">de 100</p>
              <p className="max-w-[200px] text-[11px] leading-snug text-muted-foreground">
                {health === "healthy"
                  ? "CPL, ROAS e volume coerentes com as metas neste período."
                  : health === "attention"
                    ? "Há desvios — veja recomendações e o Painel ADS."
                    : "Risco alto — confira CPL, ROAS ou rastreamento."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:gap-4 sm:p-6">
          {metricsLoading ? (
            <div className="col-span-full rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
              Carregando métricas dos anúncios…
            </div>
          ) : disconnected ? (
            <div className="col-span-full rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-4 text-sm text-amber-950 dark:text-amber-100">
              <p className="font-semibold">Conecte Meta ou Google Ads</p>
              <p className="mt-1 text-xs opacity-90">
                Sem integração não há CPL/ROAS reais aqui.{" "}
                <Link to="/marketing/integracoes" className="font-medium text-primary underline-offset-4 hover:underline">
                  Abrir integrações
                </Link>
              </p>
            </div>
          ) : noData ? (
            <div className="col-span-full rounded-xl border border-border/50 bg-muted/15 px-4 py-4 text-sm text-muted-foreground">
              Dados insuficientes no período (ou APIs indisponíveis). Abra o{" "}
              <Link to="/marketing" className="font-medium text-primary hover:underline">
                Painel ADS
              </Link>{" "}
              para conferir.
            </div>
          ) : (
            <>
              <GoalStatusLine
                label="CPL / CPA efetivo"
                currentLabel="Atual"
                current={leads > 0 ? formatBrl(blendCpl) : "—"}
                target={targetCpa != null ? formatBrl(targetCpa) : null}
                verdict={cplVerdict}
                hint={
                  leads < 1
                    ? "Sem resultados no período — confira rastreamento antes de mudar metas."
                    : targetCpa == null
                      ? "Defina um CPL alvo nas metas abaixo para comparar."
                      : blendCpl <= targetCpa
                        ? "Abaixo da meta — espaço para escalar com cuidado."
                        : "Acima da meta — priorize pausa ou otimização no Painel ADS."
                }
              />
              <GoalStatusLine
                label="ROAS"
                currentLabel="Atual"
                current={roasBlend != null ? `${roasBlend.toFixed(2)}×` : "—"}
                target={targetRoas != null ? `${targetRoas}×` : null}
                verdict={roasVerdict}
                hint={
                  targetRoas == null
                    ? "Defina ROAS mínimo nas metas para este comparativo."
                    : roasBlend != null && roasBlend >= targetRoas
                      ? "Dentro do alvo de retorno."
                      : "Atenção ao retorno — revise público, oferta e criativos."
                }
              />
              <GoalStatusLine
                label="Gasto"
                currentLabel="Período"
                current={formatBrl(spend)}
                target={minSpendAlerts != null ? formatBrl(minSpendAlerts) : null}
                verdict={spendVerdict}
                hint={
                  minSpendAlerts == null
                    ? "Opcional: configure gasto mínimo para disparar alertas."
                    : spend >= minSpendAlerts
                      ? "Volume suficiente para os alertas de metas considerarem o período."
                      : "Volume ainda baixo — alertas podem ficar silenciados até atingir o mínimo."
                }
              />
            </>
          )}
        </div>

        {(suggestedCpa != null || suggestedRoas != null) && !metricsLoading && !disconnected ? (
          <div className="mx-4 mb-4 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 sm:mx-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="font-semibold text-foreground">Sugestão a partir dos dados</p>
                <p className="text-xs text-muted-foreground">
                  {suggestedCpa != null ? (
                    <>
                      CPL médio ~{formatBrl(blendCpl)} → sugerimos meta ~{formatBrl(suggestedCpa)}.{" "}
                    </>
                  ) : null}
                  {suggestedRoas != null && roasBlend != null ? (
                    <>
                      ROAS ~{roasBlend.toFixed(2)}× → sugerimos mínimo ~{suggestedRoas}×.
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedCpa != null ? (
                <Button type="button" size="sm" variant="secondary" className="rounded-lg" onClick={() => onApplySuggestedCpa(suggestedCpa)}>
                  Aplicar CPL sugerido
                </Button>
              ) : null}
              {suggestedRoas != null ? (
                <Button type="button" size="sm" variant="secondary" className="rounded-lg" onClick={() => onApplySuggestedRoas(suggestedRoas)}>
                  Aplicar ROAS sugerido
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/55 bg-card/50 shadow-[var(--shadow-surface-sm)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-muted/15 px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Próximos passos</p>
            <h3 className="text-base font-black text-foreground">Recomendações automáticas</h3>
            <p className="text-xs text-muted-foreground">Mesma lógica narrativa do Painel ADS — ações na tabela de campanhas.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {organizationId && dismissedIds.size > 0 ? (
              <Button type="button" variant="ghost" size="sm" className="rounded-lg text-xs" onClick={handleRestoreDismissed}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Restaurar ocultas ({dismissedIds.size})
              </Button>
            ) : null}
            {organizationId && resolvedIds.size > 0 ? (
              <Button type="button" variant="ghost" size="sm" className="rounded-lg text-xs" onClick={handleRestoreResolved}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Restaurar resolvidas ({resolvedIds.size})
              </Button>
            ) : null}
            {organizationId && dismissedIds.size + resolvedIds.size > 0 ? (
              <Button type="button" variant="ghost" size="sm" className="rounded-lg text-xs" onClick={handleRestoreAllInsightUi}>
                Restaurar todas
              </Button>
            ) : null}
            <Button variant="outline" size="sm" className="rounded-lg" asChild>
              <Link to="/marketing#painel-acoes-ads">
                Ir para ações
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          {allInsights.length > 0 && insights.length === 0 ? (
            <p className="mb-3 text-sm text-muted-foreground">
              Todas as recomendações estão ocultas ou marcadas como resolvidas. Use os botões &quot;Restaurar&quot; acima
              para voltar a exibi-las.
            </p>
          ) : null}
          {insights.length === 0 && allInsights.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma recomendação automática neste recorte — ótimo sinal ou volume ainda baixo.
            </p>
          ) : insights.length === 0 ? null : (
            <ul className="space-y-3">
              {insights.slice(0, 6).map((it) => (
                <li
                  key={it.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/10 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                >
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5 shrink-0 rounded-md border border-border/60 bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {KIND_LABEL[it.kind] ?? it.kind}
                    </span>
                    <p className="min-w-0 text-sm leading-snug text-foreground">{it.title}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    <Button variant="secondary" size="sm" className="h-8 rounded-lg text-xs" asChild>
                      <Link to="/marketing#painel-acoes-ads">Executar no painel</Link>
                    </Button>
                    {organizationId ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          onClick={() => handleResolveInsight(it.id)}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Resolvido
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg text-xs text-muted-foreground"
                          onClick={() => handleDismissInsight(it.id)}
                        >
                          <EyeOff className="mr-1 h-3.5 w-3.5" />
                          Ocultar {DISMISS_DAYS}d
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            &quot;Executar&quot; abre o Painel ADS na fila de ações. &quot;Resolvido&quot; remove da lista por {RESOLVED_DAYS}{" "}
            dias (neste navegador, por organização). &quot;Ocultar&quot; suprime por {DISMISS_DAYS} dias sem assumir que
            tratou no painel.
          </p>
        </div>
      </section>

      {chartData.length >= 2 ? (
        <section className="overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-[var(--shadow-surface-sm)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-3 sm:px-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Tendência</p>
              <h3 className="text-sm font-bold text-foreground">Gasto diário (Meta + Google)</h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/20 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              {spendTrend === "up" ? (
                <>
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  Subindo vs. início do período
                </>
              ) : spendTrend === "down" ? (
                <>
                  <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
                  Caindo vs. início do período
                </>
              ) : (
                <>
                  <CircleDot className="h-3.5 w-3.5" />
                  Estável
                </>
              )}
            </span>
          </div>
          <div className="h-36 w-full p-2 sm:h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="msSpendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  formatter={(v: number) => [formatBrl(v), "Gasto"]}
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="spend" stroke="hsl(var(--primary))" fill="url(#msSpendFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}
    </div>
  );
}
