import { AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import type { InsightAlert } from "@/lib/marketing-settings-api";
import { cn } from "@/lib/utils";

export type StructuredPerformanceAlert = {
  problema: string;
  causa: string;
  acao: string;
  severity: InsightAlert["severity"];
  code: string;
};

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

/** Converte alertas da API (título + mensagem) no formato problema / causa / ação. */
export function insightAlertToStructured(a: InsightAlert): StructuredPerformanceAlert {
  return {
    code: a.code,
    severity: a.severity,
    problema: a.title,
    causa: a.message.trim() ? a.message : "Sem detalhe adicional retornado pela análise de metas.",
    acao: "Ajustar campanhas conforme a causa acima e revisar metas em Metas e alertas.",
  };
}

export function PerformanceAlerts({
  alerts,
  structuredAlerts,
  loading,
  className,
}: {
  /** @deprecated Preferir `structuredAlerts`; mantido para compatibilidade. */
  alerts?: InsightAlert[] | null | undefined;
  structuredAlerts?: StructuredPerformanceAlert[] | null | undefined;
  loading?: boolean;
  className?: string;
}) {
  const items: StructuredPerformanceAlert[] = structuredAlerts?.length
    ? structuredAlerts
    : (alerts ?? []).map(insightAlertToStructured);

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

  if (!items.length) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((a) => (
        <div
          key={`${a.code}-${a.problema}`}
          role="status"
          className={cn(
            "flex gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm",
            alertStyles(a.severity)
          )}
        >
          <AlertIcon severity={a.severity} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="font-semibold leading-snug text-foreground">{a.problema}</p>
            <p className="text-[13px] leading-snug text-muted-foreground">
              <span className="font-medium text-foreground/90">Causa: </span>
              {a.causa}
            </p>
            <p className="text-[13px] leading-snug text-foreground">
              <span className="font-medium text-primary">Ação: </span>
              {a.acao}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
