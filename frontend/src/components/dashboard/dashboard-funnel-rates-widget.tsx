import { GitBranch, TrendingDown } from "lucide-react";
import { formatPercent } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { AdaptiveFunnelModel, FunnelTransition } from "./funnel-flow.logic";

function formatRate(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  if (pct > 999) return ">999%";
  return formatPercent(pct, 2);
}

function shortTransitionLabel(t: FunnelTransition): string {
  const map: Record<string, string> = {
    "imp-clk": "CTR",
    "clk-conv": "Cliques → conv.",
    "clk-link": "Clique → link",
    "clk-lpv": "Cliques → LPV",
    "link-lpv": "Link → LPV",
    "lpv-lead": "LPV → leads",
    "lpv-cart": "LPV → carrinho",
    "cart-chk": "Carrinho → checkout",
    "lead-chk": "Lead → checkout",
    "chk-pur": "Checkout → compra",
  };
  return map[t.key] ?? t.displayLabel;
}

const PLATFORM_HEADER = {
  meta: { className: "text-[#1877F2]", label: "Meta" },
  google: { className: "text-[#34A853]", label: "Google" },
} as const;

/** Taxas entre etapas — visual executivo, sem texto consultivo. */
export function DashboardFunnelRatesWidget({
  model,
  platform,
  className,
}: {
  model: AdaptiveFunnelModel;
  platform: "meta" | "google";
  className?: string;
}) {
  const bnIdx =
    model.bottleneckKey == null
      ? -1
      : model.transitions.findIndex((t) => t.key === model.bottleneckKey);

  const ph = PLATFORM_HEADER[platform];

  return (
    <section
      className={cn(
        "flex h-full flex-col rounded-xl border border-border/40 bg-card/60 p-4 shadow-sm sm:p-5",
        className
      )}
    >
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-border/30 pb-2.5">
        <div>
          <p className={cn("text-[10px] font-semibold uppercase tracking-[0.14em]", ph.className)}>{ph.label}</p>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Taxas entre etapas</h2>
        </div>
        {model.bottleneckBadge ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] font-semibold text-amber-950 dark:text-amber-100">
            <TrendingDown className="h-3 w-3 shrink-0" aria-hidden />
            {model.bottleneckBadge}
          </span>
        ) : null}
      </header>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2">
        {bnIdx >= 0 && model.transitions[bnIdx]?.ratePct != null ? (
          <p className="text-center text-[11px] tabular-nums text-muted-foreground">
            Taxa no gargalo:{" "}
            <span className="font-semibold text-foreground">{formatRate(model.transitions[bnIdx]!.ratePct)}</span>
          </p>
        ) : null}

        <ul className="space-y-0.5 rounded-lg bg-muted/20 p-1">
          {model.transitions.map((t) => {
            const isBn = t.key === model.bottleneckKey;
            return (
              <li
                key={t.key}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-[13px]",
                  isBn && "bg-amber-500/[0.1]"
                )}
              >
                <span className="min-w-0 font-medium text-foreground">{shortTransitionLabel(t)}</span>
                <span className="shrink-0 tabular-nums text-sm font-semibold text-foreground">
                  {formatRate(t.ratePct)}
                </span>
              </li>
            );
          })}
        </ul>

        {model.mode === "hybrid" ? (
          <p className="mt-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <GitBranch className="h-3 w-3 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            Híbrido: taxas reais; funil só referência visual.
          </p>
        ) : null}
      </div>
    </section>
  );
}
