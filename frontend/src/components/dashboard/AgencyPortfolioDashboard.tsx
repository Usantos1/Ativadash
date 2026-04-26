import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  fetchChildrenPortfolio,
  switchWorkspaceOrganization,
  type AgencyPortfolioAlertLevel,
  type AgencyPortfolioChildRow,
} from "@/lib/organization-api";
import { useAuthStore } from "@/stores/auth-store";
import { dashboardWorkspacePath } from "@/lib/dashboard-path";

function formatBrl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function PlatformBadges({ row }: { row: AgencyPortfolioChildRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      {row.metaAdsConnected ? (
        <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
          Meta
        </span>
      ) : null}
      {row.googleAdsConnected ? (
        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
          Google
        </span>
      ) : null}
      {!row.metaAdsConnected && !row.googleAdsConnected ? (
        <span className="text-xs text-muted-foreground">—</span>
      ) : null}
    </div>
  );
}

const CPL_LABELS: Record<AgencyPortfolioAlertLevel, string> = {
  CRITICAL: "Crítico",
  WARNING: "Atenção",
  HEALTHY: "Saudável",
  PENDING: "Definir meta",
  NO_METRICS: "Sem CPL",
};

function CplAlertBadge({
  level,
  detail,
  className,
}: {
  level: AgencyPortfolioAlertLevel;
  detail: string | null;
  className?: string;
}) {
  const label = CPL_LABELS[level];
  const base =
    "inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums";
  const styles: Record<AgencyPortfolioAlertLevel, string> = {
    CRITICAL:
      "bg-rose-500/15 text-rose-700 ring-1 ring-rose-500/35 animate-pulse dark:text-rose-300 dark:ring-rose-400/40",
    WARNING: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
    HEALTHY: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
    PENDING: "bg-muted text-muted-foreground",
    NO_METRICS: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  };

  const badge = (
    <span className={cn(base, styles[level], className)}>
      {level === "HEALTHY" ? <CheckCircle2 className="h-3 w-3 shrink-0 opacity-90" aria-hidden /> : null}
      {label}
    </span>
  );

  if (!detail) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="max-w-full cursor-help border-0 bg-transparent p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
        >
          {badge}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] text-left leading-snug">
        {detail}
      </TooltipContent>
    </Tooltip>
  );
}

function PortfolioStatusCell({ row }: { row: AgencyPortfolioChildRow }) {
  if (row.workspaceStatus !== "ACTIVE") {
    const text = row.workspaceStatus === "PAUSED" ? "Pausada" : "Arquivada";
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help text-xs font-medium text-muted-foreground">{text}</span>
        </TooltipTrigger>
        <TooltipContent>Workspace não ativo — métricas de CPL podem estar desatualizadas.</TooltipContent>
      </Tooltip>
    );
  }

  if (row.metricsOrSyncIssue) {
    const detail = row.metricsUnavailable
      ? "Integração conectada, mas não foi possível obter gastos/leads (30d). Verifique token OAuth ou permissões da API."
      : "Última sincronização há mais de 72 horas — risco de dados desatualizados ou token a expirar.";
    return (
      <div className="flex flex-col gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="cursor-help border-0 bg-transparent p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                Integração
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px] text-left leading-snug">
            {detail}
          </TooltipContent>
        </Tooltip>
        <CplAlertBadge level={row.alertLevel} detail={row.alertDetail} className="w-fit" />
      </div>
    );
  }

  return <CplAlertBadge level={row.alertLevel} detail={row.alertDetail} />;
}

function SummaryCardSkeleton() {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-8 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-3 w-full" />
      </CardContent>
    </Card>
  );
}

