import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** KPI no estilo dashboard comercial (alinhado a Marketing). */
export function KpiStat({
  title,
  value,
  hint,
  icon: Icon,
  className,
}: {
  title: string;
  value: ReactNode;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[104px] flex-col rounded-lg border border-border/80 bg-card p-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground/80" />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</div>
      {hint ? <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

export function DashboardPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
