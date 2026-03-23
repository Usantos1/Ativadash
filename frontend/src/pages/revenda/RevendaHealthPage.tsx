import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchResellerOperationalHealth, type ResellerOperationalHealth } from "@/lib/revenda-api";

const SEVERITY_PT: Record<string, string> = {
  critical: "Crítico",
  warning: "Atenção",
  info: "Info",
};

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Saúde operacional</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fila priorizada de alertas e empresas que exigem ação imediata ou acompanhamento.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : data ? (
            <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <li className="rounded-lg border border-border/50 px-3 py-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Ativas</span>
                <p className="text-lg font-bold tabular-nums">{data.summary.activeWorkspaces}</p>
              </li>
              <li className="rounded-lg border border-border/50 px-3 py-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Sem integração</span>
                <p className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400">
                  {data.summary.withoutIntegration}
                </p>
              </li>
              <li className="rounded-lg border border-border/50 px-3 py-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Sem membros</span>
                <p className="text-lg font-bold tabular-nums text-rose-700 dark:text-rose-400">
                  {data.summary.withoutMembers}
                </p>
              </li>
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alertas priorizados</CardTitle>
          <CardDescription>Ordenação: criticidade decrescente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!data?.prioritizedAlerts.length ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta registrado.</p>
          ) : (
            data.prioritizedAlerts.map((a, i) => (
              <div
                key={`${a.organizationId}-${a.type}-${i}`}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border/60 bg-muted/15 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{a.name || a.organizationId}</p>
                  <p className="text-xs text-muted-foreground">{a.message}</p>
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
          <CardTitle className="text-base">Empresas que exigem atenção</CardTitle>
          <CardDescription>Flag consolidada de risco operacional.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!data?.organizationsNeedingAttention.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma empresa na fila.</p>
          ) : (
            data.organizationsNeedingAttention.map((o) => (
              <div key={o.id} className="rounded-lg border border-border/50 px-3 py-2 text-sm">
                <p className="font-medium">{o.name}</p>
                <p className="text-xs text-muted-foreground">
                  {o.memberCount} membros · {o.connectedIntegrations} integrações · última atividade:{" "}
                  {o.lastActivityAt ? new Date(o.lastActivityAt).toLocaleString("pt-BR") : "—"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
