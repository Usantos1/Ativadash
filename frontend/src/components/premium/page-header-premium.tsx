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
}: {
  /** Linha muito discreta acima do título (ex.: módulo) */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-4 pb-6", className)}>
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

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          {eyebrow ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary/80">{eyebrow}</p>
          ) : null}
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem] sm:leading-tight lg:text-[1.85rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
              {subtitle}
            </p>
          ) : null}
          {meta ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
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
