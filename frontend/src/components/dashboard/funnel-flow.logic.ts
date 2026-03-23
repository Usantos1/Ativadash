import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";

export type FlowVisualizationMode = "classic" | "hybrid";

export type FunnelStep = {
  id: string;
  label: string;
  short: string;
  value: number | null;
  unavailable?: boolean;
};

export type FunnelTransition = {
  key: string;
  from: FunnelStep;
  to: FunnelStep;
  ratePct: number | null;
  formula: string;
  displayLabel: string;
  isExpansion: boolean;
  isBottleneck: boolean;
};

export type ClassicFunnelGeometry = {
  /** Meia-largura em unidades do viewBox (0–100) por etapa, para trapézios. */
  halfWidths: number[];
  viewHeight: number;
  segmentHeight: number;
  topPad: number;
  viewWidth: number;
  centerX: number;
  polygons: { points: string; transitionIndex: number }[];
};

export type AdaptiveFunnelModel = {
  mode: FlowVisualizationMode;
  steps: FunnelStep[];
  transitions: FunnelTransition[];
  bottleneckKey: string | null;
  /** Texto curto para badge no header (ex.: Impressões → Cliques). */
  bottleneckBadge: string | null;
  /** Linha única para callout principal. */
  bottleneckLine: string;
  scaleMax: number;
  /** Base para funil clássico (impressões). */
  classicBase: number;
  /** Geometria do funil (larguras monótonas); sempre presente para o bloco executivo. */
  classicGeometry: ClassicFunnelGeometry;
};

function transitionDisplayLabel(fromId: string, toId: string): string {
  const map: Record<string, string> = {
    "imp-clk": "CTR",
    "clk-link": "Cliques → link",
    "link-lpv": "Link → LPV",
    "lpv-lead": "LPV → Leads",
    "lead-chk": "Leads → checkout",
    "chk-pur": "Checkout → compras",
  };
  return map[`${fromId}-${toId}`] ?? `${fromId} → ${toId}`;
}

function rateFormula(from: FunnelStep, to: FunnelStep): string {
  if (from.id === "imp" && to.id === "clk") {
    return "CTR = cliques ÷ impressões × 100";
  }
  return `Taxa = (${to.label}) ÷ (${from.label}) × 100`;
}

export function buildStepsFromSummary(summary: MarketingDashboardSummary): FunnelStep[] {
  const linkKnown = summary.linkClicksReturned && summary.linkClicks != null;
  return [
    { id: "imp", label: "Impressões", short: "Impressões", value: summary.impressions },
    { id: "clk", label: "Cliques", short: "Cliques", value: summary.clicks },
    {
      id: "link",
      label: "Cliques no link",
      short: "Link",
      value: linkKnown ? summary.linkClicks! : null,
      unavailable: !linkKnown,
    },
    { id: "lpv", label: "Landing Page Views", short: "LPV", value: summary.landingPageViews },
    { id: "lead", label: "Leads", short: "Leads", value: summary.leads },
    { id: "chk", label: "Checkout iniciado", short: "Checkout", value: summary.initiateCheckout },
    { id: "pur", label: "Compras", short: "Compras", value: summary.purchases },
  ];
}

function safeRatePct(from: number, to: number | null): number | null {
  if (to == null || from <= 0 || to < 0 || !Number.isFinite(from) || !Number.isFinite(to)) return null;
  const r = (to / from) * 100;
  return Number.isFinite(r) ? r : null;
}

/**
 * Modo clássico quando a cadeia **efetiva** (ordem do funil, ignorando etapas indisponíveis
 * ou sem valor) é não crescente: cada volume conhecido ≥ próximo conhecido.
 * Ex.: sem “cliques no link”, comparam-se impressões → cliques → LPV → …
 * Qualquer expansão (próximo > anterior) ⇒ híbrido (inclui taxa implícita &gt; 100%).
 */
