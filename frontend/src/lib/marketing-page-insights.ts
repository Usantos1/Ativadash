import type { AccountObjective } from "@/lib/business-goal-mode";

/** Alerta orientado à ação (diagnóstico + causa provável + próximo passo). */
export type MarketingDiagnosticAlert = {
  problema: string;
  causa: string;
  acao: string;
  severity: "critical" | "warning" | "info" | "success";
  code: string;
};

export type MarketingPageMetricsInput = {
  objective: AccountObjective;
  /** CTR agregado % (cliques ÷ impressões). */
  ctrPct: number | null;
  prevCtrPct: number | null;
  impressoes: number;
  compareEnabled: boolean;
  gastoFiltrado: number;
  /** Leads totais (Google conv. + leads Meta + conversas). */
  leads: number;
  prevLeads: number;
  /** CPL / custo por lead agregado. */
  cpl: number | null;
  prevCpl: number | null;
  receitaAtribuida: number;
  prevReceitaAtribuida: number;
  roas: number | null;
  prevRoas: number | null;
  /** CPA por compra (gasto ÷ compras totais estimadas). */
  cpaCompra: number | null;
  prevCpaCompra: number | null;
};

const MIN_IMP_CTR = 800;
const MIN_LEADS_COMPARE = 5;
const MIN_GASTO = 30;

/**
 * Diagnósticos automáticos a partir das métricas agregadas da página de marketing.
 * Respeita o objetivo da conta: em LEADS não gera alertas de ROAS/receita; em SALES não gera CPL/leads como foco principal.
 */
export function generateInsights(metrics: MarketingPageMetricsInput): MarketingDiagnosticAlert[] {
  const out: MarketingDiagnosticAlert[] = [];
  const { objective, compareEnabled } = metrics;

  const ctrLow =
    metrics.impressoes >= MIN_IMP_CTR &&
    metrics.ctrPct != null &&
    Number.isFinite(metrics.ctrPct) &&
    metrics.ctrPct < 2;

  if (ctrLow) {
    const ctrCaiu =
      compareEnabled &&
      metrics.prevCtrPct != null &&
      metrics.ctrPct != null &&
      metrics.prevCtrPct > 0 &&
      metrics.ctrPct < metrics.prevCtrPct * 0.92;
    out.push({
      code: "ctr_baixo",
      severity: "warning",
      problema: "CTR abaixo de 2%",
      causa: ctrCaiu
        ? "CTR caiu em relação ao período anterior — menos cliques por impressão."
        : "Poucos cliques por impressão no período — criativo ou oferta podem estar fracos.",
      acao: "Testar novos criativos, ângulos de oferta e segmentações; revisar frequência e relevância do anúncio.",
    });
  }

  const leadMode = objective === "LEADS" || objective === "HYBRID";
  const salesMode = objective === "SALES" || objective === "HYBRID";

  if (leadMode && compareEnabled && metrics.gastoFiltrado >= MIN_GASTO) {
    if (
      metrics.prevLeads >= MIN_LEADS_COMPARE &&
      metrics.leads < metrics.prevLeads * 0.9
    ) {
      const causa =
        metrics.prevCtrPct != null &&
        metrics.ctrPct != null &&
        metrics.ctrPct < metrics.prevCtrPct * 0.95
          ? "Causa provável: CTR caiu — menos tráfego qualificado chegando à página."
          : "Menos conversões no mesmo tipo de gasto — landing, formulário ou público podem ter piorado.";
      out.push({
        code: "leads_caindo",
        severity: "warning",
        problema: "Volume de leads caiu vs. período anterior",
        causa,
        acao: "Auditar landing e formulário; revisar públicos e anúncios com melhor histórico de lead.",
      });
    }

    if (
      metrics.cpl != null &&
      metrics.prevCpl != null &&
      metrics.prevCpl > 0 &&
      metrics.cpl > metrics.prevCpl * 1.08
    ) {
      const causa =
        metrics.prevCtrPct != null &&
        metrics.ctrPct != null &&
        metrics.ctrPct < metrics.prevCtrPct * 0.95
          ? "Causa: CTR caiu — cada clique ficou mais caro em relação a leads."
          : "Causa: pior taxa clique → lead ou CPC mais alto — eficiência do funil topo/meio piorou.";
      out.push({
        code: "cpl_subindo",
        severity: "warning",
        problema: "CPL subiu vs. período anterior",
        causa,
        acao: "Pausar criativos/públicos piores; escalar o que tem menor CPL; checar página de destino.",
      });
    }
  }

  if (salesMode && compareEnabled && metrics.gastoFiltrado >= MIN_GASTO) {
    if (
      metrics.receitaAtribuida > 0 &&
      metrics.prevReceitaAtribuida > 50 &&
      metrics.receitaAtribuida < metrics.prevReceitaAtribuida * 0.88
    ) {
      out.push({
        code: "receita_caindo",
        severity: "warning",
        problema: "Receita atribuída caiu vs. período anterior",
        causa:
          metrics.roas != null && metrics.prevRoas != null && metrics.roas < metrics.prevRoas * 0.9
            ? "ROAS também caiu — o retorno por real gasto piorou."
            : "Menos valor convertido no período — campanhas, oferta ou sazonalidade.",
        acao: "Revisar campanhas com pior ROAS; testar oferta e remarketing; alinhar criativo à intenção de compra.",
      });
    }

    if (
      metrics.cpaCompra != null &&
      metrics.prevCpaCompra != null &&
      metrics.prevCpaCompra > 0 &&
      metrics.cpaCompra > metrics.prevCpaCompra * 1.1
    ) {
      out.push({
        code: "cpa_subindo",
        severity: "warning",
        problema: "CPA (custo por compra) subiu vs. período anterior",
        causa:
          metrics.ctrPct != null && metrics.prevCtrPct != null && metrics.ctrPct < metrics.prevCtrPct * 0.95
            ? "Causa: CTR caiu — topo do funil mais caro."
            : "Causa: pior conversão após o clique — página, checkout ou público.",
        acao: "Priorizar públicos e anúncios com histórico de compra; revisir página de destino e pós-clique.",
      });
    }

    if (
      metrics.roas != null &&
      metrics.prevRoas != null &&
      metrics.prevRoas > 0.5 &&
      metrics.roas < metrics.prevRoas * 0.85
    ) {
      out.push({
        code: "roas_caindo",
        severity: "warning",
        problema: "ROAS caiu vs. período anterior",
        causa:
          metrics.cpaCompra != null &&
          metrics.prevCpaCompra != null &&
          metrics.cpaCompra > metrics.prevCpaCompra * 1.05
            ? "Causa: CPA subiu — cada venda está custando mais."
            : "Menos receita por real investido — mix de campanhas ou ticket médio.",
        acao: "Reduzir escala onde ROAS está abaixo da meta; reforçar criativos e públicos com melhor retorno.",
      });
    }
  }

  return out;
}
