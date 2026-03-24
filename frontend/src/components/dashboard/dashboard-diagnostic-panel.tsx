import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import type { MetaAdsMetricsSummary } from "@/lib/integrations-api";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";

export type DashboardDiagnostic = {
  id: string;
  problem: string;
  likelyCause: string;
  suggestedAction: string;
};

export function buildDashboardDiagnostics(params: {
  summary: MarketingDashboardSummary;
  businessGoalMode: BusinessGoalMode;
  primaryConversionLabel?: string | null;
  compareEnabled: boolean;
  metaCmp: MetaAdsMetricsSummary | null;
}): DashboardDiagnostic[] {
  const { summary: s, businessGoalMode, primaryConversionLabel, compareEnabled, metaCmp } = params;
  const leadWord = primaryConversionLabel?.trim() || "Leads";
  const d = s.derived;
  const out: DashboardDiagnostic[] = [];

  if (s.impressions >= 2_000 && d.ctrPct != null && d.ctrPct < 1.5) {
    out.push({
      id: "ctr-weak",
      problem: "O anúncio não está gerando cliques proporcionais às impressões.",
      likelyCause: "Criativo fraco, oferta pouco clara ou público pouco alinhado.",
      suggestedAction: "Teste 2–3 variações de criativo e restrinja interesses duplicados; revise o primeiro frame do vídeo/imagem.",
    });
  }

  if (businessGoalMode === "SALES" && s.leads > 0 && s.purchases === 0 && s.spend > 0) {
    out.push({
      id: "leads-no-purchase",
      problem: "Há captação, mas nenhuma compra atribuída no período.",
      likelyCause: "Desalinhamento oferta/preço, funil pós-lead ou pixel sem evento de compra.",
      suggestedAction: "Valide eventos de compra no Gerenciador de Eventos e alinhe página de vendas com o prometido no anúncio.",
    });
  }

  if (compareEnabled && metaCmp && s.leads > 0 && metaCmp.leads > 0 && s.spend > 0) {
    const curCpl = s.spend / s.leads;
    const prevCpl = metaCmp.spend / metaCmp.leads;
    if (prevCpl > 0 && curCpl > prevCpl * 1.08) {
      out.push({
        id: "cpl-up",
        problem: `O custo por ${leadWord.toLowerCase()} aumentou em relação ao período anterior.`,
        likelyCause: "Concorrência, cansaço de criativo ou público menos qualificado.",
        suggestedAction: "Pause campanhas com CPL acima da média e realoque orçamento para as que ainda convertem bem.",
      });
    }
  }

  if (s.clicks > 80 && s.landingPageViews > 0 && s.clicks > s.landingPageViews * 1.4) {
    out.push({
      id: "lpv-gap",
      problem: "Muitos cliques no anúncio não viram visualização de página.",
      likelyCause: "Site lento, erro 404 ou discrepância entre anúncio e destino.",
      suggestedAction: "Teste a URL em mobile, ative LPV no pixel e reduza elementos que atrasam o carregamento.",
    });
  }

  return out.slice(0, 5);
}

export function DashboardDiagnosticPanel({
  items,
  className,
}: {
  items: DashboardDiagnostic[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-muted/[0.2] p-4 shadow-[var(--shadow-surface-sm)] sm:p-5",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/35 pb-3">
        <Lightbulb className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <div>
          <h2 className="text-sm font-bold tracking-tight text-foreground">Diagnóstico automático</h2>
          <p className="text-[11px] text-muted-foreground">Problema, causa provável e ação sugerida com base no período.</p>
        </div>
      </div>
      <ul className="mt-3 space-y-3">
        {items.map((it) => (
          <li
            key={it.id}
            className="rounded-xl border border-border/40 bg-background/50 px-3 py-2.5 text-sm leading-snug"
          >
            <p className="font-semibold text-foreground">{it.problem}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/90">Causa provável:</span> {it.likelyCause}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/90">Ação:</span> {it.suggestedAction}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
