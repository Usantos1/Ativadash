import type { ReactNode } from "react";
import { Activity, Check, Link2Off, Settings2, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type IntegrationHealth = "healthy" | "warning" | "idle" | "disconnected";

interface IntegrationCardProps {
  name: string;
  logoSrc?: string;
  connected: boolean;
  lastSync?: string;
  lastSyncAt?: string | null;
  available?: boolean;
  connecting?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onConfigure?: () => void;
  onTest?: () => void;
  /** Ex.: Mídia paga, CRM */
  categoryLabel?: string;
  /** Ex.: OAuth, API */
  typeLabel?: string;
  /** Ex.: Google Ads API, Marketing API */
  dataSourceLabel?: string;
  /** Conta ou ID exibido ao usuário */
  accountLabel?: string;
  /** Cliente comercial vinculado (nome) */
  clientName?: string | null;
  health?: IntegrationHealth;
  errorCount?: number;
  footer?: ReactNode;
}

function healthBadge(health: IntegrationHealth | undefined, connected: boolean) {
  if (!connected) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Desconectado
      </span>
    );
  }
  const h = health ?? "idle";
  const map = {
    healthy: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
    warning: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
    idle: "bg-sky-500/10 text-sky-900 dark:text-sky-200",
    disconnected: "bg-muted text-muted-foreground",
  } as const;
  const label =
    h === "healthy" ? "Saudável" : h === "warning" ? "Atenção" : h === "idle" ? "Aguardando sync" : "Off";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        map[h]
      )}
    >
      <Activity className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

export function IntegrationCard({
  name,
  logoSrc,
  connected,
  lastSync,
  lastSyncAt: _lastSyncAt,
  available = true,
  connecting = false,
  onConnect,
  onDisconnect,
  onConfigure,
  onTest,
  categoryLabel,
  typeLabel,
  dataSourceLabel,
  accountLabel,
  clientName,
  health,
  errorCount = 0,
  footer,
}: IntegrationCardProps) {
  return (
    <Card
      className={cn(
        "relative flex min-h-[200px] flex-col rounded-2xl border-border/55 bg-gradient-to-b from-card via-card to-muted/[0.2] shadow-[var(--shadow-surface-sm)] ring-1 ring-black/[0.02] transition-all hover:border-border/80 hover:shadow-[var(--shadow-surface)] dark:ring-white/[0.04]",
        connected && "ring-2 ring-emerald-500/30"
      )}
    >
      {connected && (
        <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm dark:bg-emerald-600">
          <Check className="h-4 w-4" aria-hidden />
        </div>
      )}
      <CardContent className="flex flex-1 flex-col gap-3 p-5 pt-5">
        <div className="flex items-start gap-3 pr-8">
          {logoSrc ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background">
              <img src={logoSrc} alt="" className="h-7 w-7 object-contain" />
            </div>
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-xs font-bold text-muted-foreground">
              {name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold leading-tight text-foreground">{name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {categoryLabel ? (
                <span className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {categoryLabel}
                </span>
              ) : null}
              {typeLabel ? (
                <span className="text-[10px] text-muted-foreground">{typeLabel}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">{healthBadge(health, connected)}</div>

        <dl className="grid gap-1.5 text-xs text-muted-foreground">
          {dataSourceLabel ? (
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 font-medium text-foreground/80">Origem dos dados</dt>
              <dd className="text-right">{dataSourceLabel}</dd>
            </div>
          ) : null}
          {connected && lastSync ? (
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 font-medium text-foreground/80">Última sincronização</dt>
              <dd className="text-right font-medium text-foreground">{lastSync}</dd>
            </div>
          ) : null}
          {accountLabel ? (
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 font-medium text-foreground/80">Conta</dt>
              <dd className="max-w-[55%] truncate text-right" title={accountLabel}>
                {accountLabel}
              </dd>
            </div>
          ) : null}
          {clientName != null && clientName !== "" ? (
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 font-medium text-foreground/80">Cliente vinculado</dt>
              <dd className="max-w-[55%] truncate text-right" title={clientName}>
                {clientName}
              </dd>
            </div>
          ) : connected ? (
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 font-medium text-foreground/80">Cliente vinculado</dt>
              <dd className="text-right italic opacity-80">Nenhum</dd>
            </div>
          ) : null}
          {errorCount > 0 ? (
            <div className="flex justify-between gap-2 text-rose-700 dark:text-rose-400">
              <dt className="shrink-0 font-semibold">Erros recentes</dt>
              <dd>{errorCount}</dd>
            </div>
          ) : connected ? (
            <div className="flex justify-between gap-2">
              <dt className="shrink-0 font-medium text-foreground/80">Erros recentes</dt>
              <dd>0</dd>
            </div>
          ) : null}
        </dl>

        {footer ? <div className="border-t border-border/50 pt-2 text-xs">{footer}</div> : null}

        <div className="mt-auto flex flex-wrap gap-2">
          {connected ? (
            <>
              {onConfigure ? (
                <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={onConfigure}>
                  <Settings2 className="mr-1 h-3.5 w-3.5" />
                  Configurar
                </Button>
              ) : null}
              {onTest ? (
                <Button variant="secondary" size="sm" className="rounded-lg text-xs" type="button" onClick={onTest}>
                  <Zap className="mr-1 h-3.5 w-3.5" />
                  Testar
                </Button>
              ) : null}
              {onDisconnect ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={onDisconnect}
                >
                  <Link2Off className="mr-1 h-3.5 w-3.5" />
                  Desvincular
                </Button>
              ) : null}
            </>
          ) : available ? (
            onConnect ? (
              <Button size="sm" className="rounded-lg" onClick={onConnect} disabled={connecting}>
                {connecting ? "Redirecionando…" : "Conectar"}
              </Button>
            ) : null
          ) : (
            <span className="text-xs font-medium text-muted-foreground">Em breve</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
