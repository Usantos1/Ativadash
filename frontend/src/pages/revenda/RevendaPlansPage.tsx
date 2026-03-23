import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchResellerPlans, type ResellerPlanRow } from "@/lib/revenda-api";
import { formatPlanCap } from "@/lib/organization-api";

export function RevendaPlansPage() {
  const [plans, setPlans] = useState<ResellerPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchResellerPlans();
      setPlans(r.plans);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar planos.");
      setPlans([]);
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
        <h2 className="text-xl font-semibold tracking-tight">Planos e assinaturas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Planos ativos disponíveis para atribuição. Aplicação em empresas e agências é feita na governança de cada filial
          (plano direto ou herança da matriz) e na assinatura operacional.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Planos ativos</CardTitle>
          <CardDescription>Limites base antes de overrides por organização.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Nome</th>
                    <th className="py-2 pr-3">Slug</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Usuários</th>
                    <th className="py-2 pr-3">Integrações</th>
                    <th className="py-2 pr-3">Dashboards</th>
                    <th className="py-2 pr-3">Filhas</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-3 pr-3 font-medium">{p.name}</td>
                      <td className="py-3 pr-3 font-mono text-xs text-muted-foreground">{p.slug}</td>
                      <td className="py-3 pr-3">{p.planType}</td>
                      <td className="py-3 pr-3 tabular-nums">{formatPlanCap(p.maxUsers)}</td>
                      <td className="py-3 pr-3 tabular-nums">{p.maxIntegrations}</td>
                      <td className="py-3 pr-3 tabular-nums">{p.maxDashboards}</td>
                      <td className="py-3 pr-3 tabular-nums">{formatPlanCap(p.maxChildOrganizations)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
