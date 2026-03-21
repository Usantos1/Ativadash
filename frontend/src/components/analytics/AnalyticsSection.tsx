import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AnalyticsSection({
  title,
  description,
  actions,
  children,
  className,
  dense = false,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-2 border-b border-border/60 bg-muted/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5",
          dense && "py-2.5"
        )}
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className={cn("p-4 sm:p-5", dense && "p-3 sm:p-4")}>{children}</div>
    </section>
  );
}
