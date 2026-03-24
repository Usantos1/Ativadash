import type { ReactNode } from "react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: {
    border: "border-sky-500/25",
    bg: "bg-sky-500/[0.06] dark:bg-sky-950/25",
    icon: Info,
    iconClass: "text-sky-600 dark:text-sky-400",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/[0.08] dark:bg-amber-950/20",
    icon: AlertTriangle,
    iconClass: "text-amber-700 dark:text-amber-400",
  },
  critical: {
    border: "border-destructive/35",
    bg: "bg-destructive/[0.08]",
    icon: ShieldAlert,
    iconClass: "text-destructive",
  },
} as const;

/** Alerta operacional com peso visual claro. */
export function AlertCard({
  title,
  description,
  tone = "warning",
  action,
  className,
}: {
  title: string;
  description: string;
  tone?: keyof typeof tones;
  action?: ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-start sm:gap-4 sm:p-5",
        t.border,
        t.bg,
        className
      )}
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/80 ring-1 ring-black/[0.04] dark:ring-white/[0.06]", t.iconClass)}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {action ? <div className="mt-3 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
