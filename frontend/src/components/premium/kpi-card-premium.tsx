import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

export type KpiDelta = {
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
        good && "bg-emerald-500/14 text-emerald-800 dark:text-emerald-300",
        bad && "bg-rose-500/14 text-rose-800 dark:text-rose-300",
        !good && !bad && "bg-muted/80 text-muted-foreground"
      )}
    >
      <Icon className="h-3 w-3" />
      {raw >= 0 ? "+" : ""}
      {raw.toFixed(1)}%
      {delta.label ? <span className="ml-0.5 font-normal opacity-80">{delta.label}</span> : null}
    </span>
  );
}

export type KpiCardVariant = "primary" | "secondary" | "compact";

const variantShell: Record<KpiCardVariant, string> = {
  primary:
    "rounded-2xl border border-border/55 border-l-[3px] border-l-primary/70 bg-gradient-to-br from-card via-card to-muted/[0.35] p-4 pl-[1.05rem] shadow-[var(--shadow-surface)] ring-1 ring-black/[0.03] dark:border-l-primary/55 dark:ring-white/[0.04]",
  secondary:
    "rounded-xl border border-border/60 bg-gradient-to-b from-card to-card/90 p-4 shadow-sm transition-[box-shadow,border-color] hover:border-border hover:shadow-[var(--shadow-surface-sm)]",
  compact:
    "rounded-xl border border-border/55 bg-card/95 p-3 shadow-sm transition-[box-shadow,border-color] hover:border-border/80 hover:shadow-[var(--shadow-surface-sm)]",
};

/** KPI com hierarquia clara: principal (executivo), secundário ou compacto (operacional). */
export function KpiCardPremium({
  variant = "secondary",
  label,
  value,
  hint,
  source,
  icon: Icon,
  delta,
  deltaInvert,
  loading,
  className,
}: {
  variant?: KpiCardVariant;
  label: string;
  value: ReactNode;
  hint?: string;
  source?: string;
  icon?: ComponentType<{ className?: string }>;
  delta?: KpiDelta;
  deltaInvert?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const isPrimary = variant === "primary";
  const isCompact = variant === "compact";

  if (loading) {
    return (
      <div className={cn(variantShell[variant], "animate-pulse", className)}>
        <div className="flex items-start justify-between gap-2">
          <div className="h-3 w-24 rounded bg-muted/80" />
          <div className="h-4 w-4 rounded bg-muted/80" />
        </div>
        <div className={cn("mt-3 rounded bg-muted/90", isPrimary ? "h-8 w-32" : isCompact ? "h-6 w-28" : "h-7 w-36")} />
        <div className="mt-3 h-3 w-20 rounded bg-muted/60" />
      </div>
    );
  }

  return (
    <div className={cn(variantShell[variant], "group flex flex-col", className)}>
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "font-semibold uppercase tracking-[0.08em] text-muted-foreground",
            isPrimary && "text-[11px]",
            isCompact && "text-[10px]",
            !isPrimary && !isCompact && "text-[11px]"
          )}
        >
          {label}
        </span>
        {Icon ? (
          <Icon
            className={cn(
              "shrink-0 text-muted-foreground/55 transition-colors group-hover:text-primary/70",
              isCompact ? "h-3.5 w-3.5" : "h-4 w-4"
            )}
          />
        ) : null}
      </div>
      <div
        className={cn(
          "mt-2 font-bold tabular-nums tracking-tight text-foreground",
          isPrimary && "text-2xl sm:text-[1.65rem]",
          isCompact && "text-lg",
          !isPrimary && !isCompact && "text-2xl"
        )}
      >
        {value}
      </div>
      <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-2">
        {delta ? <DeltaBadge delta={delta} invert={deltaInvert} /> : null}
        {source ? (
          <span className="text-[10px] font-medium text-muted-foreground/85">Fonte · {source}</span>
        ) : null}
      </div>
      {hint ? (
        <p
          className={cn(
            "mt-1.5 leading-snug text-muted-foreground",
            isCompact ? "text-[10px]" : "text-[11px]"
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