export function determineFlowMode(steps: FunnelStep[]): FlowVisualizationMode {
  const chain = steps
    .filter((s) => !s.unavailable && s.value != null && Number.isFinite(s.value))
    .map((s) => s.value as number);
  if (chain.length <= 1) return "classic";
  for (let i = 0; i < chain.length - 1; i++) {
    if (chain[i + 1] > chain[i]) return "hybrid";
  }
  return "classic";
}

const MAX_HW = 92;
const VB_SEG = 26;
const VB_TOP = 8;
const VB_BOT = 10;
const VB_W = 220;

/** Meia-larguras para trapézios; etapas sem valor preenchidas por média dos vizinhos. */
export function buildClassicFunnelGeometry(steps: FunnelStep[], base: number): ClassicFunnelGeometry {
  const baseNum = Math.max(1, base);
  const raw: (number | null)[] = steps.map((s) => {
    if (s.unavailable || s.value == null) return null;
    const v = s.value;
    return MAX_HW * Math.max(0.035, Math.min(1, v / baseNum));
  });

  for (let pass = 0; pass < steps.length; pass++) {
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] != null) continue;
      const L = i > 0 ? raw[i - 1] : null;
      const R = i < raw.length - 1 ? raw[i + 1] : null;
      if (L != null && R != null) raw[i] = (L + R) / 2;
      else if (L != null) raw[i] = L * 0.92;
      else if (R != null) raw[i] = R * 1.08;
      else raw[i] = MAX_HW * 0.06;
    }
  }

  const halfWidths = raw.map((x) => x ?? MAX_HW * 0.06);
  const n = steps.length - 1;
  const totalH = VB_TOP + n * VB_SEG + VB_BOT;
  const cx = VB_W / 2;
  const polygons: ClassicFunnelGeometry["polygons"] = [];

  /** Silhueta sempre não crescente: volumes que “crescem” na origem não alargam a faixa. */
  for (let i = 1; i < halfWidths.length; i++) {
    halfWidths[i] = Math.min(halfWidths[i], halfWidths[i - 1]);
  }

  for (let i = 0; i < n; i++) {
    const yT = VB_TOP + i * VB_SEG;
    const yB = VB_TOP + (i + 1) * VB_SEG;
    const wT = halfWidths[i];
    const wB = halfWidths[i + 1];
    const x0 = cx - wT;
    const x1 = cx + wT;
    const x2 = cx + wB;
    const x3 = cx - wB;
    polygons.push({
      transitionIndex: i,
      points: `${x0},${yT} ${x1},${yT} ${x2},${yB} ${x3},${yB}`,
    });
  }

  return {
    halfWidths,
    viewHeight: totalH,
    segmentHeight: VB_SEG,
    topPad: VB_TOP,
    viewWidth: VB_W,
    centerX: cx,
    polygons,
  };
}

/** Largura de cada faixa em % do topo (100%), para camadas HTML centralizadas — já monótona. */
export function layerWidthsPercentFromGeometry(geo: ClassicFunnelGeometry): number[] {
  const top = geo.halfWidths[0] || 1;
  return geo.halfWidths.map((h) => (h / top) * 100);
}

