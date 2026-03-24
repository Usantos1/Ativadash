import { cn } from "@/lib/utils";
import type { ChannelPerformanceLayout, PerfStat } from "./build-channel-performance-layout";
import { Skeleton } from "@/components/ui/skeleton";

function StatPrimaryHero({ stat }: { stat: PerfStat }) {
  const showDelta = stat.deltaPct != null && Number.isFinite(stat.deltaPct);
  const good = showDelta ? (stat.deltaInvert ? stat.deltaPct! <= 0 : stat.deltaPct! >= 0) : false;

  return (
    <div className="min-w-0 rounded-lg border border-border/30 bg-background/40 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">{stat.value}</p>
      {showDelta ? (
        <p
          className={cn(
            "mt-0.5 text-[10px] font-semibold tabular-nums",
            good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}
        >
          {stat.deltaPct! >= 0 ? "+" : ""}
          {stat.deltaPct!.toFixed(1)}% vs período ant.
        </p>
      ) : null}
    </div>
  );
}

function StatCompact({ stat, dense }: { stat: PerfStat; dense?: boolean }) {
  const showDelta = stat.deltaPct != null && Number.isFinite(stat.deltaPct);
  const good = showDelta ? (stat.deltaInvert ? stat.deltaPct! <= 0 : stat.deltaPct! >= 0) : false;

  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
      <p
        className={cn(
          "mt-0.5 truncate font-bold tabular-nums text-foreground",
          dense ? "text-sm sm:text-base" : "text-base sm:text-lg"
        )}
      >
        {stat.value}
      </p>
      {showDelta ? (
        <p
          className={cn(
            "mt-0.5 text-[9px] font-semibold tabular-nums",
            good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}
        >
          {stat.deltaPct! >= 0 ? "+" : ""}
          {stat.deltaPct!.toFixed(1)}%
        </p>
      ) : null}
    </div>
  );
}

export function ChannelPerformanceBody({ layout }: { layout: ChannelPerformanceLayout }) {
  const spendRow = [layout.rowSpend, ...layout.rowEfficiency];
  const spendGrid =
    spendRow.length <= 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4";

  return (
    <div className="space-y-2 pt-0.5">
      <StatPrimaryHero stat={layout.primaryHero} />

      <div className={cn("grid gap-2 sm:gap-3", spendGrid)}>
        {spendRow.map((s, i) => (
          <StatCompact key={`spendrow-${s.label}-${i}`} stat={s} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 gap-x-2 sm:gap-x-3">
        <StatCompact stat={layout.rowTraffic[0]} dense />
        <StatCompact stat={layout.rowTraffic[1]} dense />
        <StatCompact stat={layout.rowTraffic[2]} dense />
      </div>
    </div>
  );
}

export function ChannelPerformanceBodySkeleton() {
  return (
    <div className="space-y-2 pt-0.5">
      <div className="rounded-lg border border-border/30 px-2.5 py-2">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="mt-2 h-9 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
