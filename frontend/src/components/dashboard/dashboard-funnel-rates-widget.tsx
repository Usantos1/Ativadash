import { useMemo } from "react";
import { GitBranch, TrendingDown } from "lucide-react";
import { formatPercent } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import { buildAdaptiveFunnelModel, type FunnelTransition } from "./funnel-flow.logic";

function formatRate(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  if (pct > 999) return ">999%";
  return formatPercent(pct, 2);
}

function shortTransitionLabel(t: FunnelTransition): string {
  const map: Record<string, string> = {
    "imp-clk": "CTR",
    "clk-link": "Clique → link",
    "link-lpv": "Link → LPV",
    "lpv-lead": "LPV → lead",
    "lead-chk": "Lead → checkout",
    "chk-pur": "Checkout → compra",
  };
  return map[t.key] ?? t.displayLabel;
}

/**
 * Painel complementar ao funil: gargalo principal + taxas-chave + nota de fluxo híbrido.
 */
export function DashboardFunnelRatesWidget({
  summary,
  className,
}: {
  summary: MarketingDashboardSummary;
  className?: string;
}) {
  const model = useMemo(() => buildAdaptiveFunnelModel(summary), [summary]);
  const bnIdx =
    model.bottleneckKey == null
      ? -1
      : model.transitions.findIndex((t) => t.key === model.bottleneckKey);

  return (
    <section
      className={cn(
        "flex h-full flex-col rounded-xl border border-border/50 bg-card/80 p-4 shadow-[var(--shadow-surface)] sm:p-5",
        className
      )}
    >
      <header className="border-b border-border/35 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary/80">Conversão</p>
        <h2 className="mt-0.5 text-lg font-bold tracking-tight text-foreground">Gargalos e taxas-chave</h2>
      </header>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
        <div
          className={cn(
            "rounded-lg border px-3 py-2.5",
            model.bottleneckBadge
              ? "border-amber-500/35 bg-amber-500/[0.07]"
              : "border-border/45 bg-muted/20"
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Gargalo principal</p>
          {model.bottleneckBadge ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <TrendingDown className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              {model.bottleneckBadge}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Nenhuma queda relativa destacada no período.</p>
          )}
          {bnIdx >= 0 && model.transitions[bnIdx]?.ratePct != null ? (
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              Taxa nesta etapa:{" "}
              <span className="font-semibold text-foreground">{formatRate(model.transitions[bnIdx]!.ratePct)}</span>
            </p>
          ) : null}
        </div>

        <ul className="space-y-0.5 rounded-lg border border-border/40 bg-muted/15 p-1">
          {model.transitions.map((t) => {
            const isBn = t.key === model.bottleneckKey;
            return (
              <li
                key={t.key}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm",
                  isBn && "bg-amber-500/[0.08]"
                )}
              >
                <span className="min-w-0 font-medium leading-snug text-foreground">{shortTransitionLabel(t)}</span>
                <span className="shrink-0 tabular-nums text-sm font-bold text-foreground">{formatRate(t.ratePct)}</span>
              </li>
            );
          })}
        </ul>

        {model.mode === "hybrid" ? (
          <div className="mt-auto rounded-lg border border-violet-500/25 bg-violet-500/[0.06] px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-900 dark:text-violet-200">
              <GitBranch className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
              Fluxo híbrido
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Algumas etapas superam a anterior (eventos diferentes na Meta). As taxas acima são reais; a silhueta do
              funil segue afunilada só para leitura visual.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
