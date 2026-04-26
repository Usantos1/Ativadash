import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusBadgeTone =
  | "active"
  | "connected"
  | "healthy"
  | "alert"
  | "roadmap"
  | "disconnected"
  | "neutral";

const toneClass: Record<StatusBadgeTone, string> = {
  active: "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-800 dark:text-emerald-300",
  connected: "border-sky-500/25 bg-sky-500/[0.08] text-sky-900 dark:text-sky-200",
  healthy: "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
  alert: "border-amber-500/35 bg-amber-500/[0.1] text-amber-950 dark:text-amber-100",
  roadmap: "border-border bg-muted/50 text-muted-foreground",
  disconnected: "border-border/80 bg-muted/30 text-muted-foreground",
  neutral: "border-border/70 bg-background text-foreground",
};

/** Badges de status consistentes em todo o produto. */
export function StatusBadge({
  tone,
  children,
  className,
  dot,
}: {
  tone: StatusBadgeTone;
  children: ReactNode;
  className?: string;
  /** Ponto indicador à esquerda */
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        toneClass[tone],
        className
      )}
    >
      {dot ? (
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            tone === "healthy" || tone === "active" || tone === "connected"
              ? "bg-emerald-500"
              : tone === "alert"
                ? "bg-amber-500"
                : tone === "roadmap" || tone === "disconnected"
                  ? "bg-muted-foreground/50"
                  : "bg-primary"
          )}
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}
