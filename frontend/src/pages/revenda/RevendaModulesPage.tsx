import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, Minus, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHint } from "@/pages/revenda/PageHint";
import {
  fetchResellerEcosystemOrganizations,
  fetchResellerChildDetail,
  REVENDA_PLAN_FEATURE_KEYS,
  REVENDA_LIMIT_FIELDS,
  type ResellerEcosystemOrgRow,
  type ResellerChildDetail,
} from "@/lib/revenda-api";
import { formatPlanCap } from "@/lib/organization-api";
import { cn } from "@/lib/utils";

type OrgModuleSnapshot = {
  org: ResellerEcosystemOrgRow;
  detail: ResellerChildDetail | null;
  loading: boolean;
  error: string | null;
};

export function RevendaModulesPage() {
  const [orgs, setOrgs] = useState<ResellerEcosystemOrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [snapshots, setSnapshots] = useState<Map<string, OrgModuleSnapshot>>(new Map());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchResellerEcosystemOrganizations();
      setOrgs(r.organizations.filter((o) => !o.isMatrix));
    } catch {
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter((o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q));
  }, [orgs, search]);

  async function toggleExpand(orgId: string) {
    if (expandedId === orgId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(orgId);
    const existing = snapshots.get(orgId);
    if (existing?.detail) return;

    const org = orgs.find((o) => o.id === orgId);
    if (!org) return;

    setSnapshots((prev) => {
      const next = new Map(prev);
      next.set(orgId, { org, detail: null, loading: true, error: null });
      return next;
    });

    try {
      const detail = await fetchResellerChildDetail(orgId);
      setSnapshots((prev) => {
        const next = new Map(prev);
        next.set(orgId, { org, detail, loading: false, error: null });
        return next;
      });
    } catch (e) {
      setSnapshots((prev) => {
        const next = new Map(prev);
        next.set(orgId, { org, detail: null, loading: false, error: e instanceof Error ? e.message : "Erro" });
        return next;
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Módulos e cotas</h2>
          <PageHint>
            Veja o estado real dos módulos e limites de cada organização. Clique em uma empresa para expandir.
            Para editar, vá em{" "}
            <Link to="/revenda/contas?kind=CLIENT" className="font-medium text-primary underline-offset-4 hover:underline">
              Clientes
            </Link>{" "}
            ou{" "}
            <Link to="/revenda/planos" className="font-medium text-primary underline-offset-4 hover:underline">
              Planos
            </Link>
            .
          </PageHint>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56 pl-9"
            />
          </div>
          <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {search.trim() ? "Nenhum resultado." : "Nenhuma organização no ecossistema."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((org) => {
            const expanded = expandedId === org.id;
            const snap = snapshots.get(org.id);
            return (
              <Card key={org.id} className={cn(expanded && "ring-1 ring-primary/25")}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30"
                  onClick={() => void toggleExpand(org.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{org.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {org.plan?.name ?? "Sem plano"} · <span className="font-mono">/{org.slug}</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{expanded ? "▲" : "▼"}</span>
                </button>

                {expanded ? (
                  <CardContent className="border-t border-border/50 pt-4">
                    {snap?.loading ? (
                      <div className="flex items-center gap-2 py-6 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando detalhes…
                      </div>
                    ) : snap?.error ? (
                      <p className="text-sm text-destructive">{snap.error}</p>
                    ) : snap?.detail ? (
                      <div className="space-y-5">
                        <div>
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            Módulos (funcionalidades)
                          </p>
                          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                            {REVENDA_PLAN_FEATURE_KEYS.map(({ key, label }) => {
                              const enabled = snap.detail!.context.enabledFeatures?.[key];
                              return (
                                <div
                                  key={key}
                                  className={cn(
                                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                                    enabled
                                      ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-800 dark:text-emerald-200"
                                      : "border-border/50 bg-muted/10 text-muted-foreground"
                                  )}
                                >
                                  {enabled ? (
                                    <Check className="h-3.5 w-3.5 shrink-0" />
                                  ) : (
                                    <X className="h-3.5 w-3.5 shrink-0 opacity-50" />
                                  )}
                                  <span className="truncate">{label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            Limites e consumo
                          </p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                            {REVENDA_LIMIT_FIELDS.map(({ key, label }) => {
                              const limit = snap.detail!.context.limits?.[key];
                              const usage = snap.detail!.context.usage;
                              const usageMap: Record<string, number | undefined> = {
                                maxUsers: usage?.directMembers,
                                maxIntegrations: usage?.integrations,
                                maxChildOrganizations: usage?.childOrganizations,
                                maxClientAccounts: usage?.clientAccounts,
                                maxDashboards: undefined,
                              };
                              const used = usageMap[key];
                              const hasOverride = snap.detail!.limitsOverride?.[key] != null;
                              return (
                                <div key={key} className="rounded-lg border border-border/50 bg-card px-3 py-2">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                    {label}
                                    {hasOverride ? (
                                      <span className="ml-1 text-primary" title="Override ativo">*</span>
                                    ) : null}
                                  </p>
                                  <p className="mt-0.5 text-sm font-bold tabular-nums">
                                    {used != null ? `${used} / ` : ""}
                                    {formatPlanCap(limit)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {snap.detail.limitsOverride ? (
                          <p className="flex items-center gap-1.5 text-xs text-primary">
                            <Minus className="h-3.5 w-3.5" />
                            Esta organização tem overrides personalizados nos limites.
                          </p>
                        ) : null}

                        <div className="flex gap-2 pt-1">
                          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                            <Link to="/revenda/contas?kind=CLIENT">Editar governança</Link>
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                            <Link to="/revenda/planos">Ver planos</Link>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="py-4 text-sm text-muted-foreground">Clique para carregar detalhes.</p>
                    )}
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-dashed bg-muted/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Referência das chaves (API)</CardTitle>
          <CardDescription className="text-xs">
            Campos <code className="rounded bg-muted px-1">featureOverrides</code> e{" "}
            <code className="rounded bg-muted px-1">limitsOverride</code> no PATCH de governança.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b text-left font-semibold uppercase text-muted-foreground">
                  <th className="py-1.5 pr-3">Módulo (chave)</th>
                  <th className="py-1.5">Nome</th>
                </tr>
              </thead>
              <tbody>
                {REVENDA_PLAN_FEATURE_KEYS.map(({ key, label }) => (
                  <tr key={key} className="border-b border-border/30">
                    <td className="py-1.5 pr-3 font-mono text-foreground">{key}</td>
                    <td className="py-1.5 text-muted-foreground">{label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b text-left font-semibold uppercase text-muted-foreground">
                  <th className="py-1.5 pr-3">Limite (chave)</th>
                  <th className="py-1.5">Nome</th>
                </tr>
              </thead>
              <tbody>
                {REVENDA_LIMIT_FIELDS.map(({ key, label }) => (
                  <tr key={key} className="border-b border-border/30">
                    <td className="py-1.5 pr-3 font-mono text-foreground">{key}</td>
                    <td className="py-1.5 text-muted-foreground">{label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
