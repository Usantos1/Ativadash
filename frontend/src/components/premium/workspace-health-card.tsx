import type { ReactNode } from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge, type StatusBadgeTone } from "./status-badge";

export type WorkspaceHealthRow = {
  label: string;
  value: string;
  tone?: StatusBadgeTone;
};

/** Resumo de saúde do workspace (integrações, sync, plano). */
export function WorkspaceHealthCard({
  title = "Saúde do workspace",
  subtitle,
  rows,
  action,
  className,
}: {
  title?: string;
  subtitle?: string;
  rows: WorkspaceHealthRow[];
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/[0.15] p-4 shadow-[var(--shadow-surface-sm)] sm:p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/[0.1] text-primary">
            <Activity className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-background/60 px-3 py-2 text-xs"
          >
            <span className="font-medium text-muted-foreground">{r.label}</span>
            {r.tone ? (
              <StatusBadge tone={r.tone} dot>
                {r.value}
              </StatusBadge>
            ) : (
              <span className="font-semibold tabular-nums text-foreground">{r.value}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
