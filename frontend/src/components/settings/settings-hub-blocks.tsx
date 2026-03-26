import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Seção compacta: título pequeno + painel denso. */
export function SettingsHubSection({
  kicker,
  title,
  children,
  className,
  panelClassName,
  headerRight,
}: {
  kicker?: string;
  title: string;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  headerRight?: ReactNode;
}) {
  return (
    <section className={cn("scroll-mt-6", className)}>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          {kicker ? (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{kicker}</p>
          ) : null}
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {headerRight}
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-border/60 bg-card/60 shadow-sm",
          panelClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function HubStat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-md border border-border/50 bg-muted/15 px-2.5 py-1.5", className)}>
      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function HubRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

/** Linha de integração — lista densa. */
export function SettingsHubIntegrationRow({
  name,
  connected,
  syncLine,
  configHref,
  reconnectHref,
}: {
  name: string;
  connected: boolean;
  syncLine: string;
  configHref: string;
  reconnectHref?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/40 px-3 py-2 last:border-b-0 sm:px-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{name}</span>
          <span
            className={cn(
              "rounded px-1.5 py-0 text-[10px] font-semibold uppercase",
              connected ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" : "bg-muted text-muted-foreground"
            )}
          >
            {connected ? "OK" : "Off"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{syncLine}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          to={configHref}
          className="inline-flex h-8 items-center rounded-md border border-border/70 bg-background px-3 text-xs font-medium hover:bg-muted/50"
        >
          Configurar
        </Link>
        {!connected && reconnectHref ? (
          <Link
            to={reconnectHref}
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Conectar
          </Link>
        ) : null}
      </div>
    </div>
  );
}
