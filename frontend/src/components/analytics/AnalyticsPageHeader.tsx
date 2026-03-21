import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PageHeaderPremium, type BreadcrumbItem } from "@/components/premium";

/** Cabeçalho de página alinhado ao design premium (delega a `PageHeaderPremium`). */
export function AnalyticsPageHeader({
  title,
  subtitle,
  meta,
  actions,
  className,
  eyebrow,
  breadcrumbs,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  eyebrow?: string;
  breadcrumbs?: BreadcrumbItem[];
}) {
  return (
    <PageHeaderPremium
      eyebrow={eyebrow}
      breadcrumbs={breadcrumbs}
      title={title}
      subtitle={subtitle}
      meta={meta}
      actions={actions}
      className={cn("border-b border-border/50", className)}
    />
  );
}
