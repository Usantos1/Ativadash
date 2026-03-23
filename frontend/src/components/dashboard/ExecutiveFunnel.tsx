import { useMemo } from "react";
import { GitBranch, TrendingDown } from "lucide-react";
import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildAdaptiveFunnelModel,
  layerWidthsPercentFromGeometry,
  type AdaptiveFunnelModel,
  type FunnelFlowModel,
  type FunnelStep,
  type FunnelTransition,
} from "./funnel-flow.logic";

export type { FunnelStep, FunnelTransition, FunnelFlowModel, AdaptiveFunnelModel };

function formatTransitionRate(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  if (pct > 999) return ">999%";
  return formatPercent(pct, 2);
}

function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold leading-tight",
        className
      )}
    >
      {children}
    </span>
  );
}

function FunnelLayer({
  step,
  widthPct,
  spend,
  summary,
  zone,
  bottleneckStepIds,
}: {
  step: FunnelStep;
  widthPct: number;
  spend: number;
  summary: MarketingDashboardSummary;
  zone: "top" | "mid" | "bottom";
  bottleneckStepIds: Set<string>;
}) {
  const v = step.value;
  const isBn = bottleneckStepIds.has(step.id);

  const tooltipExtra =
    step.id === "lead" && spend > 0 && summary.leads > 0
      ? `CPL ≈ ${formatSpend(spend / summary.leads)}`
      : step.id === "pur" && spend > 0 && summary.purchases > 0
        ? `Custo/compra ≈ ${formatSpend(spend / summary.purchases)}`
        : spend > 0 && v != null && v > 0
          ? `${formatSpend(spend / v)} por unidade (gasto ÷ volume)`
          : null;

  const zoneTint =
    zone === "top"
      ? "from-primary/20 via-primary/12 to-primary/8"
      : zone === "mid"
        ? "from-primary/14 via-primary/9 to-primary/6"
        : "from-primary/10 via-primary/7 to-primary/5";

  return (
    <div className="flex w-full justify-center px-1 sm:px-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="min-w-0 transition-[width] duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, widthPct))}%` }}
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-xl border bg-gradient-to-b px-3 py-2.5 shadow-sm sm:px-4 sm:py-3",
                zoneTint,
                step.unavailable
                  ? "border-dashed border-muted-foreground/40 bg-muted/25"
                  : "border-border/55",
                isBn && "ring-2 ring-amber-500/45 ring-offset-2 ring-offset-background"
              )}
              style={{
                clipPath: "polygon(3.5% 0, 96.5% 0, 100% 100%, 0 100%)",
              }}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/12 to-transparent"
                aria-hidden
              />
              <p className="text-center text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px]">
                {step.short}
              </p>
              <p className="mt-1 text-center text-xl font-bold tabular-nums leading-none tracking-tight text-foreground sm:text-2xl">
                {step.unavailable ? (
                  <span className="text-base font-semibold text-muted-foreground">—</span>
                ) : v != null ? (
                  formatNumber(v)
                ) : (
                  "—"
                )}
              </p>
              {step.unavailable ? (
                <p className="mt-1 text-center text-[9px] text-muted-foreground">Indisponível</p>
              ) : null}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] leading-snug">
          <p className="font-semibold">{step.label}</p>
          {tooltipExtra ? <p className="mt-1 text-xs text-muted-foreground">{tooltipExtra}</p> : null}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function TransitionGap({
  t,
  spend,
  summary,
  isBottleneck,
}: {
  t: FunnelTransition;
  spend: number;
  summary: MarketingDashboardSummary;
  isBottleneck: boolean;
}) {
  const rateText = formatTransitionRate(t.ratePct);

  return (
    <div className="flex justify-center py-1.5 sm:py-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex max-w-[min(100%,20rem)] flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-center shadow-sm sm:flex-row sm:gap-2 sm:px-4",
              isBottleneck
                ? "border-amber-500/45 bg-gradient-to-r from-amber-500/15 to-amber-500/5"
                : t.isExpansion
                  ? "border-violet-500/25 bg-violet-500/[0.07]"
                  : "border-border/45 bg-muted/35"
            )}
          >
            <span
              className={cn(
                "text-[9px] font-bold uppercase tracking-wide sm:text-[10px]",
                isBottleneck ? "text-amber-900 dark:text-amber-100" : "text-muted-foreground"
              )}
            >
              {t.displayLabel}
            </span>
            <span className="text-sm font-bold tabular-nums text-foreground sm:text-base">{rateText}</span>
            {t.isExpansion && t.ratePct != null ? (
              <span className="text-[9px] font-medium text-violet-700 dark:text-violet-300">
                (real &gt; 100%)
              </span>
            ) : null}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[280px] text-xs leading-relaxed">
          <p className="font-medium text-foreground">{t.formula}</p>
          {t.from.id === "lead" && spend > 0 && summary.leads > 0 ? (
            <p className="mt-2 text-muted-foreground">CPL ≈ {formatSpend(spend / summary.leads)}</p>
          ) : null}
          {t.to.id === "pur" && spend > 0 && summary.purchases > 0 ? (
            <p className="mt-2 text-muted-foreground">
              Custo/compra ≈ {formatSpend(spend / summary.purchases)}
            </p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function zoneForStepIndex(i: number, total: number): "top" | "mid" | "bottom" {
  if (total <= 1) return "mid";
  const t = i / (total - 1);
  if (t < 1 / 3) return "top";
  if (t < 2 / 3) return "mid";
  return "bottom";
}

/**
 * Funil executivo em camadas horizontais: silhueta monótona (topo → fundo), taxas reais entre etapas.
 */
export function ExecutiveFunnel({
  summary,
  spend,
  className,
}: {
  summary: MarketingDashboardSummary;
  spend: number;
  className?: string;
}) {
  const model = useMemo(() => buildAdaptiveFunnelModel(summary), [summary]);
  const widthPcts = useMemo(
    () => layerWidthsPercentFromGeometry(model.classicGeometry),
    [model.classicGeometry]
  );

  const bnTransIdx =
    model.bottleneckKey == null
      ? -1
      : model.transitions.findIndex((t) => t.key === model.bottleneckKey);

  const bottleneckStepIds = useMemo(() => {
    const s = new Set<string>();
    if (bnTransIdx >= 0) {
      const tr = model.transitions[bnTransIdx];
      if (tr) {
        s.add(tr.from.id);
        s.add(tr.to.id);
      }
    }
    return s;
  }, [bnTransIdx, model.transitions]);

  const footerNote =
    model.mode === "hybrid"
      ? "Silhueta do funil não alarga quando uma etapa supera a anterior; valores e taxas permanecem os dados reais."
      : null;

  return (
    <section
      className={cn(
        "rounded-2xl border border-border/55 bg-gradient-to-b from-card via-card to-muted/[0.1] p-4 shadow-[var(--shadow-surface)] sm:p-6",
        className
      )}
    >
      <header className="flex flex-col gap-4 border-b border-border/40 pb-5">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary/80">
            Fluxo de conversão
          </p>
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Funil de camadas
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Do topo (volume amplo) ao fundo (conversão). Cada faixa afunila na silhueta; as taxas mostram a
            passagem real entre etapas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {model.mode === "hybrid" ? (
            <Pill className="border-violet-500/30 bg-violet-500/[0.08] text-violet-950 dark:text-violet-100">
              <GitBranch className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span className="truncate">Fluxo híbrido</span>
            </Pill>
          ) : null}
          {model.bottleneckBadge ? (
            <Pill className="border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-50">
              <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">Gargalo: {model.bottleneckBadge}</span>
            </Pill>
          ) : (
            <Pill className="border-border/50 bg-muted/30 text-muted-foreground">
              <span className="truncate">Gargalo: não destacado</span>
            </Pill>
          )}
        </div>

        <p className="text-sm font-medium leading-snug text-foreground">{model.bottleneckLine}</p>
      </header>

      <div className="mt-5 flex flex-col gap-4 sm:mt-6 sm:flex-row sm:gap-6 lg:gap-8">
        <div
          className="hidden w-11 shrink-0 flex-col justify-between border-r border-border/35 py-4 pr-3 text-[8px] font-bold uppercase leading-tight tracking-wider text-muted-foreground sm:flex sm:w-12 sm:text-[9px]"
          aria-hidden
        >
          <span>Topo</span>
          <span className="text-center">Meio</span>
          <span className="text-right">Fundo</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">
            Topo → meio → fundo
          </p>

          <div className="mx-auto w-full max-w-md lg:max-w-lg">
            {model.steps.map((step, i) => (
              <div key={step.id}>
                <FunnelLayer
                  step={step}
                  widthPct={widthPcts[i] ?? 100}
                  spend={spend}
                  summary={summary}
                  zone={zoneForStepIndex(i, model.steps.length)}
                  bottleneckStepIds={bottleneckStepIds}
                />
                {i < model.transitions.length ? (
                  <TransitionGap
                    t={model.transitions[i]}
                    spend={spend}
                    summary={summary}
                    isBottleneck={bnTransIdx === i}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {footerNote ? (
        <footer className="mt-6 border-t border-border/35 pt-4">
          <p className="text-center text-[10px] leading-relaxed text-muted-foreground sm:text-left">
            {footerNote}
          </p>
        </footer>
      ) : null}
    </section>
  );
}
