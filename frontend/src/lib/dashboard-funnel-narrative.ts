import type { AdaptiveFunnelModel } from "@/components/dashboard/funnel-flow.logic";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";

/**
 * Frase executiva curta ao lado do funil (complementa taxas numéricas).
 */
export function buildExecutiveFunnelNarrative(
  model: AdaptiveFunnelModel,
  businessGoalMode: BusinessGoalMode,
  leadLabel: string
): string {
  const k = model.bottleneckKey;
  if (!k) {
    if (businessGoalMode === "LEADS") {
      return `Captação estável no período — acompanhe CPL e taxa de ${leadLabel.toLowerCase()} por clique.`;
    }
    if (businessGoalMode === "SALES") {
      return "Volumes coerentes entre etapas — foque em ROAS e custo por compra nas campanhas campeãs.";
    }
    return "Leia captação e monetização em paralelo: onde há volume e onde há eficiência.";
  }

  const narratives: Record<string, string> = {
    "imp-clk": "Topo do funil pede atenção: poucos cliques para o volume de impressões — criativo e segmentação primeiro.",
    "clk-lpv": "Maior perda entre cliques e LPV — velocidade mobile, URL e evento de página.",
    "lpv-lead": "LPV existe, mas a conversão em lead está abaixo do ideal — oferta, formulário e prova social.",
    "lpv-cart": "Queda entre página e carrinho — preço, frete e clareza do CTA de compra.",
    "cart-chk": "Carrinho sem avanço para checkout — reduza fricção e reforce confiança.",
    "chk-pur": "Checkout iniciado sem fechar compra — pagamento, parcelas e erros de gateway.",
    "clk-conv": "Cliques no Google não viram conversões proporcionais — intenção de busca vs. landing.",
  };

  return narratives[k] ?? model.bottleneckLine;
}
