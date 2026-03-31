import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BarChart3, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchPublicShareSnapshot, type PublicShareSnapshot } from "@/lib/dashboard-share-api";
import { formatNumber, formatSpend } from "@/lib/metrics-format";
import { Link } from "react-router-dom";

const PAGE_LABEL: Record<string, string> = {
  painel: "Painel ADS",
  captacao: "Captação",
  conversao: "Conversão",
  receita: "Receita",
};

export function PublicDashboardSharePage() {
  const { token = "" } = useParams<{ token: string }>();
  const [metaErr, setMetaErr] = useState<string | null>(null);
  const [snap, setSnap] = useState<PublicShareSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      setMetaErr(null);
      setSnap(null);
      try {
        const s = await fetchPublicShareSnapshot(token);
        if (!c) setSnap(s);
      } catch (e) {
        if (!c) setMetaErr(e instanceof Error ? e.message : "Link inválido.");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando visualização compartilhada…</p>
      </div>
    );
  }

  if (metaErr || !snap) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-semibold">Link indisponível</h1>
          <p className="text-sm text-muted-foreground">{metaErr ?? "Não foi possível carregar."}</p>
        </div>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/login">Entrar no Ativa Dash</Link>
        </Button>
      </div>
    );
  }

  const { sections, organizationName, periodLabel, totals, topCampaigns, googleError, metaError } = snap;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-muted/30 to-background">
      <header className="border-b border-border/60 bg-card/90 px-4 py-4 shadow-sm backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Somente leitura</p>
              <h1 className="text-lg font-bold tracking-tight">{organizationName}</h1>
              <p className="text-sm text-muted-foreground">
                {PAGE_LABEL[snap.page] ?? snap.page} · {periodLabel}
              </p>
            </div>
          </div>
          <Button asChild className="rounded-xl">
            <Link to="/login">Entrar</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-8">
        {(googleError || metaError) && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-sm text-foreground">
            <p className="font-medium">Avisos de sincronização</p>
            {googleError ? <p className="mt-1 text-muted-foreground">Google: {googleError}</p> : null}
            {metaError ? <p className="mt-1 text-muted-foreground">Meta: {metaError}</p> : null}
          </div>
        )}

        {sections.kpis ? (
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Indicadores</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Kpi label="Investimento" value={formatSpend(totals.spend)} />
              <Kpi label="Impressões" value={formatNumber(Math.round(totals.impressions))} />
              <Kpi label="Cliques" value={formatNumber(Math.round(totals.clicks))} />
              <Kpi label="CTR" value={totals.ctr != null ? `${totals.ctr.toFixed(2)}%` : "—"} />
              <Kpi label="CPC médio" value={totals.cpc != null ? formatSpend(totals.cpc) : "—"} />
              <Kpi label="Leads (agregado)" value={formatNumber(Math.round(totals.leads))} />
              <Kpi label="CPL" value={totals.cpl != null ? formatSpend(totals.cpl) : "—"} />
              <Kpi label="Receita atrib." value={totals.revenue > 0 ? formatSpend(totals.revenue) : "—"} />
              <Kpi label="ROAS" value={totals.roas != null ? `${totals.roas.toFixed(2)}x` : "—"} />
            </div>
          </section>
        ) : null}

        {sections.table && topCampaigns.length > 0 ? (
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Campanhas (top gasto)</h2>
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-[11px] font-bold uppercase text-muted-foreground">
                    <th className="px-3 py-2">Canal</th>
                    <th className="px-3 py-2">Campanha</th>
                    <th className="px-3 py-2 text-right">Gasto</th>
                    <th className="px-3 py-2 text-right">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {topCampaigns.map((r, i) => (
                    <tr key={`${r.name}-${i}`} className="border-b border-border/40">
                      <td className="px-3 py-2 text-muted-foreground">{r.channel}</td>
                      <td className="max-w-[240px] truncate px-3 py-2 font-medium" title={r.name}>
                        {r.name}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatSpend(r.spend)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(Math.round(r.leads))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {!sections.kpis && !sections.table ? (
          <p className="text-center text-sm text-muted-foreground">
            Nenhuma seção numérica foi incluída neste link. Peça um novo compartilhamento com as seções desejadas.
          </p>
        ) : null}

        <p className="text-center text-xs text-muted-foreground">
          Os dados refletem o período fixado no link, não o dia de hoje. O Ativa Dash não permite ações nesta página.
        </p>
      </main>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
