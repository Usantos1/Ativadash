import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashboardPremiumSection({
  id,
  eyebrow,
  title,
  description,
  aside,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-2 px-0.5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">{eyebrow}</p>
          ) : null}
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
          {description ? (
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{description}</p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}
