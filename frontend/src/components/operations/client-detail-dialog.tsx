import { Building2, LogIn, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/premium";
import { formatNumber, formatSpend } from "@/lib/metrics-format";
import type { ChildWorkspaceOperationsRow } from "@/lib/organization-api";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: ChildWorkspaceOperationsRow | null;
  statusLabel: string;
  statusTone: "healthy" | "alert" | "disconnected";
  statusCritical: boolean;
  onEnterClient: (id: string) => void;
  onManageAccess: (id: string) => void;
  entering: boolean;
  formatDate: (iso: string | null | undefined) => string;
};

export function ClientDetailDialog({
  open,
  onOpenChange,
  row,
  statusLabel,
  statusTone,
  statusCritical,
  onEnterClient,
  onManageAccess,
  entering,
  formatDate,
}: Props) {
  const m = row?.marketing30d;
  const projects = row?.projectCount ?? 0;
  const launches = row?.launchCount ?? 0;
  const activeLaunches = row?.activeLaunchCount ?? 0;
  const accounts = row?.clientAccountCount ?? 0;

  return (
    <Dialog open={open && !!row} onOpenChange={onOpenChange}>
      <DialogContent title="Detalhe da conta" showClose className="max-w-lg">
        {row ? (
          <>
            <div className="space-y-4 py-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    Workspace
                  </p>
                  <h2 className="text-lg font-black tracking-tight text-foreground">{row.name}</h2>
                  <p className="font-mono text-xs text-muted-foreground">{row.slug}</p>
                </div>
                {statusCritical ? (
                  <span className="shrink-0 rounded-md border border-rose-500/40 bg-rose-500/[0.12] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rose-900 dark:text-rose-100">
                    {statusLabel}
                  </span>
                ) : (
                  <StatusBadge tone={statusTone} dot>
                    {statusLabel}
                  </StatusBadge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-border/45 bg-muted/10 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Contas comerciais</p>
                  <p className="text-sm font-bold tabular-nums">{accounts}</p>
                </div>
                <div className="rounded-xl border border-border/45 bg-muted/10 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Projetos</p>
                  <p className="text-sm font-bold tabular-nums">{projects}</p>
                </div>
                <div className="rounded-xl border border-border/45 bg-muted/10 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Lanç. ativos</p>
                  <p className="text-sm font-bold tabular-nums">{activeLaunches}</p>
                </div>
                <div className="rounded-xl border border-border/45 bg-muted/10 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Lanç. total</p>
                  <p className="text-sm font-bold tabular-nums">{launches}</p>
                </div>
                <div className="rounded-xl border border-border/45 bg-muted/10 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Membros</p>
                  <p className="text-sm font-bold tabular-nums">{row.memberCount}</p>
                </div>
                <div className="rounded-xl border border-border/45 bg-muted/10 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Integrações</p>
                  <p className="text-sm font-bold tabular-nums">{row.connectedIntegrations}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/40 bg-card/30 px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Mídia · 30 dias</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold tabular-nums">
                  <span>Leads {m ? formatNumber(Math.round(m.leads)) : "—"}</span>
                  <span>CPL {m?.cpl != null ? formatSpend(m.cpl) : "—"}</span>
                  <span>Invest. {m ? formatSpend(m.spend) : "—"}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Meta: {row.metaAdsConnected ? "conectada" : "—"}</span>
                <span>·</span>
                <span>Google: {row.googleAdsConnected ? "conectada" : "—"}</span>
                <span className="ml-auto">Última atividade: {formatDate(row.lastActivityAt ?? row.lastIntegrationSyncAt)}</span>
              </div>

              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Entrar</strong> define este workspace como ativo e abre o Painel ADS.
              </p>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => onManageAccess(row.id)}
                disabled={entering}
              >
                <UserCog className="mr-2 h-4 w-4" />
                Gerenciar acessos
              </Button>
              <Button type="button" className="rounded-xl" onClick={() => onEnterClient(row.id)} disabled={entering}>
                {entering ? null : <LogIn className="mr-2 h-4 w-4" />}
                Entrar no cliente
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
