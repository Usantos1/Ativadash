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

function pushHybridMetaOnlyCaptacaoMonetizacao(bullets: string[], ch: ChannelComparison): void {
  if (ch.metaCpl != null) {
    bullets.push(
      `Captação (Meta): CPL ${formatBrl(ch.metaCpl)} · ${fmtInt(ch.metaLeads)} leads (inclui conversas, se houver).`
    );
  } else if (ch.metaSpend > 20) {
    bullets.push("Captação (Meta): há gasto, mas sem leads rastreados — pixel, formulário e eventos.");
  }
  if (ch.metaRoas != null) {
    bullets.push(`Monetização (Meta): ROAS ${ch.metaRoas.toFixed(2)}x.`);
  } else if (ch.metaSpend > 20) {
    bullets.push(
      "Monetização (Meta): receita/ROAS não calculável no período — confira atribuição e valor de compra."
    );
  }
}

function pushHybridGoogleOnlyCaptacaoMonetizacao(bullets: string[], ch: ChannelComparison): void {
  if (ch.googleCpl != null) {
    bullets.push(`Captação (Google): CPA ${formatBrl(ch.googleCpl)} · ${fmtInt(ch.googleLeads)} conversões.`);
  } else if (ch.googleSpend > 20) {
    bullets.push("Captação (Google): gasto sem conversões rastreadas — tag, conversões e palavras.");
  }
  if (ch.googleRoas != null) {
    bullets.push(`Monetização (Google): ROAS ${ch.googleRoas.toFixed(2)}x.`);
  } else if (ch.googleSpend > 20) {
    bullets.push(
      "Monetização (Google): receita/ROAS não calculável — confira valor de conversão e lances."
    );
  }
}

function pushRoasComparisonBullets(bullets: string[], ch: ChannelComparison, prefix: string): void {
  const mr = ch.metaRoas;
  const gr = ch.googleRoas;
  if (mr != null && gr != null) {
    if (mr > gr * 1.08) {
      bullets.push(
        `${prefix}Meta com ROAS mais alto (${mr.toFixed(2)}x vs ${gr.toFixed(2)}x no Google).`
      );
    } else if (gr > mr * 1.08) {
      bullets.push(
        `${prefix}Google com ROAS mais alto (${gr.toFixed(2)}x vs ${mr.toFixed(2)}x na Meta).`
      );
    } else {
      bullets.push(`${prefix}ROAS pareado: Meta ${mr.toFixed(2)}x · Google ${gr.toFixed(2)}x.`);
    }
  } else if (mr != null) {
    bullets.push(`${prefix}Só Meta com ROAS calculável (${mr.toFixed(2)}x).`);
  } else if (gr != null) {
    bullets.push(`${prefix}Só Google com ROAS calculável (${gr.toFixed(2)}x).`);
  }
}

function pushCaptacaoComparisonBullets(bullets: string[], ch: ChannelComparison, prefix: string): void {
  if (ch.metaCpl != null && ch.googleCpl != null) {
    if (ch.metaCpl < ch.googleCpl * 0.92) {
      bullets.push(
        `${prefix}Meta com CPL de captação menor (${formatBrl(ch.metaCpl)} vs CPA Google ${formatBrl(ch.googleCpl)}).`
      );
    } else if (ch.googleCpl < ch.metaCpl * 0.92) {
      bullets.push(
        `${prefix}Google com CPA de captação menor (${formatBrl(ch.googleCpl)} vs CPL Meta ${formatBrl(ch.metaCpl)}).`
      );
    } else {
      bullets.push(
        `${prefix}Captação equilibrada: CPL Meta ${formatBrl(ch.metaCpl)} · CPA Google ${formatBrl(ch.googleCpl)}.`
      );
    }
  } else {
    if (ch.metaCpl == null && ch.metaSpend > 20) {
      bullets.push(`${prefix}Meta com gasto e sem leads rastreados — confira pixel e formulário.`);
    }
    if (ch.googleCpl == null && ch.googleSpend > 20) {
      bullets.push(`${prefix}Google com gasto e sem conversões rastreadas — confira tag e palavras.`);
    }
  }
}

