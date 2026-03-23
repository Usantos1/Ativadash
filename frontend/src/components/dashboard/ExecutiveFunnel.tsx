import { useId, useMemo, type ReactNode } from "react";
import { GitBranch, TrendingDown } from "lucide-react";
import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildAdaptiveFunnelModel,
  type AdaptiveFunnelModel,
  type FunnelFlowModel,
  type FunnelStep,
  type FunnelTransition,
} from "./funnel-flow.logic";

export type { FunnelStep, FunnelTransition, FunnelFlowModel, AdaptiveFunnelModel };

const LAYER_VIEW_H = 20;

function formatTransitionRate(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  if (pct > 999) return ">999%";
  return formatPercent(pct, 2);
}

function layerTrapezoidPoints(cx: number, hwTop: number, hwBot: number, h: number): string {
  const yb = h;
  return `${cx - hwTop},0 ${cx + hwTop},0 ${cx + hwBot},${yb} ${cx - hwBot},${yb}`;
}

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold leading-tight",
        className
      )}
    >
      {children}
    </span>
  );
}

function FunnelTrapezoidLayer({
  step,
  hwTop,
  hwBot,
  spend,
  summary,
  isBottleneck,
  gradientId,
}: {
  step: FunnelStep;
  hwTop: number;
  hwBot: number;
  spend: number;
  summary: MarketingDashboardSummary;
  isBottleneck: boolean;
  gradientId: string;
}) {
  const v = step.value;
  const cx = 110;
  const pts = layerTrapezoidPoints(cx, hwTop, hwBot, LAYER_VIEW_H);

  const tooltipExtra =
    step.id === "lead" && spend > 0 && summary.leads > 0
      ? `CPL ≈ ${formatSpend(spend / summary.leads)}`
      : step.id === "pur" && spend > 0 && summary.purchases > 0
        ? `Custo/compra ≈ ${formatSpend(spend / summary.purchases)}`
        : spend > 0 && v != null && v > 0
          ? `${formatSpend(spend / v)} por unidade`
          : step.unavailable
            ? "Dado não retornado pela integração para este período."
            : null;

  return (
    <div className="relative w-full min-h-[3rem] sm:min-h-[3.5rem] md:min-h-[4rem]">
      <svg
        viewBox={`0 0 220 ${LAYER_VIEW_H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden
      >
        {!step.unavailable ? (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.24} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.08} />
            </linearGradient>
          </defs>
        ) : null}
        <polygon
          points={pts}
          fill={step.unavailable ? "hsl(var(--muted) / 0.45)" : `url(#${gradientId})`}
          className={cn(
            "stroke-border/60",
            step.unavailable && "stroke-muted-foreground/45 stroke-dashed",
            isBottleneck && "stroke-amber-500/55"
          )}
          strokeWidth={0.85}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute inset-0 z-10 cursor-default rounded-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${step.label}: ${step.unavailable || v == null ? "indisponível" : formatNumber(v)}`}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] leading-snug">
          <p className="font-semibold">{step.label}</p>
          {tooltipExtra ? <p className="mt-1 text-xs text-muted-foreground">{tooltipExtra}</p> : null}
        </TooltipContent>
      </Tooltip>

      <div className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center px-2 py-1">
        <p className="text-center text-[9px] font-bold uppercase leading-tight tracking-[0.1em] text-muted-foreground sm:text-[10px] sm:tracking-[0.12em]">
          {step.short}
        </p>
        <p className="mt-0.5 text-center text-base font-bold tabular-nums leading-none tracking-tight text-foreground sm:text-lg md:text-xl">
          {step.unavailable ? (
            <span className="text-sm font-semibold text-muted-foreground">—</span>
          ) : v != null ? (
            formatNumber(v)
          ) : (
            "—"
          )}
        </p>
      </div>
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
    <div className="flex min-h-[1.75rem] justify-center py-0.5 sm:min-h-[2rem] sm:py-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex max-w-[min(100%,20rem)] flex-col items-center justify-center gap-0.5 rounded-md border px-3 py-1 text-center shadow-sm sm:flex-row sm:gap-3 sm:px-4",
              isBottleneck
                ? "border-amber-500/45 bg-gradient-to-r from-amber-500/14 to-amber-500/[0.05]"
                : t.isExpansion
                  ? "border-violet-500/30 bg-violet-500/[0.08]"
                  : "border-border/45 bg-muted/35"
            )}
          >
            <span
              className={cn(
                "text-[9px] font-bold uppercase tracking-wide text-muted-foreground",
                isBottleneck && "text-amber-900 dark:text-amber-100"
              )}
            >
              {t.displayLabel}
            </span>
            <span className="text-sm font-bold tabular-nums text-foreground sm:text-base">{rateText}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[280px] text-xs leading-relaxed">
          <p className="font-medium text-foreground">{t.formula}</p>
          {t.isExpansion && t.ratePct != null ? (
            <p className="mt-2 text-muted-foreground">
              Taxa acima de 100%: a etapa seguinte superou a anterior (eventos diferentes na Meta). A silhueta do funil
              permanece afunilada; o valor exibido é o real.
            </p>
          ) : null}
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

/**
 * Funil executivo: camadas trapezoidais SVG empilhadas (silhueta contínua topo → fundo).
 * Larguras com escala √ + mínimo/máximo + passo mínimo entre etapas; modo híbrido preserva a silhueta.
 */
export function ExecutiveFunnel({
  summary,
  spend,
  className,
  /** Quando true, omite gargalo/híbrido no cabeçalho e rodapé (painel de taxas ao lado no dashboard). */
  companionRatesPanel = false,
}: {
  summary: MarketingDashboardSummary;
  spend: number;
  className?: string;
  companionRatesPanel?: boolean;
}) {
  const baseId = useId();
  const model = useMemo(() => buildAdaptiveFunnelModel(summary), [summary]);
  const hw = model.classicGeometry.halfWidths;

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

  return (
    <section
      className={cn(
        "rounded-xl border border-border/50 bg-card/80 p-3 shadow-[var(--shadow-surface)] sm:p-5",
        className
      )}
    >
      <header className="border-b border-border/35 pb-3 sm:pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2 gap-y-2">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary/80">Fluxo de conversão</p>
            <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Funil de conversão</h2>
            <p className="max-w-xl text-xs leading-snug text-muted-foreground sm:text-[13px]">
              {companionRatesPanel
                ? "Valores absolutos por etapa; silhueta afunilada."
                : "Silhueta afunilada por etapa; valores absolutos dentro de cada faixa. Taxas entre as camadas."}
            </p>
          </div>
          {!companionRatesPanel ? (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {model.mode === "hybrid" ? (
                <Pill className="border-violet-500/30 bg-violet-500/[0.08] text-violet-950 dark:text-violet-100">
                  <GitBranch className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                  Fluxo híbrido
                </Pill>
              ) : null}
              {model.bottleneckBadge ? (
                <Pill className="border-amber-500/35 bg-amber-500/[0.1] text-amber-950 dark:text-amber-50">
                  <TrendingDown className="h-3 w-3 shrink-0" aria-hidden />
                  Gargalo: {model.bottleneckBadge}
                </Pill>
              ) : (
                <Pill className="border-border/45 bg-muted/25 text-muted-foreground">Sem gargalo destacado</Pill>
              )}
            </div>
          ) : null}
        </div>
        {!companionRatesPanel ? (
          <p className="mt-2 text-xs leading-snug text-muted-foreground sm:text-[13px]">{model.bottleneckLine}</p>
        ) : null}
      </header>

      <div className="mt-4 min-w-0 sm:mt-5">
        <div className={cn("mx-auto w-full", companionRatesPanel ? "max-w-full" : "max-w-2xl md:max-w-3xl")}>
          {model.steps.map((step, i) => {
            const hwTop = hw[i] ?? model.classicGeometry.centerX;
            const hwBot = i < model.steps.length - 1 ? (hw[i + 1] ?? hwTop) : hwTop;
            const isBn = bottleneckStepIds.has(step.id);
            const gradientId = `${baseId}-lg-${step.id}`;

            return (
              <div key={step.id} className="w-full">
                {i > 0 ? (
                  companionRatesPanel ? (
                    <div className="h-1 sm:h-1.5" aria-hidden />
                  ) : (
                    <TransitionGap
                      t={model.transitions[i - 1]!}
                      spend={spend}
                      summary={summary}
                      isBottleneck={bnTransIdx === i - 1}
                    />
                  )
                ) : null}
                <FunnelTrapezoidLayer
                  step={step}
                  hwTop={hwTop}
                  hwBot={hwBot}
                  spend={spend}
                  summary={summary}
                  isBottleneck={isBn}
                  gradientId={gradientId}
                />
              </div>
            );
          })}
        </div>
      </div>

      {!companionRatesPanel ? (
        <footer className="mt-3 border-t border-border/30 pt-3 text-center sm:mt-4">
          {model.mode === "hybrid" ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
              Modo híbrido: taxas podem superar 100% entre etapas; a forma do funil é apenas visual e segue a ordem das
              etapas.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground sm:text-xs">
              Largura das faixas usa escala visual (não linear no volume bruto), com afunilamento mínimo entre etapas.
            </p>
          )}
        </footer>
      ) : null}
    </section>
  );
}
