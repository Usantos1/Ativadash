import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Tabela ou lista densa dentro de cartão editorial (título + toolbar + corpo). */
export function TableCard({
  title,
  description,
  toolbar,
  footer,
  children,
  className,
  flush,
}: {
  title: string;
  description?: string;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Sem padding no corpo (tabela edge-to-edge). */
  flush?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-surface)] ring-1 ring-black/[0.02] dark:ring-white/[0.03]",
        className
      )}
    >
      <div className="flex flex-col gap-3 border-b border-border/50 bg-gradient-to-r from-muted/25 via-transparent to-transparent px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
          {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {toolbar ? <div className="flex shrink-0 flex-wrap items-center gap-2">{toolbar}</div> : null}
      </div>
      <div className={cn(!flush && "p-3 sm:p-4")}>{children}</div>
      {footer ? (
        <div className="border-t border-border/45 bg-muted/15 px-4 py-3 text-xs text-muted-foreground sm:px-5">{footer}</div>
      ) : null}
    </div>
  );
}
