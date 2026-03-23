import { useMemo } from "react";
import { Filter, GitBranch, TrendingDown } from "lucide-react";
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

function ClassicFunnelSvg({
  geometry,
  bottleneckTransitionIndex,
}: {
  geometry: NonNullable<AdaptiveFunnelModel["classicGeometry"]>;
  bottleneckTransitionIndex: number | null;
}) {
  const { viewWidth, viewHeight, polygons } = geometry;
  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      className="h-auto w-full max-w-[280px] shrink-0 text-primary/85"
      role="img"
      aria-label="Funil de conversão proporcional às impressões"
    >
      <defs>
        <linearGradient id="funnelFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id="funnelStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {polygons.map((p, i) => {
        const isBn = bottleneckTransitionIndex === p.transitionIndex;
        return (
          <polygon
            key={i}
            points={p.points}
            fill="url(#funnelFill)"
            stroke={isBn ? "hsl(var(--destructive) / 0.55)" : "url(#funnelStroke)"}
            strokeWidth={isBn ? 2.2 : 1}
            className={cn(isBn && "drop-shadow-sm")}
          />
        );
      })}
    </svg>
  );
}

function ClassicLayout({
  model,
  spend,
  summary,
}: {
  model: AdaptiveFunnelModel;
  spend: number;
  summary: MarketingDashboardSummary;
}) {
  const geo = model.classicGeometry;
  if (!geo) return null;

  const bnIdx =
    model.bottleneckKey == null
      ? null
      : model.transitions.findIndex((t) => t.key === model.bottleneckKey);

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(200px,280px)_minmax(0,1.1fr)] lg:items-start">
      <ul className="order-2 space-y-0 lg:order-1">
        {model.steps.map((step) => (
          <li
            key={step.id}
            className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border/40 py-3 first:pt-0 last:border-0"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {step.short}
              </p>
              <p className="truncate text-xs text-muted-foreground/90">{step.label}</p>
            </div>
            <p className="shrink-0 text-right text-lg font-bold tabular-nums text-foreground">
              {step.unavailable ? (
                <span className="text-sm font-semibold text-muted-foreground">—</span>
              ) : step.value != null ? (
                formatNumber(step.value)
              ) : (
                "—"
              )}
            </p>
          </li>
        ))}
      </ul>

      <div className="order-1 flex flex-col items-center justify-start gap-4 lg:order-2">
        <ClassicFunnelSvg
          geometry={geo}
          bottleneckTransitionIndex={bnIdx !== null && bnIdx >= 0 ? bnIdx : null}
        />
        <p className="max-w-[260px] text-center text-[10px] leading-relaxed text-muted-foreground">
          Largura de cada faixa proporcional ao volume da etapa em relação às impressões (base do funil).
        </p>
      </div>

      <div className="order-3 space-y-0">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Taxas entre etapas
        </p>
        {model.transitions.map((t) => (
          <TransitionRow key={t.key} t={t} spend={spend} summary={summary} compact />
        ))}
      </div>
    </div>
  );
}

function TransitionRow({
  t,
  spend,
  summary,
  compact,
}: {
  t: FunnelTransition;
  spend: number;
  summary: MarketingDashboardSummary;
  compact?: boolean;
}) {
  const rateText = formatTransitionRate(t.ratePct);
  const isBn = t.isBottleneck;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex flex-col gap-1 border-b border-border/35 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
            compact && "py-2.5"
          )}
        >
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-wide",
                isBn ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground"
              )}
            >
              {t.displayLabel}
            </p>
            {t.isExpansion && t.ratePct != null ? (
              <p className="mt-0.5 text-[10px] text-violet-700 dark:text-violet-300">
                Etapa seguinte maior que a anterior
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex min-h-[28px] min-w-[4.5rem] items-center justify-center rounded-lg border px-2.5 py-1 text-sm font-bold tabular-nums",
                isBn && "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-50",
                !isBn && t.isExpansion && "border-violet-500/30 bg-violet-500/[0.08]",
                !isBn && !t.isExpansion && "border-border/50 bg-muted/30"
              )}
            >
              {rateText}
            </span>
          </div>
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
  );
}