/** Resumo automático Meta vs Google + recomendação (vocabulário alinhado ao objetivo: LEADS / SALES / HYBRID). */
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
      recommendation: "Configure integrações e volte ao painel para ver o resumo por rede.",
    };
  }

  if (hasMeta && !hasGoogle) {
    if (mode === "LEADS") {
      if (ch.metaCpl != null) {
        bullets.push(`Meta Ads: CPL ${formatBrl(ch.metaCpl)} · ${fmtInt(ch.metaLeads)} leads.`);
      } else {
        bullets.push("Meta Ads: há gasto, mas sem leads no período — revisar criativos, público e rastreamento.");
      }
      return {
        bullets,
        recommendation: "Escale primeiro o que entregar CPL estável; corrija rastreamento antes de aumentar verba.",
      };
    }
    if (mode === "SALES") {
      if (ch.metaRoas != null) {
        bullets.push(`Meta Ads: ROAS ${ch.metaRoas.toFixed(2)}x (foco em receita atribuída).`);
      } else {
        bullets.push(
          "Meta Ads: ROAS não calculável no período — confira pixel, evento de compra e valor atribuído."
        );
      }
      return {
        bullets,
        recommendation:
          "Priorize escala onde ROAS supera a meta; evite misturar análise de lead com análise de venda neste objetivo.",
      };
    }
    pushHybridMetaOnlyCaptacaoMonetizacao(bullets, ch);
    return {
      bullets: bullets.length ? bullets : ["Meta Ads: dados insuficientes no recorte."],
      recommendation:
        "Decida verba em dois eixos: captação (CPL/leads) e monetização (ROAS) — não trate um como substituto do outro.",
    };
  }

  if (!hasMeta && hasGoogle) {
    if (mode === "LEADS") {
      if (ch.googleCpl != null) {
        bullets.push(`Google Ads: CPA ${formatBrl(ch.googleCpl)} · ${fmtInt(ch.googleLeads)} conversões de captação.`);
      } else {
        bullets.push("Google Ads: gasto sem conversões no período — revisar palavras, anúncios e conversões.");
      }
      return {
        bullets,
        recommendation: "Escale buscas e PMax com menor CPA de conversão; alinhe landing ao anúncio.",
      };
    }
    if (mode === "SALES") {
      if (ch.googleRoas != null) {
        bullets.push(`Google Ads: ROAS ${ch.googleRoas.toFixed(2)}x.`);
      } else {
        bullets.push(
          "Google Ads: ROAS não calculável — confira valores de conversão e escopo das campanhas de venda."
        );
      }
      return {
        bullets,
        recommendation: "Alocar verba pelo retorno (ROAS), não só pelo volume de cliques ou conversões genéricas.",
      };
    }
    pushHybridGoogleOnlyCaptacaoMonetizacao(bullets, ch);
    return {
      bullets: bullets.length ? bullets : ["Google Ads: dados insuficientes no recorte."],
      recommendation:
        "Separe decisões: captação (CPA por conversão configurada) vs monetização (ROAS/receita).",
    };
  }

  if (mode === "SALES") {
    pushRoasComparisonBullets(bullets, ch, "");
    if (!bullets.length) {
      bullets.push(
        "Meta e Google sem ROAS comparável no período — confira atribuição e valores de conversão em ambas as redes."
      );
    }
    const mr = ch.metaRoas;
    const gr = ch.googleRoas;
    const rec =
      mr != null && gr != null && mr > gr * 1.12
        ? "Escale Meta enquanto ROAS se mantiver; use Google como complemento com teto de eficiência."
        : gr != null && mr != null && gr > mr * 1.12
          ? "Escale Google com ROAS líder; Meta para teste, remarketing ou topo de funil controlado."
          : "Realoque verba com cautela para a rede com ROAS mais estável e previsível.";
    return { bullets, recommendation: rec };
  }

  if (mode === "LEADS") {
    pushCaptacaoComparisonBullets(bullets, ch, "");
    if (!bullets.length) {
      bullets.push("Pouco gasto ou métricas de captação incompletas — amplie o período ou confira integrações.");
    }
    const recommendation =
      ch.metaCpl != null && ch.googleCpl != null
        ? ch.metaCpl < ch.googleCpl * 0.92
          ? "Priorize escala na Meta neste recorte; refine Google até aproximar o CPA ao CPL da Meta."
          : ch.googleCpl < ch.metaCpl * 0.92
            ? "Priorize escala no Google; use Meta para testes de mensagem e público."
            : "Mantenha o mix e teste incremento na rede com CPL/CPA mais estável."
        : "Corrija rastreamento em ambas as redes antes de escalar — sem conversões/leads confiáveis não há decisão segura.";
    return { bullets, recommendation };
  }

  pushCaptacaoComparisonBullets(bullets, ch, "Captação — ");
  pushRoasComparisonBullets(bullets, ch, "Monetização — ");
  if (!bullets.length) {
    bullets.push(
      "Captação e monetização sem sinais claros neste recorte — confira tags, pixel e valores de conversão."
    );
  }
  const mr = ch.metaRoas;
  const gr = ch.googleRoas;
  const mc = ch.metaCpl;
  const gc = ch.googleCpl;
  const capOk = mc != null && gc != null;
  const roasOk = mr != null && gr != null;
  let recommendation =
    "Use dois critérios: captação (CPL Meta vs CPA Google) e monetização (ROAS) — não confunda um com o outro.";
  if (capOk && roasOk && mc != null && gc != null && mr != null && gr != null) {
    if (mc < gc * 0.92 && mr > gr * 1.08) {
      recommendation =
        "Meta lidera em captação e ROAS neste recorte: candidata a receber mais verba, com monitoramento diário.";
    } else if (gc < mc * 0.92 && gr > mr * 1.08) {
      recommendation =
        "Google lidera em captação e ROAS: fortaleça esse lado e use Meta para diversificação ou remarketing.";
    }
  }
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
