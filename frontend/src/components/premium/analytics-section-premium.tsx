import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Seção analítica: leitura de “painel”, não card solto. */
export function AnalyticsSection({
  title,
  description,
  actions,
  children,
  className,
  dense = false,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  dense?: boolean;
  /** Rótulo muito curto acima do título (ex.: faixa 1) */
  eyebrow?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/55 bg-card shadow-[var(--shadow-surface)] ring-1 ring-black/[0.02] dark:ring-white/[0.03]",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-2 border-b border-border/50 bg-gradient-to-r from-muted/35 via-transparent to-muted/20 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5",
          dense && "py-3"
        )}
      >
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary/75">{eyebrow}</p>
          ) : null}
          <h2 className="text-[0.9375rem] font-bold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className={cn("p-4 sm:p-5", dense && "p-3.5 sm:p-4")}>{children}</div>
    </section>
  );
}
