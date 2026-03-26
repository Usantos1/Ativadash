import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Destaque visual opcional (ex.: conta padrão) */
  variant?: "default" | "highlight";
};

export function IntegrationConfigCard({ title, description, children, className, variant = "default" }: Props) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card p-6 shadow-sm sm:p-7",
        variant === "highlight"
          ? "border-primary/25 bg-gradient-to-br from-primary/[0.04] to-card ring-1 ring-primary/10"
          : "border-border/60",
        className
      )}
    >
      <div className="border-b border-border/50 pb-4 sm:pb-5">
        <h2 className="text-base font-bold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      <div className="pt-6">{children}</div>
    </section>
  );
}
