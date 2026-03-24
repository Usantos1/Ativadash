import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricDeltaValue = {
  pct: number;
  label?: string;
};

/** Delta percentual reutilizável (KPIs, insights, tabelas). */
export function MetricDelta({ delta, invert, className }: { delta: MetricDeltaValue; invert?: boolean; className?: string }) {
  const raw = delta.pct;
  const good = invert ? raw < 0 : raw > 0;
  const bad = invert ? raw > 0 : raw < 0;
  const Icon = Math.abs(raw) < 0.05 ? Minus : good ? TrendingUp : bad ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        good && "bg-emerald-500/14 text-emerald-800 dark:text-emerald-300",
        bad && "bg-rose-500/14 text-rose-800 dark:text-rose-300",
        !good && !bad && "bg-muted/80 text-muted-foreground",
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {raw >= 0 ? "+" : ""}
      {raw.toFixed(1)}%
      {delta.label ? <span className="ml-0.5 font-normal opacity-80">{delta.label}</span> : null}
    </span>
  );
}
