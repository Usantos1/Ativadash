import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AnalyticsPageHeader({
  title,
  subtitle,
  meta,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  /** Linha secundária: período, sync, badges */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-start md:justify-between",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.65rem] md:leading-tight">
            {title}
          </h1>
        </div>
        {subtitle ? (
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        ) : null}
        {meta ? <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">{actions}</div>
      ) : null}
    </header>
  );
}
