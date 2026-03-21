import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Container para gráficos: cabeçalho editorial + área com respiro. */
export function ChartPanelPremium({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-surface)]",
        className
      )}
    >
      <div className="flex flex-col gap-1 border-b border-border/50 bg-gradient-to-r from-muted/30 via-transparent to-transparent px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className={cn("p-4 sm:p-5", contentClassName)}>{children}</div>
    </div>
  );
}
