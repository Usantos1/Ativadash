import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MetricDelta, type MetricDeltaValue } from "@/components/premium/metric-delta";

/** Insight acionável: leitura rápida + link opcional. */
export function InsightCard({
  icon: Icon,
  title,
  description,
  delta,
  deltaInvert,
  href,
  linkLabel = "Abrir",
  className,
  tone = "default",
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  delta?: MetricDeltaValue;
  deltaInvert?: boolean;
  href?: string;
  linkLabel?: string;
  className?: string;
  tone?: "default" | "primary" | "muted";
}) {
  const shell =
    tone === "primary"
      ? "border-primary/20 bg-gradient-to-br from-primary/[0.07] to-card"
      : tone === "muted"
        ? "border-border/50 bg-muted/20"
        : "border-border/55 bg-card";

  const inner = (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-2xl border p-4 shadow-[var(--shadow-surface-sm)] transition-[box-shadow,border-color,transform] duration-200 hover:border-border hover:shadow-md sm:p-5",
        shell,
        href && "cursor-pointer hover:-translate-y-[1px]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.1] text-primary ring-1 ring-primary/15">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-foreground">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        {href ? (
          <ArrowUpRight
            className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden
          />
        ) : null}
      </div>
      {delta ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <MetricDelta delta={delta} invert={deltaInvert} />
        </div>
      ) : null}
      {href ? (
        <span className="text-xs font-semibold text-primary underline-offset-4 group-hover:underline">{linkLabel}</span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link to={href} className={cn("block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl", className)}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
