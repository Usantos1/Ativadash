import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Painel simples — legível, sem excesso de gradiente. */
export const settingsHubPanelClass =
  "overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm";

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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {kicker ? (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{kicker}</p>
          ) : null}
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>
      <div className={cn(settingsHubPanelClass, panelClassName)}>{children}</div>
    </section>
  );
}

/** Destino principal — uma linha = uma ação. */
export function SettingsQuickNavCard({
  to,
  title,
  detail,
  icon: Icon,
  className,
}: {
  to: string;
  title: string;
  detail?: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border/70 bg-card p-3.5 shadow-sm outline-none transition-colors",
        "hover:border-primary/40 hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-foreground">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight text-foreground">{title}</span>
        {detail ? (
          <span className="mt-1 block text-xs leading-snug text-muted-foreground line-clamp-2">{detail}</span>
        ) : null}
      </span>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
    </Link>
  );
}

export function HubStat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2", className)}>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

export function HubRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-3 py-3 last:border-b-0 sm:px-4">
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
      <div className="flex shrink-0 flex-wrap gap-1.5">
        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
          <Link to={configHref}>Abrir</Link>
        </Button>
        {!connected && reconnectHref ? (
          <Button size="sm" className="h-8 text-xs" asChild>
            <Link to={reconnectHref}>Ligar</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
