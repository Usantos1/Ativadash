import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchOrganizationContext } from "@/lib/organization-api";
import { fetchResellerOverview } from "@/lib/revenda-api";
import type { ChildrenOperationsDashboard } from "@/lib/organization-api";
import { buildAttentionQueue, sortRowsByLastActivity } from "@/lib/revenda-workspace-metrics";
import { cn } from "@/lib/utils";

function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "amber" | "rose" | "emerald";
}) {
  const border =
    tone === "amber"
      ? "border-l-amber-500"
      : tone === "rose"
        ? "border-l-rose-500"
        : tone === "emerald"
          ? "border-l-emerald-500"
          : "border-l-primary";
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/95 py-3 pl-4 pr-3 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
        "border-l-4",
        border
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

export function RevendaOverviewPage() {
  const [ctxOk, setCtxOk] = useState<boolean | null>(null);
  const [ctxBlock, setCtxBlock] = useState<"partner" | "plan" | null>(null);
  const [dash, setDash] = useState<ChildrenOperationsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ctx = await fetchOrganizationContext();
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
        return;
      }
      const d = await fetchResellerOverview();
      setDash(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o painel master.");
      setDash(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const attention = useMemo(() => (dash ? buildAttentionQueue(dash.organizations) : []), [dash]);

  const recentOrgs = useMemo(() => {
    if (!dash) return [];
    return sortRowsByLastActivity(dash.organizations, "desc").slice(0, 6);
  }, [dash]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando visão geral…
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
              ? "A empresa raiz deste ecossistema não está designada como parceira de revenda. Peça ao administrador global do produto para ativar em Plataforma → empresas (raiz)."
              : "O painel matriz exige o recurso multiempresa e cota de empresas filhas no plano da raiz."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardHeader className="flex flex-row items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <CardTitle className="text-base">Acesso ao painel master</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Confirme que você está na empresa raiz (matriz ou conta principal, sem empresa pai) e possui papel de
            administrador ou proprietário (inclui proprietário de workspace na conta principal).
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!dash) return null;

  const { summary } = dash;
  const alertCount = dash.alerts.filter((a) => a.severity === "warning" || a.severity === "critical").length;

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Empresas no ecossistema"
          value={String(summary.totalWorkspaces)}
          hint={`${summary.activeWorkspaces} ativas · ${summary.pausedWorkspaces} pausadas · ${summary.archivedWorkspaces} arquivadas`}
        />
        <Kpi
          label="Usuários (filhos)"
          value={String(summary.usersTotalAcrossChildren)}
          hint="Membros diretos nas empresas vinculadas à matriz"
        />
        <Kpi
          label="Integrações conectadas"
          value={String(summary.integrationsTotalAcrossChildren)}
          hint="Total agregado nas empresas filhas"
        />
        <Kpi
          label="Alertas operacionais"
          value={String(alertCount)}
          hint="Itens que exigem revisão na fila de atenção"
          tone={alertCount > 0 ? "amber" : "emerald"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fila de atenção</CardTitle>
            <CardDescription>Priorização sugerida a partir de riscos operacionais.</CardDescription>
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
              Abrir saúde operacional
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Últimas empresas (por atividade)</CardTitle>
            <CardDescription>Atalhos para governança e consumo.</CardDescription>
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
                <Link
                  to={o.resellerOrgKind === "AGENCY" ? "/revenda/agencias" : "/revenda/empresas"}
                  className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Ver lista
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consumo global (matriz)</CardTitle>
          <CardDescription>Cotas efetivas da empresa matriz e uso atual.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Workspaces filhos</p>
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
