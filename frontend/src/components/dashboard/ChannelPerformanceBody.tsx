import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ChannelPerformanceLayout, DashboardChannelMetric } from "./build-channel-performance-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { MetricHealth, MetricTrend } from "@/lib/metric-visual-signal";

function HealthDot({ health }: { health: MetricHealth }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        health === "good" && "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.55)]",
        health === "warn" && "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.45)]",
        health === "bad" && "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.45)]",
        health === "neutral" && "bg-muted-foreground/35"
      )}
      aria-hidden
    />
  );
}

function TrendIcon({ trend, deltaInvert }: { trend: MetricTrend; deltaInvert?: boolean }) {
  if (trend == null || trend === "flat") {
    return <Minus className="h-3 w-3 shrink-0 text-muted-foreground/60" aria-hidden />;
  }
  const up = trend === "up";
  const good = deltaInvert ? !up : up;
  return up ? (
    <ArrowUp
      className={cn(
        "h-3.5 w-3.5 shrink-0",
        good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      )}
      aria-hidden
    />
  ) : (
    <ArrowDown
      className={cn(
        "h-3.5 w-3.5 shrink-0",
        good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      )}
      aria-hidden
    />
  );
}

export function DashboardMetricTile({ m }: { m: DashboardChannelMetric }) {
  const showDelta = m.deltaPct != null && Number.isFinite(m.deltaPct);
  return (
    <div className="min-w-0 rounded-lg border border-border/35 bg-background/50 px-2.5 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <p className="truncate text-base font-bold tabular-nums text-foreground sm:text-lg">{m.value}</p>
        <HealthDot health={m.health} />
        <TrendIcon trend={m.trend} deltaInvert={m.deltaInvert} />
      </div>
      {showDelta ? (
        <p className="mt-0.5 text-[9px] font-semibold tabular-nums text-muted-foreground">
          {m.deltaPct! >= 0 ? "+" : ""}
          {m.deltaPct!.toFixed(1)}% vs ant.
        </p>
      ) : (
        <p className="mt-0.5 h-3 text-[9px] text-transparent">.</p>
      )}
    </div>
  );
}

function Block({
  title,
  children,
  cols,
}: {
  title: string;
  children: ReactNode;
  cols: string;
}) {
  return (
    <div className="rounded-xl border border-border/30 bg-muted/[0.06] p-2.5 sm:p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <div className={cn("grid gap-2", cols)}>{children}</div>
    </div>
  );
}

export function ChannelPerformanceBody({ layout }: { layout: ChannelPerformanceLayout }) {
  const perfCols =
    layout.performance.length >= 4
      ? "grid-cols-2 sm:grid-cols-4"
      : layout.performance.length === 3
        ? "grid-cols-3"
        : "grid-cols-2";
  const convCols =
    layout.conversion.length >= 3 ? "grid-cols-3" : layout.conversion.length === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <div className="space-y-2.5 pt-1">
      <Block title="Performance" cols={perfCols}>
        {layout.performance.map((m) => (
          <DashboardMetricTile key={m.label} m={m} />
        ))}
      </Block>
      <Block title="Tráfego" cols="grid-cols-3">
        {layout.traffic.map((m) => (
          <DashboardMetricTile key={m.label} m={m} />
        ))}
      </Block>
      <Block title="Conversão" cols={convCols}>
        {layout.conversion.map((m) => (
          <DashboardMetricTile key={m.label} m={m} />
        ))}
      </Block>
    </div>
  );
}

export function ChannelPerformanceBodySkeleton() {
  return (
    <div className="space-y-2.5 pt-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border/30 p-2.5">
          <Skeleton className="h-2 w-20" />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
