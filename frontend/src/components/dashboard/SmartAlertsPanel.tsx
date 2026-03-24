import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardSmartAlert, SmartAlertTier } from "@/lib/dashboard-smart-alerts";
import { DashboardAlertOccurrences } from "@/components/dashboard/dashboard-alert-occurrences";

function TierIcon({ tier }: { tier: SmartAlertTier }) {
  switch (tier) {
    case "critical":
      return <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden />;
    case "attention":
      return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />;
    case "opportunity":
      return <Lightbulb className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />;
    case "healthy":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />;
    default:
      return null;
  }
}

function tierStyles(tier: SmartAlertTier) {
  switch (tier) {
    case "critical":
      return "border-destructive/35 bg-destructive/[0.06]";
    case "attention":
      return "border-amber-500/35 bg-amber-500/[0.05]";
    case "opportunity":
      return "border-sky-500/30 bg-sky-500/[0.05]";
    case "healthy":
      return "border-emerald-500/30 bg-emerald-500/[0.05]";
    default:
      return "border-border/60 bg-muted/30";
  }
}

function tierLabel(tier: SmartAlertTier): string {
  switch (tier) {
    case "critical":
      return "Crítico";
    case "attention":
      return "Atenção";
    case "opportunity":
      return "Oportunidade";
    case "healthy":
      return "Saudável";
    default:
      return "";
  }
}

export function SmartAlertsPanel({
  items,
  loading,
  compareNote,
  refreshKey,
  className,
}: {
  items: DashboardSmartAlert[];
  loading?: boolean;
  compareNote?: ReactNode;
  refreshKey?: number;
  className?: string;
}) {
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border/50 bg-card/60 px-4 py-3 text-sm text-muted-foreground",
          className
        )}
      >
        <Sparkles className="h-4 w-4 animate-pulse text-primary" aria-hidden />
        Cruzando metas, funil e canais…
      </div>
    );
  }

  const visible = items.filter((a) => a.tier !== "healthy").slice(0, 12);
  const healthyCount = items.filter((a) => a.tier === "healthy").length;

  return (
    <div className={cn("space-y-3", className)}>
      {!items.length ? (
        <p className="rounded-xl border border-dashed border-border/60 bg-muted/[0.2] px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum alerta automático neste período. Ative metas em{" "}
          <span className="font-medium text-foreground">Metas e alertas</span> para sinais de CPL e ROAS.
        </p>
      ) : null}

      {healthyCount > 0 && visible.length === 0 ? (
        <div className="flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div>
            <p className="font-semibold text-foreground">Conta alinhada às metas</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Nenhum alerta crítico no período. Continue monitorando CPL/ROAS e criativos.
            </p>
          </div>
        </div>
      ) : null}

      {visible.length > 0 ? (
        <ul className="space-y-2">
          {visible.map((a) => (
            <li
              key={a.id}
              className={cn(
                "flex gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm",
                tierStyles(a.tier)
              )}
            >
              <TierIcon tier={a.tier} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold leading-snug text-foreground">{a.title}</span>
                  <span className="rounded-md border border-border/50 bg-background/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {tierLabel(a.tier)}
                  </span>
                  <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{a.priority}</span>
                </div>
                <p className="text-[13px] leading-snug text-muted-foreground">{a.explanation}</p>
                <p className="text-[13px] font-medium leading-snug text-foreground">
                  <span className="text-primary">Ação sugerida: </span>
                  {a.action}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {compareNote ? (
        <div className="rounded-lg border border-border/35 bg-muted/[0.25] px-3 py-2 text-xs text-muted-foreground">
          {compareNote}
        </div>
      ) : null}

      <DashboardAlertOccurrences refreshKey={refreshKey ?? 0} />
    </div>
  );
}
