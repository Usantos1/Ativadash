import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

export type KpiDelta = {
  /** Variação percentual vs período anterior (positivo = melhora conforme contexto) */
  pct: number;
  label?: string;
};

function DeltaBadge({ delta, invert }: { delta: KpiDelta; invert?: boolean }) {
  const raw = delta.pct;
  const good = invert ? raw < 0 : raw > 0;
  const bad = invert ? raw > 0 : raw < 0;
  const Icon = Math.abs(raw) < 0.05 ? Minus : good ? TrendingUp : bad ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        good && "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
        bad && "bg-rose-500/12 text-rose-700 dark:text-rose-400",
        !good && !bad && "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="h-3 w-3" />
      {raw >= 0 ? "+" : ""}
      {raw.toFixed(1)}%
      {delta.label ? <span className="ml-0.5 font-normal opacity-80">{delta.label}</span> : null}
    </span>
  );
}

/** KPI denso, hierarquia clara — uso em dashboards premium. */
export function KpiPremium({
  label,
  value,
  hint,
  source,
  icon: Icon,
  delta,
  deltaInvert,
  size = "md",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Origem do dado (ex.: Meta, Google, modelo) */
  source?: string;
  icon?: ComponentType<{ className?: string }>;
  delta?: KpiDelta;
  /** true = queda percentual é “boa” (ex.: CPA) */
  deltaInvert?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const dense = size === "sm";
  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border border-border/70 bg-gradient-to-b from-card to-card/95 p-4 shadow-sm transition-shadow hover:border-border hover:shadow-md",
        dense && "p-3",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "font-medium uppercase tracking-wide text-muted-foreground",
            dense ? "text-[10px]" : "text-[11px]"
          )}
        >
          {label}
        </span>
        {Icon ? (
          <Icon className={cn("shrink-0 text-muted-foreground/70", dense ? "h-3.5 w-3.5" : "h-4 w-4")} />
        ) : null}
      </div>
      <div
        className={cn(
          "mt-2 font-semibold tabular-nums tracking-tight text-foreground",
          dense ? "text-lg" : "text-2xl"
        )}
      >
        {value}
      </div>
      <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-2">
        {delta ? <DeltaBadge delta={delta} invert={deltaInvert} /> : null}
        {source ? (
          <span className="text-[10px] text-muted-foreground/80">Fonte: {source}</span>
        ) : null}
      </div>
      {hint ? (
        <p className={cn("mt-1.5 leading-snug text-muted-foreground", dense ? "text-[10px]" : "text-[11px]")}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
