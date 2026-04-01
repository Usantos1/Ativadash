import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BarChart3, ExternalLink, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchPublicShareSnapshot, type PublicShareSnapshot } from "@/lib/dashboard-share-api";
import { campaignManagerUrl } from "@/lib/ads-manager-links";
import { formatNumber, formatSpend } from "@/lib/metrics-format";
import { Link } from "react-router-dom";
import type { ChartDayPoint } from "@/lib/marketing-capture-aggregate";
import { chartLeadExtrema } from "@/lib/marketing-strategic-insights";
import { CaptureTrendComposedChart } from "@/components/marketing/CaptureTrendComposedChart";
import { MarketingFunnelStrip, type FunnelStripStep } from "@/components/marketing/MarketingCockpit";

const PAGE_LABEL: Record<string, string> = {
  painel: "Painel ADS",
  captacao: "Captação",
  conversao: "Conversão",
  receita: "Receita",
};

function computePublicFunnelWorstKey(
  ctrT: number | null,
  clicksT: number,
  lpv: number,
  leadsReais: number
): string | null {
  const ctrS = ctrT == null ? 1 : ctrT >= 1 ? 3 : ctrT >= 0.5 ? 2 : 0;
  const lpvS =
    clicksT < 10 ? 2 : lpv / Math.max(1, clicksT) >= 0.28 ? 3 : lpv / Math.max(1, clicksT) >= 0.12 ? 2 : 0;
  const leadS =
    clicksT < 10
      ? 2
      : leadsReais / Math.max(1, clicksT) >= 0.04
        ? 3
        : leadsReais / Math.max(1, clicksT) >= 0.015
          ? 2
          : 0;
  const ranked = [
    { key: "clk" as const, s: ctrS },
    { key: "lpv" as const, s: lpvS },
    { key: "lead" as const, s: leadS },
  ];
  ranked.sort((a, b) => a.s - b.s);
  return ranked[0].s < 2 ? ranked[0].key : null;
}

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

  useEffect(() => {
    if (!snap) return;
    const prev = document.title;
    document.title = `${snap.organizationName} · ${PAGE_LABEL[snap.page] ?? snap.page} · ${snap.periodLabel}`;
    return () => {
      document.title = prev;
    };
  }, [snap]);

  const chartData: ChartDayPoint[] = useMemo(() => {
    if (!snap?.chartSeries?.length) return [];
    return snap.chartSeries.map((p) => ({
      date: p.date,
      isoDate: p.isoDate,
      gasto: p.gasto,
      leads: p.leads,
      cpa: p.cpa,
    }));
  }, [snap]);

  const chartExtrema = useMemo(() => chartLeadExtrema(chartData), [chartData]);

  const funnelBlock = useMemo(() => {
    if (!snap) return { steps: [] as FunnelStripStep[], worstKey: null as string | null };
    const lpv = snap.metaLandingPageViews ?? 0;
    const impressionsT = snap.totals.impressions;
    const clicksT = snap.totals.clicks;
    const leadsReais = snap.totals.leads;
    const ctrT = snap.totals.ctr;
    const lpvPerClick = clicksT > 0 ? (lpv / clicksT) * 100 : null;
    const leadPerClick = clicksT > 0 ? (leadsReais / clicksT) * 100 : null;
    const steps: FunnelStripStep[] = [
      { key: "impr", title: "Impressões", volume: impressionsT, ratePct: null },
      { key: "clk", title: "Cliques", volume: clicksT, ratePct: ctrT },
      { key: "lpv", title: "LPV", volume: lpv, ratePct: lpvPerClick },
      { key: "lead", title: "Leads", volume: leadsReais, ratePct: leadPerClick },
    ];
    const worstKey = computePublicFunnelWorstKey(ctrT, clicksT, lpv, leadsReais);
    return { steps, worstKey };
  }, [snap]);

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
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
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

        {(sections.kpis || sections.chart) && (snap.hasGoogle || snap.hasMeta) ? (
          <section className="rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Funil</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Mesma lógica do Painel ADS: impressões → cliques (CTR) → visualizações de LP (Meta) → leads.
            </p>
            <MarketingFunnelStrip steps={funnelBlock.steps} worstKey={funnelBlock.worstKey} />
          </section>
        ) : null}

        {sections.chart && (snap.hasGoogle || snap.hasMeta) ? (
          <section className="overflow-hidden rounded-xl border border-border/50 bg-card/40 p-3 shadow-sm sm:p-4">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">Tendência no período</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Gasto diário, CPA e leads — alinhado ao período fixado neste link.
            </p>
            <CaptureTrendComposedChart
              embedded
              title="Valor gasto, CPA e leads (por dia)"
              data={chartData}
              barHighlight={{
                bestIndex: chartExtrema.best?.index ?? null,
                worstIndex: chartExtrema.worst?.index ?? null,
              }}
            />
          </section>
        ) : null}

        {sections.table && topCampaigns.length > 0 ? (
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Campanhas (top gasto)
            </h2>
            <p className="mb-2 text-xs text-muted-foreground">
              O nome da campanha liga ao gestor da Meta ou do Google (é preciso sessão nessa rede). Métricas por campanha no mesmo período do link.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2">Canal</th>
                    <th className="min-w-[200px] px-2 py-2">Campanha</th>
                    <th className="px-2 py-2 text-right">Gasto</th>
                    <th className="px-2 py-2 text-right">Impr.</th>
                    <th className="px-2 py-2 text-right">Cliques</th>
                    <th className="px-2 py-2 text-right">CTR</th>
                    <th className="px-2 py-2 text-right">CPC</th>
                    <th className="px-2 py-2 text-right">Leads</th>
                    <th className="px-2 py-2 text-right">CPL</th>
                    <th className="px-2 py-2 text-right">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {topCampaigns.map((r, i) => {
                    const impr = r.impressions ?? 0;
                    const clk = r.clicks ?? 0;
                    const ctr =
                      r.ctr != null ? r.ctr : impr > 0 ? (clk / impr) * 100 : null;
                    const cpc = r.cpc != null ? r.cpc : clk > 0 ? r.spend / clk : null;
                    const cpl = r.cpl != null ? r.cpl : r.leads > 0 ? r.spend / r.leads : null;
                    const mgr = campaignManagerUrl(r.channel, r.campaignId);
                    return (
                      <tr key={`${r.channel}-${r.name}-${i}`} className="border-b border-border/40">
                        <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{r.channel}</td>
                        <td className="max-w-[min(280px,28vw)] px-2 py-2">
                          {mgr ? (
                            <a
                              href={mgr}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-full items-center gap-1 font-medium text-primary hover:underline"
                              title="Abrir campanha no gestor de anúncios (Meta ou Google)"
                            >
                              <span className="truncate">{r.name}</span>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                            </a>
                          ) : (
                            <span className="block truncate font-medium text-foreground" title={r.name}>
                              {r.name}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatSpend(r.spend)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {formatNumber(Math.round(impr))}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {formatNumber(Math.round(clk))}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {ctr != null ? `${ctr.toFixed(2)}%` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {cpc != null ? formatSpend(cpc) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {formatNumber(Math.round(r.leads))}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {cpl != null ? formatSpend(cpl) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {r.revenue > 0 ? formatSpend(r.revenue) : "—"}
                        </td>
                      </tr>
                    );
                  })}
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
