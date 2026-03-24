import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge, type StatusBadgeTone } from "./status-badge";

/** Cartão de integração para hubs de conexão (saúde + sync + conta). */
export function IntegrationStatusCard({
  name,
  logo,
  connected,
  healthTone,
  lastSyncLabel,
  accountLabel,
  dataCoverage,
  errorHint,
  actions,
  footer,
  className,
}: {
  name: string;
  logo?: ReactNode;
  connected: boolean;
  healthTone?: StatusBadgeTone;
  lastSyncLabel?: string;
  accountLabel?: string;
  dataCoverage?: string;
  errorHint?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const tone: StatusBadgeTone = healthTone ?? (connected ? "healthy" : "disconnected");
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/[0.2] p-4 shadow-[var(--shadow-surface-sm)] transition-[box-shadow,border-color] hover:border-border/80 hover:shadow-md sm:p-5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {logo ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/90 shadow-inner">
            {logo}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">{name}</h3>
            <StatusBadge tone={tone} dot>
              {connected ? "Conectado" : "Desconectado"}
            </StatusBadge>
          </div>
          {lastSyncLabel ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Última sync: <span className="font-medium text-foreground/90">{lastSyncLabel}</span>
            </p>
          ) : null}
          {accountLabel ? <p className="mt-0.5 text-[11px] text-muted-foreground">Conta: {accountLabel}</p> : null}
          {dataCoverage ? (
            <p className="mt-2 rounded-lg border border-border/40 bg-muted/25 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
              {dataCoverage}
            </p>
          ) : null}
          {errorHint ? <p className="mt-2 text-xs font-medium text-destructive">{errorHint}</p> : null}
        </div>
      </div>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
      {footer ? <div className="mt-3 border-t border-border/45 pt-3">{footer}</div> : null}
    </div>
  );
}
