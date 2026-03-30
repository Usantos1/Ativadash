import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Building2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchChildrenPortfolio, switchWorkspaceOrganization, type AgencyPortfolioChildRow } from "@/lib/organization-api";
import { useAuthStore } from "@/stores/auth-store";

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

function statusLabel(row: AgencyPortfolioChildRow): { text: string; className: string } {
  if (row.workspaceStatus !== "ACTIVE") {
    return { text: row.workspaceStatus === "PAUSED" ? "Pausada" : "Arquivada", className: "text-muted-foreground" };
  }
  if (row.metricsOrSyncIssue) {
    return { text: row.metricsUnavailable ? "Integração / token" : "Sync antiga", className: "text-amber-600 dark:text-amber-400" };
  }
  if (row.cplStatus === "above_target") return { text: "CPL acima", className: "text-rose-600 dark:text-rose-400" };
  if (row.cplStatus === "on_target" || row.cplStatus === "below_target")
    return { text: "No alvo", className: "text-emerald-600 dark:text-emerald-400" };
  return { text: "—", className: "text-muted-foreground" };
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
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Não foi possível entrar neste cliente. Verifique permissões.");
    } finally {
      setSwitchingId(null);
    }
  }

  const summary = data?.summary;
  const rows = data?.organizations ?? [];
  const health = summary?.portfolioHealth;
  const healthLine =
    health && health.withGoal > 0
      ? `${health.withinTarget} de ${health.withGoal} com CPL dentro da meta (30d)`
      : health && health.withGoal === 0
        ? "Defina meta de CPL em cada cliente para acompanhar saúde"
        : "—";

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary/80">Agência</p>
          <h1 className="text-2xl font-bold tracking-tight">Visão geral do portfólio</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Consolidado dos últimos 30 dias (Meta + Google) dos workspaces cliente sob a sua agência. Use &quot;Entrar no
            cliente&quot; para operar na conta.
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
              <CardContent className="text-xs text-muted-foreground">Leads e conversões agregadas (definição do painel)</CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Saúde de CPL</CardDescription>
                <CardTitle className="text-lg leading-snug">{healthLine}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Comparado à meta configurada em cada workspace</CardContent>
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
            <CardDescription>Últimos 30 dias · ordem alfabética</CardDescription>
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
                    const st = statusLabel(row);
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
                        <td className={cn("px-3 py-3 text-xs font-medium", st.className)}>{st.text}</td>
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
  );
}
