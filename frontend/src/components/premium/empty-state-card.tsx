import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Estado vazio com hierarquia de produto premium (não bloco solto). */
export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryAction,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-dashed border-border/70 bg-gradient-to-br from-card via-card to-muted/[0.2] shadow-[var(--shadow-surface-sm)] ring-1 ring-black/[0.02] dark:ring-white/[0.03]",
        className
      )}
    >
      <div className="flex flex-col items-center justify-center px-6 py-14 text-center sm:py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.1] shadow-inner ring-1 ring-primary/15">
          <Icon className="h-7 w-7 text-primary/80" aria-hidden />
        </div>
        <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">{title}</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
        {children}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {actionLabel && onAction ? (
            <Button className="rounded-full px-4 shadow-sm" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
          {secondaryAction}
        </div>
      </div>
    </div>
  );
}
