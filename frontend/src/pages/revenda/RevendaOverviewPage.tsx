import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Building2,
  Plug,
  RefreshCw,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IndeterminateLoadingBar } from "@/components/ui/indeterminate-loading-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOrganizationContext } from "@/lib/organization-api";
import { fetchResellerOverview } from "@/lib/revenda-api";
import type { ChildrenOperationsDashboard } from "@/lib/organization-api";
import { buildAttentionQueue, sortRowsByLastActivity } from "@/lib/revenda-workspace-metrics";
import { cn } from "@/lib/utils";

type KpiTone = "neutral" | "amber" | "rose" | "emerald" | "primary";

const KPI_TONE: Record<KpiTone, { wrap: string; icon: string }> = {
  primary: {
    wrap: "border-primary/25 bg-primary/[0.04] dark:bg-primary/[0.08]",
    icon: "bg-primary/15 text-primary",
  },
  emerald: {
    wrap: "border-emerald-500/30 bg-emerald-500/[0.05] dark:bg-emerald-950/25",
    icon: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  amber: {
    wrap: "border-amber-500/30 bg-amber-500/[0.05] dark:bg-amber-950/20",
    icon: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  rose: {
    wrap: "border-rose-500/30 bg-rose-500/[0.05] dark:bg-rose-950/25",
    icon: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  neutral: {
    wrap: "border-border/60 bg-muted/20",
    icon: "bg-muted text-muted-foreground",
  },
};

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  pulse = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: KpiTone;
  pulse?: boolean;
}) {
  const styles = KPI_TONE[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-3.5 shadow-[var(--shadow-surface-sm)] sm:p-4",
        styles.wrap
      )}
    >
      <div className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", styles.icon)}>
        <Icon className="h-4 w-4" aria-hidden />
        {pulse ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-500/60" aria-hidden />
            <span className="relative h-2 w-2 rounded-full bg-amber-500" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl">{value}</p>
        {hint ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

export function RevendaOverviewPage() {
  const [ctxOk, setCtxOk] = useState<boolean | null>(null);
  const [ctxBlock, setCtxBlock] = useState<"partner" | "plan" | null>(null);
  const [dash, setDash] = useState<ChildrenOperationsDashboard | null>(null);
  const dashRef = useRef<ChildrenOperationsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [slowRefreshHint, setSlowRefreshHint] = useState(false);

  const load = useCallback(async () => {
    const hadDash = dashRef.current != null;
    setError(null);
    if (hadDash) setRefreshing(true);
    else setLoading(true);
    try {
      const [ctxRes, overviewRes] = await Promise.allSettled([
        fetchOrganizationContext(),
        fetchResellerOverview(),
      ]);

      if (ctxRes.status === "rejected") {
        const e = ctxRes.reason;
        setError(e instanceof Error ? e.message : "Não foi possível carregar o contexto da empresa.");
        setCtxOk(null);
        setDash(null);
        dashRef.current = null;
        return;
      }

      const ctx = ctxRes.value;
      const planOk =
        ctx.enabledFeatures.multiOrganization === true &&
        (ctx.limits.maxChildOrganizations == null || ctx.limits.maxChildOrganizations > 0);
      const partnerOk = ctx.matrizNavEligible === true;
      const enabled = partnerOk && planOk;
      setCtxOk(enabled);
      if (!partnerOk) setCtxBlock("partner");
      else if (!planOk) setCtxBlock("plan");
      else setCtxBlock(null);

      if (!enabled) {
        setDash(null);
        dashRef.current = null;
        return;
      }

      if (overviewRes.status === "rejected") {
        const e = overviewRes.reason;
        setError(e instanceof Error ? e.message : "Não foi possível carregar o painel.");
        if (!hadDash) {
          setDash(null);
          dashRef.current = null;
        }
        return;
      }

      setDash(overviewRes.value);
      dashRef.current = overviewRes.value;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o painel.");
      if (!hadDash) {
        setDash(null);
        dashRef.current = null;
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!refreshing) {
      setSlowRefreshHint(false);
      return;
    }
    const t = window.setTimeout(() => setSlowRefreshHint(true), 5000);
    return () => window.clearTimeout(t);
  }, [refreshing]);

  useEffect(() => {
    void load();
  }, [load]);

  const attention = useMemo(() => (dash ? buildAttentionQueue(dash.organizations) : []), [dash]);

  const recentOrgs = useMemo(() => {
    if (!dash) return [];
    return sortRowsByLastActivity(dash.organizations, "desc").slice(0, 6);
  }, [dash]);

  /** IDs de agências filiais na lista — clientes com esse pai aparecem na aba Agências de /revenda/contas. */
  const agencyChildIds = useMemo(
    () =>
      new Set(
        (dash?.organizations ?? []).filter((o) => o.resellerOrgKind === "AGENCY").map((o) => o.id)
      ),
    [dash]
  );

  if (loading && !dash) {
    return (
      <div className="space-y-8 animate-in fade-in-0 duration-200">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[108px] rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="min-h-[280px] rounded-xl" />
          <Skeleton className="min-h-[280px] rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (ctxOk === false) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Revenda não habilitada</CardTitle>
          <CardDescription>
            {ctxBlock === "partner"
              ? "A raiz deste ecossistema não está habilitada como parceira de revenda. Solicite à equipe Ativa Dash ou ao administrador global do produto."
              : "É necessário multiempresa e cota de contas filhas no plano da matriz."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error && !dash) {
    return (
      <Card className="border-destructive/40">
        <CardHeader className="flex flex-row items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <CardTitle className="text-base">Não foi possível carregar a rede</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use o seletor de empresa no topo na conta matriz (sem empresa pai) e um perfil de administrador ou proprietário.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!dash) return null;

  const { summary } = dash;
  const alertCount = dash.alerts.filter((a) => a.severity === "warning" || a.severity === "critical").length;

  return (
    <div className="relative space-y-8">
      {refreshing ? (
        <div className="sticky top-0 z-20 -mx-1">
          <IndeterminateLoadingBar />
        </div>
      ) : null}
      {slowRefreshHint ? (
        <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          A atualização está a demorar mais do que o habitual. Os números abaixo são os últimos recebidos com sucesso.
        </p>
      ) : null}
      {error && dash ? (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-lg"
          disabled={refreshing}
          onClick={() => void load()}
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar painel
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Building2}
          label="Contas"
          value={String(summary.totalWorkspaces)}
          hint={`${summary.activeWorkspaces} ativas · ${summary.pausedWorkspaces} paus. · ${summary.archivedWorkspaces} arq.`}
          tone={summary.totalWorkspaces > 0 ? "primary" : "neutral"}
        />
        <Kpi
          icon={Users}
          label="Usuários"
          value={String(summary.usersTotalAcrossChildren)}
          hint="Membros somados em todas as contas filhas"
          tone={summary.usersTotalAcrossChildren > 0 ? "emerald" : "neutral"}
        />
        <Kpi
          icon={Plug}
          label="Integrações"
          value={String(summary.integrationsTotalAcrossChildren)}
          hint={summary.withoutIntegration > 0 ? `${summary.withoutIntegration} sem integração` : "Todas contas integradas"}
          tone={summary.withoutIntegration > 0 ? "amber" : "emerald"}
        />
        <Kpi
          icon={Bell}
          label="Alertas"
          value={String(alertCount)}
          hint={alertCount > 0 ? "Workspaces exigem atenção" : "Nenhum alerta crítico ativo"}
          tone={alertCount > 0 ? "amber" : "emerald"}
          pulse={alertCount > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fila de atenção</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attention.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item prioritário no momento.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {attention.slice(0, 8).map((item) => (
                  <li
                    key={`${item.organizationId}-${item.priority}`}
                    className="flex gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
                  >
                    <span className="font-mono text-[10px] text-muted-foreground">{item.priority}</span>
                    <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.problems.slice(0, 2).join(" · ")}
                        {item.problems.length > 2 ? "…" : ""}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{item.priorityLabel}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/revenda/saude"
              className="inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Saúde
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Atividade recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentOrgs.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{o.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.plan?.name ?? "Sem plano"} · {o.memberCount} membros · {o.connectedIntegrations} integrações
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <Link
                    to={
                      o.resellerOrgKind === "AGENCY" ||
                      (o.parentOrganizationId != null && agencyChildIds.has(o.parentOrganizationId))
                        ? "/revenda/contas?kind=AGENCY"
                        : "/revenda/contas?kind=CLIENT"
                    }
                    className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Lista
                  </Link>
                  <Link
                    to={`/revenda/pessoas?organizationId=${encodeURIComponent(o.id)}`}
                    className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Pessoas
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cotas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Contas filhas (limite)</p>
            <p className="mt-1 text-lg font-bold tabular-nums">
              {summary.childSlotsUsed}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {summary.childSlotsCap == null ? "∞" : summary.childSlotsCap}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Dashboards (filhos)</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{summary.dashboardsTotalAcrossChildren}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Sem integração (ativas)</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400">
              {summary.withoutIntegration}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
