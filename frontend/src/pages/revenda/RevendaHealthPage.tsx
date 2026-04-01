import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHint } from "@/pages/revenda/PageHint";
import { fetchResellerOperationalHealth, type ResellerOperationalHealth } from "@/lib/revenda-api";
import type { ChildWorkspaceOperationsRow } from "@/lib/organization-api";
import { cn } from "@/lib/utils";

const SEVERITY_PT: Record<string, string> = {
  critical: "Crítico",
  warning: "Atenção",
  info: "Info",
};

const ALERT_TYPE_PT: Record<string, string> = {
  no_integration: "Sem integração",
  no_members: "Sem membros",
  never_used: "Sem uso",
  stale_activity: "Atividade parada",
  paused: "Pausado",
  archived: "Arquivado",
  at_child_limit: "Limite de contas",
  near_child_limit: "Quase no limite",
};

function severityBorder(sev: string): string {
  if (sev === "critical") return "border-l-rose-500";
  if (sev === "warning") return "border-l-amber-500";
  return "border-l-sky-500";
}

function summarizeOrg(o: ChildWorkspaceOperationsRow): string {
  const parts = [
    `${o.memberCount} membro(s)`,
    `${o.connectedIntegrations} integração(ões)`,
    o.workspaceStatus !== "ACTIVE" ? `estado: ${o.workspaceStatus}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function RevendaHealthPage() {
  const [data, setData] = useState<ResellerOperationalHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchResellerOperationalHealth();
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar saúde operacional.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const criticalAlerts = useMemo(
    () => (data?.prioritizedAlerts ?? []).filter((a) => a.severity === "critical"),
    [data]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Saúde da rede</h2>
          <PageHint>
            Vista consolidada do mesmo critério do resumo da revenda: integrações, equipe e alertas. Use as ligações
            para agir nas empresas.
          </PageHint>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={loading} onClick={() => void load()}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
          <Button type="button" size="sm" variant="secondary" asChild>
            <Link to="/revenda">Ver resumo completo</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link to="/revenda/agencias" className="font-medium text-primary underline-offset-4 hover:underline">
          Agências
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link to="/revenda/empresas" className="font-medium text-primary underline-offset-4 hover:underline">
          Clientes (matriz)
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link to="/revenda/auditoria" className="font-medium text-primary underline-offset-4 hover:underline">
          Auditoria
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Indicadores</CardTitle>
          <CardDescription>Totais nas contas filhas visíveis para o seu utilizador na matriz.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : data ? (
            <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <li className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Workspaces</span>
                <p className="text-lg font-bold tabular-nums">{data.summary.totalWorkspaces}</p>
                <p className="text-[11px] text-muted-foreground">
                  {data.summary.activeWorkspaces} ativas · {data.summary.pausedWorkspaces} paus. ·{" "}
                  {data.summary.archivedWorkspaces} arq.
                </p>
              </li>
              <li className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Utilizadores</span>
                <p className="text-lg font-bold tabular-nums">{data.summary.usersTotalAcrossChildren}</p>
              </li>
              <li className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Integrações</span>
                <p className="text-lg font-bold tabular-nums">{data.summary.integrationsTotalAcrossChildren}</p>
              </li>
              <li className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                  Ativas sem integração
                </span>
                <p className="text-lg font-bold tabular-nums text-amber-800 dark:text-amber-300">
                  {data.summary.withoutIntegration}
                </p>
              </li>
              <li className="rounded-lg border border-rose-500/25 bg-rose-500/[0.06] px-3 py-2 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wide text-rose-900 dark:text-rose-200">
                  Ativas sem membros
                </span>
                <p className="text-lg font-bold tabular-nums text-rose-800 dark:text-rose-300">
                  {data.summary.withoutMembers}
                </p>
              </li>
              <li className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Atividade desatualizada
                </span>
                <p className="text-lg font-bold tabular-nums">{data.summary.staleActivityCount}</p>
                <p className="text-[11px] text-muted-foreground">Integração/equipe sem movimento recente</p>
              </li>
              <li className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Dashboards</span>
                <p className="text-lg font-bold tabular-nums">{data.summary.dashboardsTotalAcrossChildren}</p>
              </li>
              <li className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Contas filhas (uso / limite)
                </span>
                <p className="text-lg font-bold tabular-nums">
                  {data.summary.childSlotsUsed}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / {data.summary.childSlotsCap == null ? "∞" : data.summary.childSlotsCap}
                  </span>
                </p>
              </li>
              {data.summary.childrenWithActiveLaunches != null ? (
                <li className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Com lançamento ativo
                  </span>
                  <p className="text-lg font-bold tabular-nums">{data.summary.childrenWithActiveLaunches}</p>
                </li>
              ) : null}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {criticalAlerts.length > 0 ? (
        <Card className="border-rose-500/35 bg-rose-500/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-rose-900 dark:text-rose-100">Requer atenção imediata</CardTitle>
            <CardDescription>{criticalAlerts.length} alerta(s) crítico(s) na fila.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {criticalAlerts.map((a, i) => (
              <div
                key={`crit-${a.organizationId}-${a.type}-${i}`}
                className={cn(
                  "rounded-lg border border-border/60 border-l-4 bg-background/90 px-3 py-2 text-sm",
                  severityBorder(a.severity)
                )}
              >
                <p className="font-medium">{a.name || a.organizationId}</p>
                <p className="text-xs text-muted-foreground">{a.message}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  {ALERT_TYPE_PT[a.type] ?? a.type} · {SEVERITY_PT[a.severity] ?? a.severity}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todos os alertas</CardTitle>
          <CardDescription>Ordenados por gravidade (crítico → aviso → info).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!data?.prioritizedAlerts.length ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta neste momento.</p>
          ) : (
            data.prioritizedAlerts.map((a, i) => (
              <div
                key={`${a.organizationId}-${a.type}-${i}`}
                className={cn(
                  "flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border/60 bg-muted/15 px-3 py-2 text-sm",
                  "border-l-4",
                  severityBorder(a.severity)
                )}
              >
                <div>
                  <p className="font-medium">{a.name || a.organizationId}</p>
                  <p className="text-xs text-muted-foreground">{a.message}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase text-muted-foreground">
                    {ALERT_TYPE_PT[a.type] ?? a.type}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  {SEVERITY_PT[a.severity] ?? a.severity}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contas em atenção</CardTitle>
          <CardDescription>
            Workspaces com sinal vermelho ou amarelo no resumo (integração, equipe, inatividade, estado pausado, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!data?.organizationsNeedingAttention.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta na fila de atenção.</p>
          ) : (
            data.organizationsNeedingAttention.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{o.name}</p>
                  <p className="text-xs text-muted-foreground">{summarizeOrg(o)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Última atividade:{" "}
                    {o.lastActivityAt ? new Date(o.lastActivityAt).toLocaleString("pt-BR") : "—"}
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/revenda/empresas">Abrir na revenda</Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
