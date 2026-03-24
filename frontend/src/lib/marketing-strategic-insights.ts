import type { BusinessGoalMode } from "@/lib/marketing-settings-api";
import type { ChartDayPoint } from "@/lib/marketing-capture-aggregate";

export type AccountHealth = "healthy" | "attention" | "critical";

export type ChannelComparison = {
  metaCpl: number | null;
  googleCpl: number | null;
  metaRoas: number | null;
  googleRoas: number | null;
  metaLeads: number;
  googleLeads: number;
  metaSpend: number;
  googleSpend: number;
};

export function buildChannelComparison(
  aggM: {
    spend: number;
    leads: number;
    messagingConversationsStarted: number;
    purchases: number;
    purchaseValue: number;
  },
  aggG: { costMicros: number; conversions: number; conversionsValue: number }
): ChannelComparison {
  const metaSpend = aggM.spend;
  const googleSpend = aggG.costMicros / 1_000_000;
  const metaLeadish = aggM.leads + aggM.messagingConversationsStarted;
  const googleLeads = aggG.conversions;
  const metaCpl = metaLeadish > 0 && metaSpend > 0 ? metaSpend / metaLeadish : null;
  const googleCpl = googleLeads > 0 && googleSpend > 0 ? googleSpend / googleLeads : null;
  const metaRoas = metaSpend > 0 && aggM.purchaseValue > 0 ? aggM.purchaseValue / metaSpend : null;
  const googleRoas =
    googleSpend > 0 && (aggG.conversionsValue ?? 0) > 0 ? (aggG.conversionsValue ?? 0) / googleSpend : null;
  return {
    metaCpl,
    googleCpl,
    metaRoas,
    googleRoas,
    metaLeads: metaLeadish,
    googleLeads,
    metaSpend,
    googleSpend,
  };
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(n));
}

