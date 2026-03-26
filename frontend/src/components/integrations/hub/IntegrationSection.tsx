import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function IntegrationSection({ title, description, children, className }: Props) {
  return (
    <section className={cn("space-y-5", className)}>
      <div className="flex flex-col gap-1 border-b border-border/50 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** @deprecated use IntegrationSection */
export const IntegrationHubSection = IntegrationSection;
