import { GitBranch, TrendingDown } from "lucide-react";
import { formatPercent, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { AdaptiveFunnelModel, FunnelTransition } from "./funnel-flow.logic";

function formatRate(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  if (pct > 999) return ">999%";
  return formatPercent(pct, 2);
}

function formatCost(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return formatSpend(value);
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

/** Rótulo descritivo do custo por unidade da etapa destino da transição. */
function costLabelForTransition(t: FunnelTransition): string {
  const toId = t.to.id;
  switch (toId) {
    case "clk":
      return "CPC";
    case "lpv":
      return "Custo/LPV";
    case "lead":
      return "CPL";
    case "chk":
      return "Custo/checkout";
    case "pur":
      return "CPA";
    case "cart":
      return "Custo/carrinho";
    case "link":
      return "Custo/link";
    case "conv":
      return "Custo/conv.";
    default:
      return `Custo/${t.to.label.toLowerCase()}`;
  }
}

const PLATFORM_HEADER = {
  meta: { className: "text-[#1877F2]", label: "Meta" },
  google: { className: "text-[#34A853]", label: "Google" },
} as const;

type KpiItem = { label: string; value: string; hint?: string };

/** Painel de taxas (CTR etc.) + custos (CPM, CPC, CPL, CPA) entre etapas do funil. */
export function DashboardFunnelRatesWidget({
  model,
  platform,
  className,
  spend = 0,
}: {
  model: AdaptiveFunnelModel;
  platform: "meta" | "google";
  className?: string;
  /** Investimento total no período (BRL) para calcular CPM, CPC, CPL, CPA. */
  spend?: number;
}) {
  const bnIdx =
    model.bottleneckKey == null
      ? -1
      : model.transitions.findIndex((t) => t.key === model.bottleneckKey);

  const ph = PLATFORM_HEADER[platform];

  const stepValue = new Map<string, number>();
  for (const s of model.steps) {
    if (s.value != null && Number.isFinite(s.value)) stepValue.set(s.id, s.value);
  }

  const impressions = stepValue.get("imp") ?? 0;
  const clicks = stepValue.get("clk") ?? 0;
  const leads = stepValue.get("lead") ?? 0;
  const purchases = stepValue.get("pur") ?? 0;

  const ctrPct = impressions > 0 ? (clicks / impressions) * 100 : null;
  const cpm = impressions > 0 && spend > 0 ? (spend / impressions) * 1000 : null;
  const cpc = clicks > 0 && spend > 0 ? spend / clicks : null;
  const cpl = leads > 0 && spend > 0 ? spend / leads : null;
  const cpa = purchases > 0 && spend > 0 ? spend / purchases : null;

  const kpis: KpiItem[] = [];
  if (ctrPct != null) kpis.push({ label: "CTR", value: formatRate(ctrPct), hint: "Cliques ÷ Impressões" });
  if (cpc != null) kpis.push({ label: "CPC", value: formatCost(cpc), hint: "Custo por clique" });
  if (cpm != null) kpis.push({ label: "CPM", value: formatCost(cpm), hint: "Custo por mil impressões" });
  if (cpl != null) kpis.push({ label: "CPL", value: formatCost(cpl), hint: "Custo por lead" });
  if (cpa != null) kpis.push({ label: "CPA", value: formatCost(cpa), hint: "Custo por compra" });

  function costPerDestination(t: FunnelTransition): number | null {
    if (spend <= 0) return null;
    const v = t.to.value;
    if (v == null || !Number.isFinite(v) || v <= 0) return null;
    return spend / v;
  }

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
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Taxas e custos por etapa</h2>
        </div>
        {model.bottleneckBadge ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] font-semibold text-amber-950 dark:text-amber-100">
            <TrendingDown className="h-3 w-3 shrink-0" aria-hidden />
            {model.bottleneckBadge}
          </span>
        ) : null}
      </header>

      {kpis.length > 0 ? (
        <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(84px,1fr))]">
          {kpis.map((k) => (
            <div
              key={k.label}
              title={k.hint}
              className="rounded-lg border border-border/45 bg-muted/30 px-2.5 py-1.5"
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{k.label}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums tracking-tight text-foreground">{k.value}</p>
            </div>
          ))}
        </div>
      ) : null}

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
            const cost = costPerDestination(t);
            const costLabel = costLabelForTransition(t);
            return (
              <li
                key={t.key}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-[13px]",
                  isBn && "bg-amber-500/[0.1]"
                )}
              >
                <span className="min-w-0 font-medium text-foreground">{shortTransitionLabel(t)}</span>
                <div className="flex shrink-0 items-baseline gap-3 tabular-nums">
                  <span className="text-sm font-semibold text-foreground">{formatRate(t.ratePct)}</span>
                  {cost != null ? (
                    <span
                      className="text-[11px] font-medium text-muted-foreground"
                      title={`${costLabel}: investimento ÷ ${t.to.label.toLowerCase()}`}
                    >
                      {costLabel} {formatCost(cost)}
                    </span>
                  ) : null}
                </div>
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