function formatBrl(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Resumo automático Meta vs Google + recomendação. */
export function buildSmartChannelSummary(
  mode: BusinessGoalMode,
  ch: ChannelComparison,
  hasMeta: boolean,
  hasGoogle: boolean
): { bullets: string[]; recommendation: string } {
  const bullets: string[] = [];

  if (!hasMeta && !hasGoogle) {
    return {
      bullets: ["Conecte Meta ou Google para comparar canais."],
      recommendation: "Configure integrações.",
    };
  }
  if (hasMeta && !hasGoogle) {
    if (mode === "SALES" && ch.metaRoas != null) {
      bullets.push(`Meta Ads: ROAS ${ch.metaRoas.toFixed(2)}x.`);
    } else if (ch.metaCpl != null) {
      bullets.push(`Meta Ads: CPL médio ${formatBrl(ch.metaCpl)} · ${fmtInt(ch.metaLeads)} leads.`);
    } else {
      bullets.push("Meta Ads: sem leads no período com gasto — revisar campanhas.");
    }
    return {
      bullets,
      recommendation: "Otimize campanhas com melhor custo por resultado antes de aumentar verba.",
    };
  }
  if (!hasMeta && hasGoogle) {
    if (mode === "SALES" && ch.googleRoas != null) {
      bullets.push(`Google Ads: ROAS ${ch.googleRoas.toFixed(2)}x.`);
    } else if (ch.googleCpl != null) {
      bullets.push(`Google Ads: CPA ${formatBrl(ch.googleCpl)} · ${fmtInt(ch.googleLeads)} conversões.`);
    } else {
      bullets.push("Google Ads: gasto sem conversões no período.");
    }
    return { bullets, recommendation: "Priorize palavras e anúncios com menor CPA." };
  }

  if (mode === "SALES") {
    const mr = ch.metaRoas;
    const gr = ch.googleRoas;
    if (mr != null && gr != null) {
      if (mr > gr * 1.08) bullets.push(`Meta com ROAS mais alto (${mr.toFixed(2)}x vs ${gr.toFixed(2)}x Google).`);
      else if (gr > mr * 1.08) bullets.push(`Google com ROAS mais alto (${gr.toFixed(2)}x vs ${mr.toFixed(2)}x Meta).`);
      else bullets.push(`ROAS pareado: Meta ${mr.toFixed(2)}x · Google ${gr.toFixed(2)}x.`);
    }
    if (ch.metaCpl != null && ch.googleCpl != null) {
      bullets.push(
        ch.metaCpl <= ch.googleCpl
          ? `Custo por resultado: Meta ${formatBrl(ch.metaCpl)} (melhor) vs Google ${formatBrl(ch.googleCpl)}.`
          : `Custo por resultado: Google ${formatBrl(ch.googleCpl)} (melhor) vs Meta ${formatBrl(ch.metaCpl)}.`
      );
    }
    const rec =
      mr != null && gr != null && mr > gr * 1.12
        ? "Foque em escalar Meta enquanto ROAS se mantém; use Google como complemento."
        : gr != null && mr != null && gr > mr * 1.12
          ? "Foque em escalar Google; Meta para testes ou remarketing."
          : "Realoque verba lentamente para a rede com ROAS mais estável.";
    return { bullets, recommendation: rec };
  }

  if (ch.metaCpl != null && ch.googleCpl != null) {
    if (ch.metaCpl < ch.googleCpl * 0.92) {
      bullets.push(`Meta com CPL mais baixo (${formatBrl(ch.metaCpl)} vs ${formatBrl(ch.googleCpl)} Google).`);
    } else if (ch.googleCpl < ch.metaCpl * 0.92) {
      bullets.push(`Google com CPA mais baixo (${formatBrl(ch.googleCpl)} vs ${formatBrl(ch.metaCpl)} Meta).`);
    } else {
      bullets.push(`CPL equilibrado: Meta ${formatBrl(ch.metaCpl)} · Google ${formatBrl(ch.googleCpl)}.`);
    }
  } else {
    if (ch.metaCpl == null && ch.metaSpend > 20) bullets.push("Meta gastando sem leads rastreados — confira pixel/formulário.");
    if (ch.googleCpl == null && ch.googleSpend > 20) bullets.push("Google gastando sem conversões — confira tag e palavras.");
  }

  const recommendation =
    ch.metaCpl != null && ch.googleCpl != null
      ? ch.metaCpl < ch.googleCpl * 0.92
        ? "Foque em escalar Meta neste momento; refine Google para aproximar o CPL."
        : ch.googleCpl < ch.metaCpl * 0.92
          ? "Foque em escalar Google; use Meta para testes de audiência."
          : "Mantenha mix e teste incremento na rede com menor variância de CPL."
      : "Corrija rastreamento e só então escale o canal que mostrar CPL consistente.";

  return { bullets, recommendation };
}

export function deriveAccountHealth(params: {
  mode: BusinessGoalMode;
  filteredSpend: number;
  leadsReais: number;
  roasBlend: number | null;
  blendCpl: number;
  ctrT: number | null;
  targetCpa: number | null;
  maxCpa: number | null;
  targetRoas: number | null;
}): AccountHealth {
  const { filteredSpend, leadsReais, roasBlend, blendCpl, ctrT, targetCpa, maxCpa, targetRoas, mode } = params;

  if (filteredSpend >= 80 && leadsReais === 0 && (mode === "LEADS" || mode === "HYBRID")) {
    return "critical";
  }
  if (maxCpa != null && maxCpa > 0 && leadsReais > 0 && blendCpl > maxCpa * 1.15) {
    return "critical";
  }
  if (targetRoas != null && targetRoas > 0 && roasBlend != null && roasBlend < targetRoas * 0.65) {
    return "critical";
  }

  if (targetCpa != null && targetCpa > 0 && leadsReais > 0 && blendCpl > targetCpa * 1.25) {
    return "attention";
  }
  if (targetRoas != null && targetRoas > 0 && roasBlend != null && roasBlend < targetRoas * 0.9) {
    return "attention";
  }
  if (ctrT != null && ctrT < 0.25 && filteredSpend > 50) {
    return "attention";
  }

  if (leadsReais > 0 && (targetCpa == null || blendCpl <= targetCpa * 1.05) && (targetRoas == null || roasBlend == null || roasBlend >= targetRoas)) {
    return "healthy";
  }
  if (mode === "SALES" && roasBlend != null && roasBlend >= 2 && filteredSpend > 0) {
    return "healthy";
  }
  return "attention";
}

export type FunnelStepStatus = "good" | "ok" | "bad";

export type FunnelDiagnosis = {
  steps: { key: string; label: string; rate: string; status: FunnelStepStatus }[];
  bottleneckKey: string | null;
  bottleneckTitle: string | null;
  principalProblem: string | null;
};

function scoreCtr(pct: number): number {
  if (pct >= 1.2) return 3;
  if (pct >= 0.45) return 2;
  return 1;
}

function scoreClickLead(pct: number | null): number {
  if (pct == null) return 1;
  if (pct >= 8) return 3;
  if (pct >= 2) return 2;
  return 1;
}

function scoreLeadSale(pct: number | null, hasMetaLeads: boolean): number {
  if (!hasMetaLeads) return 2;
  if (pct == null || pct <= 0) return 1;
  if (pct >= 3) return 3;
  if (pct >= 0.8) return 2;
  return 1;
}

export function diagnoseConversionFunnel(params: {
  goalMode: BusinessGoalMode;
  ctrT: number | null;
  surveyRatePct: number | null;
  leadToSalePct: number | null;
  aggMLeads: number;
}): FunnelDiagnosis {
  const { goalMode, ctrT, surveyRatePct, leadToSalePct, aggMLeads } = params;
  const ctrVal = ctrT ?? 0;
  const steps: FunnelDiagnosis["steps"] = [];

  const sCtr = scoreCtr(ctrVal);
  steps.push({
    key: "imp_click",
    label: "Impressão → clique (CTR)",
    rate: ctrT != null ? `${ctrT.toFixed(2)}%` : "—",
    status: sCtr === 3 ? "good" : sCtr === 2 ? "ok" : "bad",
  });

  const sCl = scoreClickLead(surveyRatePct);
  steps.push({
    key: "click_lead",
    label: "Clique → lead (página)",
    rate: surveyRatePct != null ? `${surveyRatePct.toFixed(2)}%` : "—",
    status: sCl === 3 ? "good" : sCl === 2 ? "ok" : "bad",
  });

  const endInLead = goalMode === "LEADS";
  if (!endInLead) {
    const sLs = scoreLeadSale(leadToSalePct, aggMLeads > 0);
    steps.push({
      key: "lead_sale",
      label: "Lead → compra (Meta)",
      rate: leadToSalePct != null ? `${leadToSalePct.toFixed(2)}%` : "—",
      status: sLs === 3 ? "good" : sLs === 2 ? "ok" : "bad",
    });
  }

  let worst = steps[0];
  for (const s of steps) {
    const ord = { bad: 0, ok: 1, good: 2 };
    if (ord[s.status] < ord[worst.status]) worst = s;
  }

  let principalProblem: string | null = null;
  if (worst.status === "bad") {
    if (worst.key === "imp_click") {
      principalProblem = "CTR baixo — teste criativos, oferta no anúncio e segmentação.";
    } else if (worst.key === "click_lead") {
      principalProblem = "Clique → lead fraco — landing, velocidade e congruência com o anúncio.";
    } else {
      principalProblem =
        leadToSalePct != null && leadToSalePct < 0.5 && aggMLeads > 0
          ? "Lead → compra próximo de zero — funil comercial, checkout e remarketing."
          : "Conversão lead → compra abaixo do esperado no Meta.";
    }
  }

  return {
    steps,
    bottleneckKey: worst.status === "bad" ? worst.key : null,
    bottleneckTitle: worst.status === "bad" ? `Gargalo principal: ${worst.label}` : null,
    principalProblem,
  };
}

export function chartLeadExtrema(data: ChartDayPoint[], minSpendDay = 15): {
  best: { date: string; leads: number; index: number } | null;
  worst: { date: string; leads: number; index: number } | null;
  highlightIndices: Set<number>;
} {
  const candidates = data
    .map((d, index) => ({ d, index }))
    .filter(({ d }) => d.gasto >= minSpendDay);
  if (!candidates.length) {
    return { best: null, worst: null, highlightIndices: new Set() };
  }
  let bestI = 0;
  let worstI = 0;
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].d.leads > candidates[bestI].d.leads) bestI = i;
    if (candidates[i].d.leads < candidates[worstI].d.leads) worstI = i;
  }
  const best = candidates[bestI];
  const worst = candidates[worstI];
  const highlightIndices = new Set<number>();
  highlightIndices.add(best.index);
  if (worst.index !== best.index) highlightIndices.add(worst.index);
  return {
    best: { date: best.d.date, leads: Math.round(best.d.leads), index: best.index },
    worst: { date: worst.d.date, leads: Math.round(worst.d.leads), index: worst.index },
    highlightIndices,
  };
}

