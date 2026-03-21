import { AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import type { InsightAlert } from "@/lib/marketing-settings-api";
import { cn } from "@/lib/utils";

function AlertIcon({ severity }: { severity: InsightAlert["severity"] }) {
  switch (severity) {
    case "critical":
      return <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />;
    case "success":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />;
    default:
      return <Info className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
}

function alertStyles(severity: InsightAlert["severity"]) {
  switch (severity) {
    case "critical":
      return "border-destructive/40 bg-destructive/10";
    case "warning":
      return "border-warning/50 bg-warning/10";
    case "success":
      return "border-success/40 bg-success/10";
    default:
      return "border-border/80 bg-muted/40";
  }
}

export function PerformanceAlerts({
  alerts,
  loading,
  className,
}: {
  alerts: InsightAlert[] | null | undefined;
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border/80 bg-card px-4 py-3 text-sm text-muted-foreground",
          className
        )}
      >
        <Sparkles className="h-4 w-4 animate-pulse" />
        Analisando metas e alertas…
      </div>
    );
  }

  if (!alerts?.length) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {alerts.map((a) => (
        <div
          key={`${a.code}-${a.title}`}
          role="status"
          className={cn(
            "flex gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm",
            alertStyles(a.severity)
          )}
        >
          <AlertIcon severity={a.severity} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{a.title}</p>
            <p className="mt-0.5 leading-snug text-muted-foreground">{a.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
