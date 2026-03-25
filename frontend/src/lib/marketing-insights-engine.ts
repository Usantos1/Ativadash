import type { BusinessGoalMode } from "@/lib/business-goal-mode";

/** Entrada mínima para o motor de decisão (expandir com automação futura). */
export type MarketingInsightsMetrics = {
  goalMode: BusinessGoalMode;
  spend: number;
  clicks: number;
  leads: number;
  impressions: number;
  landingPageViews: number;
  cpl: number | null;
  cplTarget: number | null;
  maxCpl: number | null;
  ctrPct: number | null;
  purchases: number;
};

export type MarketingInsightItem = {
  id: string;
  /** Pausar | Escalar | Ajustar | Página — alinhado ao restante do OS */
  kind: "pausar" | "escalar" | "ajustar" | "pagina" | "volume";
  title: string;
};

/**
 * Regras centrais de leitura operacional.
 * As ações concretas na UI continuam em `buildOperationalActions` / tabela OS;
 * esta função consolida narrativa e pode alimentar alertas, e-mail, etc.
 */
export function generateInsights(m: MarketingInsightsMetrics): MarketingInsightItem[] {
  const out: MarketingInsightItem[] = [];
  const { spend, clicks, leads, impressions, landingPageViews, cpl, cplTarget, maxCpl, ctrPct, purchases } = m;

  if (cpl != null && cplTarget != null && cplTarget > 0 && cpl > cplTarget * 1.12 && spend >= 25) {
    out.push({
      id: "cpl-above-target",
      kind: "pausar",
      title: "CPL acima da meta — priorize pausar ou reduzir orçamento nos piores casos.",
    });
  }
  if (cpl != null && cplTarget != null && cplTarget > 0 && cpl < cplTarget * 0.85 && leads >= 3 && spend >= 20) {
    out.push({
      id: "cpl-below-target",
      kind: "escalar",
      title: "CPL abaixo da meta com volume — boa janela para escalar orçamento.",
    });
  }
  if (ctrPct != null && impressions >= 800 && ctrPct < 0.55) {
    out.push({
      id: "ctr-low",
      kind: "ajustar",
      title: "CTR baixo com volume — testar criativo, ângulo e segmentação.",
    });
  }
  if (clicks >= 80 && leads === 0 && spend >= 40) {
    out.push({
      id: "clicks-no-lead",
      kind: "pagina",
      title: "Muitos cliques sem lead — checar landing, velocidade e oferta.",
    });
  }
  if (landingPageViews >= 50 && clicks > 0 && leads === 0 && landingPageViews / clicks > 0.55) {
    out.push({
      id: "lpv-no-lead",
      kind: "pagina",
      title: "LPV alta sem conversão — formulário, campos e congruência com o anúncio.",
    });
  }
  if (maxCpl != null && maxCpl > 0 && cpl != null && cpl > maxCpl && spend >= 20) {
    out.push({
      id: "cpl-above-max",
      kind: "pausar",
      title: "CPL acima do teto configurado — risco de eficiência.",
    });
  }
  if (spend >= 30 && leads < 2 && (m.goalMode === "LEADS" || m.goalMode === "HYBRID")) {
    out.push({
      id: "low-volume-leads",
      kind: "volume",
      title: "Baixo volume de leads no período — avaliar alcance e orçamento mínimo.",
    });
  }
  if (m.goalMode === "SALES" && purchases === 0 && leads >= 15 && spend >= 50) {
    out.push({
      id: "leads-no-purchase",
      kind: "pagina",
      title: "Leads sem compra — revisar oferta, follow-up e página de vendas.",
    });
  }

  return out;
}
