import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, ChevronRight } from "lucide-react";
import { fetchAlertOccurrences, type AlertOccurrenceDto } from "@/lib/alert-rules-api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function severityBorder(sev: string): string {
  if (sev === "critical") return "border-destructive/35 bg-destructive/[0.06]";
  if (sev === "warning") return "border-amber-500/35 bg-amber-500/[0.06]";
  return "border-border/40 bg-muted/10";
}

/**
 * Últimos disparos de regras de alerta (GET /marketing/alert-occurrences) no contexto do workspace.
 */
export function DashboardAlertOccurrences({
  refreshKey,
  className,
  limit = 6,
}: {
  refreshKey: number;
  className?: string;
  limit?: number;
}) {
  const [items, setItems] = useState<AlertOccurrenceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetchAlertOccurrences(limit)
      .then((r) => {
        if (!cancelled) setItems(r.items);
      })
      .catch(() => {
        if (!cancelled) {
          setErr("Não foi possível carregar o histórico de alertas.");
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit, refreshKey]);

  if (loading) {
    return (
      <div className={cn("mt-4 space-y-2", className)} role="status" aria-busy="true">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    );
  }

  if (err) {
    return <p className={cn("mt-3 text-xs text-muted-foreground", className)}>{err}</p>;
  }

  if (!items.length) {
    return (
      <p className={cn("mt-3 text-xs leading-relaxed text-muted-foreground", className)}>
        Nenhum disparo recente de regras personalizadas.{" "}
        <Link
          to="/ads/metas-alertas"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Configurar regras
        </Link>
      </p>
    );
  }

  return (
    <div className={cn("mt-4", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <Bell className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Regras personalizadas (recentes)
        </span>
        <Link
          to="/ads/metas-alertas"
          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary hover:underline"
        >
          Ver tudo
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
        </Link>
      </div>
      <ul className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
        {items.map((o) => (
          <li
            key={o.id}
            className={cn("rounded-lg border px-3 py-2 text-xs", severityBorder(o.severity))}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <span className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                {o.ruleName}
                {o.acknowledgedAt ? (
                  <span className="rounded-md border border-border/60 bg-background/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                    Visto
                  </span>
                ) : null}
              </span>
              <time className="shrink-0 tabular-nums text-[10px] text-muted-foreground" dateTime={o.createdAt}>
                {format(new Date(o.createdAt), "d MMM · HH:mm", { locale: ptBR })}
              </time>
            </div>
            {o.title ? <p className="mt-0.5 font-medium text-foreground/90">{o.title}</p> : null}
            <p className="mt-1 leading-snug text-muted-foreground">{o.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