function HybridLayout({
  model,
  spend,
  summary,
}: {
  model: AdaptiveFunnelModel;
  spend: number;
  summary: MarketingDashboardSummary;
}) {
  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-xs leading-relaxed text-foreground/90">
        <span className="font-semibold text-violet-950 dark:text-violet-100">Fluxo híbrido.</span>{" "}
        Algumas etapas usam eventos de origens diferentes ou volumes não decrescentes — a leitura é por
        volume absoluto e taxas reais, sem forçar um funil visual.
      </div>

      <div className="space-y-0">
        {model.steps.map((step, i) => (
          <div key={step.id} className="space-y-0">
            <HybridStepRow step={step} scaleMax={model.scaleMax} spend={spend} summary={summary} />
            {i < model.transitions.length ? (
              <div className="relative ml-0 border-l-2 border-muted pl-4 sm:ml-6 sm:pl-5">
                <div className="py-3">
                  <TransitionRow t={model.transitions[i]} spend={spend} summary={summary} />
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function HybridStepRow({
  step,
  scaleMax,
  spend,
  summary,
}: {
  step: FunnelStep;
  scaleMax: number;
  spend: number;
  summary: MarketingDashboardSummary;
}) {
  const v = step.value;
  const barPct =
    v != null && v > 0 && scaleMax > 0 ? Math.min(100, Math.max(6, (v / scaleMax) * 100)) : 0;

  const tooltipExtra =
    step.id === "lead" && spend > 0 && summary.leads > 0
      ? `CPL ≈ ${formatSpend(spend / summary.leads)}`
      : step.id === "pur" && spend > 0 && summary.purchases > 0
        ? `Custo/compra ≈ ${formatSpend(spend / summary.purchases)}`
        : spend > 0 && v != null && v > 0
          ? `${formatSpend(spend / v)} por unidade (gasto ÷ volume)`
          : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "rounded-2xl border bg-card p-4 shadow-sm sm:p-5",
            step.unavailable
              ? "border-dashed border-muted-foreground/35 bg-muted/15"
              : "border-border/55"
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="min-w-0 shrink-0 sm:w-52">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {step.short}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{step.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {step.unavailable ? (
                  <span className="text-base font-semibold text-muted-foreground">—</span>
                ) : v != null ? (
                  formatNumber(v)
                ) : (
                  "—"
                )}
              </p>
              {step.unavailable ? (
                <p className="mt-1 text-[10px] text-muted-foreground">Meta não retornou</p>
              ) : null}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-2.5 overflow-hidden rounded-full bg-muted/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary/90 to-primary/50"
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Magnitude em relação ao maior volume do período
              </p>
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] leading-snug">
        <p className="font-semibold">{step.label}</p>
        {tooltipExtra ? <p className="mt-1 text-xs text-muted-foreground">{tooltipExtra}</p> : null}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Fluxo de conversão: modo funil clássico (SVG) quando volumes decrescem; modo híbrido (lista) caso contrário.
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

  const modeLabel = model.mode === "classic" ? "Funil clássico" : "Fluxo híbrido";
  const ModeIcon = model.mode === "classic" ? Filter : GitBranch;

  const footerNote =
    model.mode === "classic"
      ? "Funil proporcional às impressões; taxas ao lado refletem a divisão real entre etapas."
      : "Taxas podem ultrapassar 100% quando a etapa seguinte não é subconjunto estrito da anterior.";

  return (
    <section
      className={cn(
        "rounded-2xl border border-border/55 bg-gradient-to-b from-card via-card to-muted/[0.12] p-4 shadow-[var(--shadow-surface)] sm:p-6",
        className
      )}
    >
      <header className="flex flex-col gap-4 border-b border-border/40 pb-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary/80">
              Fluxo de conversão
            </p>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Do topo ao fundo do funil
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Etapas da Meta e taxas entre volumes consecutivos. O layout adapta-se automaticamente quando
              os dados não formam um funil estritamente decrescente.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Pill className="border-primary/25 bg-primary/5 text-primary">
            <ModeIcon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            <span className="truncate">{modeLabel}</span>
          </Pill>
          {model.bottleneckBadge ? (
            <Pill className="border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-50">
              <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">Gargalo: {model.bottleneckBadge}</span>
            </Pill>
          ) : (
            <Pill className="border-border/50 bg-muted/30 text-muted-foreground">
              <span className="truncate">Sem gargalo único identificado</span>
            </Pill>
          )}
        </div>

        <p className="text-sm font-medium leading-snug text-foreground">{model.bottleneckLine}</p>
      </header>

      {model.mode === "classic" ? (
        <ClassicLayout model={model} spend={spend} summary={summary} />
      ) : (
        <HybridLayout model={model} spend={spend} summary={summary} />
      )}

      <footer className="mt-8 border-t border-border/35 pt-4">
        <p className="text-center text-[10px] leading-relaxed text-muted-foreground sm:text-left">
          {footerNote}
        </p>
      </footer>
    </section>
  );
}