export type CampaignEfficiencyTone = "good" | "bad" | "neutral";

/** CPL/ROAS vs mediana do recorte; mesmo comprimento que `rows` (ex.: ordenado). */
export function campaignEfficiencyTonesSorted(
  mode: BusinessGoalMode,
  rows: { spend: number; leads: number; sales: number; revenue: number }[]
): CampaignEfficiencyTone[] {
  const minSpend = 35;
  const out: CampaignEfficiencyTone[] = rows.map(() => "neutral");
  const withEff = rows
    .map((r, index) => ({ ...r, index }))
    .filter((r) => r.spend >= minSpend)
    .map((r) => {
      const leadish = r.leads + r.sales;
      const cpa = leadish > 0 ? r.spend / leadish : null;
      const roas = r.spend > 0 && r.revenue > 0 ? r.revenue / r.spend : null;
      return { ...r, cpa, roas };
    });

  const med = (nums: number[]) => {
    const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
  };

  const medCpa = med(withEff.map((r) => r.cpa).filter((n): n is number => n != null));
  const medRoas = med(withEff.map((r) => r.roas).filter((n): n is number => n != null));

  for (const r of rows.map((row, index) => ({ ...row, index }))) {
    if (r.spend < minSpend) continue;
    const leadish = r.leads + r.sales;
    const cpa = leadish > 0 ? r.spend / leadish : null;
    const roas = r.spend > 0 && r.revenue > 0 ? r.revenue / r.spend : null;

    let tone: CampaignEfficiencyTone = "neutral";
    if (mode === "SALES") {
      if (medRoas != null && roas != null) {
        if (roas >= medRoas * 1.12) tone = "good";
        else if (roas <= medRoas * 0.72) tone = "bad";
      } else if (cpa != null && medCpa != null) {
        if (cpa <= medCpa * 0.85) tone = "good";
        else if (cpa >= medCpa * 1.28) tone = "bad";
      }
    } else if (mode === "LEADS") {
      if (cpa != null && medCpa != null) {
        if (cpa <= medCpa * 0.85) tone = "good";
        else if (cpa >= medCpa * 1.28) tone = "bad";
      }
    } else {
      let goodSignals = 0;
      let badSignals = 0;
      if (cpa != null && medCpa != null) {
        if (cpa <= medCpa * 0.88) goodSignals++;
        if (cpa >= medCpa * 1.25) badSignals++;
      }
      if (roas != null && medRoas != null) {
        if (roas >= medRoas * 1.1) goodSignals++;
        if (roas <= medRoas * 0.75) badSignals++;
      }
      if (goodSignals >= 1 && badSignals === 0) tone = "good";
      else if (badSignals >= 1 && goodSignals === 0) tone = "bad";
    }
    out[r.index] = tone;
  }
  return out;
}