export function buildAdaptiveFunnelModel(summary: MarketingDashboardSummary): AdaptiveFunnelModel {
  const steps = buildStepsFromSummary(summary);
  const mode = determineFlowMode(steps);

  const numeric = steps
    .map((s) => s.value)
    .filter((v): v is number => v != null && v >= 0 && Number.isFinite(v));
  const scaleMax = numeric.length ? Math.max(...numeric, 1) : 1;

  const imp = steps[0].value ?? 0;
  const classicBase = imp > 0 ? imp : scaleMax;

  const transitions: FunnelTransition[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    const from = steps[i];
    const to = steps[i + 1];
    const fromV = from.value;
    const toV = to.value;
    let ratePct: number | null = null;
    if (fromV != null && toV != null && fromV > 0) {
      ratePct = safeRatePct(fromV, toV);
    }
    const isExpansion =
      fromV != null && toV != null && fromV > 0 && toV > fromV;

    transitions.push({
      key: `${from.id}-${to.id}`,
      from,
      to,
      ratePct,
      formula: rateFormula(from, to),
      displayLabel: transitionDisplayLabel(from.id, to.id),
      isExpansion,
      isBottleneck: false,
    });
  }

  const dropCandidates = transitions.filter((t) => {
    const fv = t.from.value;
    const tv = t.to.value;
    if (fv == null || tv == null || fv <= 0) return false;
    if (t.to.unavailable) return false;
    return tv <= fv;
  });

  let bottleneckKey: string | null = null;
  let bottleneckLine = "";
  let bottleneckBadge: string | null = null;

  if (dropCandidates.length) {
    let worst = dropCandidates[0];
    let minRate = worst.ratePct ?? Infinity;
    for (const t of dropCandidates) {
      const r = t.ratePct;
      if (r == null) continue;
      if (r < minRate) {
        minRate = r;
        worst = t;
      }
    }
    if (minRate !== Infinity && worst.ratePct != null) {
      bottleneckKey = worst.key;
      worst.isBottleneck = true;
      bottleneckBadge = `${worst.from.short} → ${worst.to.short}`;
      bottleneckLine = `Maior queda relativa: ${worst.from.label} → ${worst.to.label} (${formatRatePlain(worst.ratePct)}).`;
    }
  }

  if (!bottleneckLine) {
    bottleneckLine =
      mode === "classic"
        ? "Volumes não crescem entre etapas consecutivas — funil coerente com visão de perda progressiva."
        : "Algumas etapas superam a anterior: eventos costumam ter origens diferentes na Meta. Compare volumes absolutos.";
  }

  const classicGeometry = buildClassicFunnelGeometry(steps, classicBase);

  return {
    mode,
    steps,
    transitions,
    bottleneckKey,
    bottleneckBadge,
    bottleneckLine,
    scaleMax,
    classicBase,
    classicGeometry,
  };
}

function formatRatePlain(pct: number): string {
  return `${pct.toFixed(2).replace(".", ",")}%`;
}

/** Compatível com consumidores antigos (ex.: testes). Preferir buildAdaptiveFunnelModel. */
export type FunnelFlowModel = {
  steps: FunnelStep[];
  transitions: FunnelTransition[];
  bottleneckKey: string | null;
  bottleneckHeadline: string;
  bottleneckBody: string;
  scaleMax: number;
};

export function buildFunnelFlowModel(summary: MarketingDashboardSummary): FunnelFlowModel {
  const m = buildAdaptiveFunnelModel(summary);
  const dropCandidates = m.transitions.filter((t) => {
    const fv = t.from.value;
    const tv = t.to.value;
    if (fv == null || tv == null || fv <= 0) return false;
    if (t.to.unavailable) return false;
    return tv <= fv;
  });

  let headline = "Fluxo entre etapas";
  let body =
    "As taxas comparam volumes consecutivos; valores acima de 100% indicam que a etapa seguinte superou a anterior (eventos diferentes na Meta).";

  if (m.bottleneckKey) {
    const worst = m.transitions.find((t) => t.key === m.bottleneckKey);
    if (worst?.ratePct != null) {
      headline = "Maior queda relativa";
      body = `${worst.from.short} → ${worst.to.short}: menor conversão entre etapas com volume estável ou em queda (${formatRatePlain(worst.ratePct)}).`;
    }
  } else {
    const anyRates = m.transitions.some((t) => t.ratePct != null);
    if (anyRates && !dropCandidates.length) {
      headline = "Sem queda clara entre etapas";
      body =
        "Não há sequência estritamente decrescente entre etapas com dados — comum quando LPV, leads e compras vêm de definições distintas.";
    }
  }

  return {
    steps: m.steps,
    transitions: m.transitions,
    bottleneckKey: m.bottleneckKey,
    bottleneckHeadline: headline,
    bottleneckBody: body,
    scaleMax: m.scaleMax,
  };
}
