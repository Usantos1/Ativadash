import { cn } from "@/lib/utils";
import type { DashboardChannelMetric } from "./build-channel-performance-layout";
import { DashboardMetricTile } from "./ChannelPerformanceBody";

export function ConsolidatedSummaryGrid({
  title,
  items,
  className,
}: {
  title: string;
  items: DashboardChannelMetric[];
  className?: string;
}) {
  const n = items.length;
  const grid =
    n <= 4
      ? "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4"
      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";

  return (
    <section className={cn("space-y-3", className)}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      <div className={cn("grid gap-3", grid)}>
        {items.map((m) => (
          <DashboardMetricTile key={m.label} m={m} />
        ))}
      </div>
    </section>
  );
}
