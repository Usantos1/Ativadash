import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = { label: string; href?: string };

/** Cabeçalho de página executivo: hierarquia forte, metadata e ações. */
export function PageHeaderPremium({
  eyebrow,
  title,
  subtitle,
  breadcrumbs,
  meta,
  actions,
  className,
  variant = "default",
}: {
  /** Linha muito discreta acima do título (ex.: módulo) */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** `dense`: tipografia e espaçamento menores (telas operacionais). */
  variant?: "default" | "dense";
}) {
  const dense = variant === "dense";
  return (
    <header className={cn(dense ? "space-y-2 pb-4" : "space-y-4 pb-6", className)}>
      {breadcrumbs?.length ? (
        <nav className="flex flex-wrap items-center gap-1 text-[11px] font-medium text-muted-foreground">
          {breadcrumbs.map((b, i) => (
            <span key={`${b.label}-${i}`} className="flex items-center gap-1">
              {i > 0 ? <ChevronRight className="h-3 w-3 opacity-50" aria-hidden /> : null}
              {b.href ? (
                <Link to={b.href} className="hover:text-foreground">
                  {b.label}
                </Link>
              ) : (
                <span className="text-foreground">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      <div className={cn("flex flex-col lg:flex-row lg:items-start lg:justify-between", dense ? "gap-3" : "gap-5")}>
        <div className={cn("min-w-0 flex-1", dense ? "space-y-1" : "space-y-2")}>
          {eyebrow ? (
            <p
              className={cn(
                "font-bold uppercase tracking-[0.14em] text-primary/80",
                dense ? "text-[10px]" : "text-[11px]"
              )}
            >
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={cn(
              "text-balance font-bold tracking-tight text-foreground",
              dense
                ? "text-lg sm:text-xl sm:leading-snug"
                : "text-2xl sm:text-[1.75rem] sm:leading-tight lg:text-[1.85rem]"
            )}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              className={cn(
                "max-w-3xl text-muted-foreground",
                dense ? "text-xs leading-normal" : "text-sm leading-relaxed sm:text-[0.9375rem]"
              )}
            >
              {subtitle}
            </p>
          ) : null}
          {meta ? (
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/50 text-muted-foreground",
                dense ? "pt-2 text-[11px]" : "pt-3 text-xs"
              )}
            >
              {meta}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