export function AgencyPortfolioDashboard() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchChildrenPortfolio>> | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchChildrenPortfolio();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o portfólio.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function enterClient(organizationId: string) {
    if (switchingId) return;
    setSwitchingId(organizationId);
    try {
      const res = await switchWorkspaceOrganization(organizationId);
      setAuth(
        {
          ...res.user,
          organization: res.user.organization,
        },
        res.accessToken,
        res.refreshToken,
        {
          memberships: res.memberships,
          managedOrganizations: res.managedOrganizations ?? [],
        }
      );
      const slug = res.user.organization?.slug?.trim() || res.user.organizationId;
      navigate(dashboardWorkspacePath(slug), { replace: true });
    } catch {
      setError("Não foi possível entrar neste cliente. Verifique permissões.");
    } finally {
      setSwitchingId(null);
    }
  }

  const summary = data?.summary;
  const rows = data?.organizations ?? [];
  const health = summary?.portfolioHealth;
  const critical = summary?.cplCriticalCount ?? 0;
  const healthLine =
    health && health.withGoal > 0
      ? `${health.withinTarget} de ${health.withGoal} com CPL na meta ou abaixo (≤ meta, 30d)`
      : health && health.withGoal === 0
        ? "Defina meta de CPL em cada cliente para acompanhar saúde"
        : "—";

  return (
    <TooltipProvider delayDuration={250}>
      <div className="mx-auto w-full max-w-[1200px] space-y-8 pb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary/80">Agência</p>
            <h1 className="text-2xl font-bold tracking-tight">Visão geral do portfólio</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Consolidado dos últimos 30 dias (Meta + Google) dos workspaces cliente sob a sua agência. Use &quot;Entrar no
              cliente&quot; para operar na conta. Alertas de CPL usam a meta configurada em cada workspace (Marketing).
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => void load()}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {error ? (
          <div
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            <>
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </>
          ) : (
            <>
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Gasto total (30d)</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{formatBrl(summary?.totalSpend30dBrl ?? 0)}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">Meta + Google, todos os clientes</CardContent>
              </Card>
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>Conversões (30d)</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{summary?.totalLeads30d ?? 0}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Leads e conversões agregadas (definição do painel)
                </CardContent>
              </Card>
              <Card
                className={cn(
                  "border-border/60 shadow-sm",
                  critical > 0 && "border-rose-500/35 bg-rose-500/[0.04]"
                )}
              >
                <CardHeader className="pb-2">
                  <CardDescription>Saúde de CPL</CardDescription>
                  <CardTitle className="text-lg leading-snug">{healthLine}</CardTitle>
                  <p
                    className={cn(
                      "mt-2 text-sm font-semibold tabular-nums",
                      critical > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground font-normal"
                    )}
                  >
                    {critical > 0
                      ? `${critical} problema${critical === 1 ? "" : "s"} crítico${critical === 1 ? "" : "s"} (CPL > 20% acima da meta)`
                      : "Nenhum cliente com CPL crítico"}
                  </p>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Crítico = CPL acima de 120% da meta. Passe o rato nos badges da tabela para ver o detalhe.
                </CardContent>
              </Card>
              <Card
                className={cn(
                  "border-border/60 shadow-sm",
                  (summary?.clientsWithIntegrationAttention ?? 0) > 0 && "border-amber-500/40 bg-amber-500/[0.06]"
                )}
              >
                <CardHeader className="pb-2">
                  <CardDescription>Integrações</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{summary?.clientsWithIntegrationAttention ?? 0}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Clientes com falha de métricas ou sync há +72h (possível token ou API)
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">Desempenho por cliente</CardTitle>
              <CardDescription>Últimos 30 dias · ordem alfabética · alertas por meta de CPL (Marketing)</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/clientes" className="gap-1">
                Gerir clientes
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {loading ? (
              <div className="space-y-2 px-6 pb-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Ainda não há workspaces cliente nesta agência.</p>
                <Button asChild size="sm">
                  <Link to="/clientes">Criar ou ver clientes</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-3 py-3">Plataformas</th>
                      <th className="px-3 py-3 text-right">Gasto 30d</th>
                      <th className="px-3 py-3 text-right">Leads</th>
                      <th className="px-3 py-3 text-right">CPL vs meta</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const spend = row.marketing30d?.spend ?? 0;
                      const leads = row.marketing30d?.leads ?? 0;
                      const cpl = row.marketing30d?.cpl;
                      const goal = row.targetCpaBrl;
                      const cplVs =
                        cpl != null && goal != null
                          ? `${formatBrl(cpl)} / ${formatBrl(goal)}`
                          : cpl != null
                            ? formatBrl(cpl)
                            : "—";
                      return (
                        <tr key={row.id} className="border-b border-border/40 transition-colors hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <span className="font-medium text-foreground">{row.name}</span>
                            <p className="text-[11px] text-muted-foreground">{row.slug}</p>
                          </td>
                          <td className="px-3 py-3">
                            <PlatformBadges row={row} />
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatBrl(spend)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{leads}</td>
                          <td className="px-3 py-3 text-right text-xs tabular-nums text-muted-foreground">{cplVs}</td>
                          <td className="px-3 py-3 align-top">
                            <PortfolioStatusCell row={row} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-8 gap-1 text-xs"
                              disabled={switchingId !== null}
                              onClick={() => void enterClient(row.id)}
                            >
                              {switchingId === row.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  Entrar
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </>
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
