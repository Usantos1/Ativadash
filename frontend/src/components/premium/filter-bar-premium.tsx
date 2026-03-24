import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/** Faixa de filtros com aparência de produto analítico (não “form genérico”). */
export function FilterBarPremium({
  label = "Contexto",
  children,
  footer,
  className,
  sticky,
}: {
  label?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Gruda abaixo da topbar em viewports largas (cockpit operacional). */
  sticky?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-gradient-to-b from-card via-card to-muted/20 shadow-[var(--shadow-surface)]",
        sticky &&
          "lg:sticky lg:top-[calc(3rem+0.75rem+env(safe-area-inset-top,0px))] lg:z-10 lg:backdrop-blur-md lg:supports-[backdrop-filter]:bg-card/92",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-4 py-2.5 sm:px-5">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5 text-primary/70" aria-hidden />
          {label}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:p-5">
        {children}
      </div>
      {footer ? (
        <div className="border-t border-border/40 bg-muted/10 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground sm:px-5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
