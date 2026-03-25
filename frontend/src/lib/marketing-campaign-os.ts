import type { AccountObjective } from "@/lib/business-goal-mode";

export type SmartOperationalLabel = "escalar" | "pausar" | "ajustar";

export type OsCampaignRow = {
  id: string;
  channel: "Meta" | "Google";
  level: "campaign" | "adset" | "ad";
  name: string;
  parentLabel?: string | null;
  externalId?: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  sales: number;
  revenue: number;
  /** Quando a API expõe (ex.: Meta no futuro) */
  effectiveStatus?: "ACTIVE" | "PAUSED" | "ARCHIVED" | "UNKNOWN" | null;
};

export type OsSignals = {
  smart: SmartOperationalLabel;
  suggested: string;
  score: number;
  lossEstimateBrl: number | null;
  upliftHint: string | null;
  ctrPct: number | null;
  cpl: number | null;
  cpa: number | null;
};

const MIN_SPEND_SIGNAL = 20;

function primaryVolume(row: OsCampaignRow, mode: AccountObjective): number {
  if (mode === "SALES") {
    if (row.sales > 0) return row.sales;
    return row.leads;
  }
  return row.leads;
}

function rowCpl(row: OsCampaignRow, mode: AccountObjective): number | null {
  const vol = primaryVolume(row, mode);
  if (mode === "HYBRID") {
    const t = row.leads + row.sales;
    if (t <= 0 || row.spend <= 0) return null;
    return row.spend / t;
  }
  if (vol <= 0 || row.spend <= 0) return null;
  return row.spend / vol;
}

function rowRoas(row: OsCampaignRow): number | null {
  if (row.spend <= 0 || row.revenue <= 0) return null;
  return row.revenue / row.spend;
}

export function medianOf(nums: number[]): number | null {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}

export function computeOsSignals(
  row: OsCampaignRow,
  mode: AccountObjective,
  opts: {
    targetCpl: number | null;
    targetRoas: number | null;
    maxCpl: number | null;
    medianCpl: number | null;
    medianCtr: number | null;
  }
): OsSignals {
  const ctrPct = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : null;
  const cpl = rowCpl(row, mode);
  const cpa = cpl;
  const roas = rowRoas(row);
  const vol = primaryVolume(row, mode);
  const spend = row.spend;

  let smart: SmartOperationalLabel = "ajustar";
  let suggested = "Revisar criativo e segmentação";
  let score = 55;
  let lossEstimateBrl: number | null = null;
  let upliftHint: string | null = null;

  if (spend < MIN_SPEND_SIGNAL) {
    return {
      smart: "ajustar",
      suggested: "Volume baixo — aguardar dados ou ampliar teste",
      score: 50,
      lossEstimateBrl: null,
      upliftHint: null,
      ctrPct,
      cpl,
      cpa,
    };
  }

  if (mode === "LEADS" || mode === "HYBRID") {
    const tgt = opts.targetCpl;
    if (cpl != null && tgt != null && vol > 0) {
      if (cpl <= tgt * 0.92) {
        smart = "escalar";
        suggested = "Aumentar orçamento (CPL abaixo da meta)";
        score = 82;
        const est = Math.max(1, Math.round(vol * 0.15));
        upliftHint = `+20% orçamento → ~${est} leads extra (estimativa)`;
      } else if (cpl >= tgt * 1.18 || (opts.maxCpl != null && cpl >= opts.maxCpl)) {
        smart = "pausar";
        suggested = "Pausar ou reduzir orçamento (CPL acima da meta)";
        score = 28;
        lossEstimateBrl = Math.max(0, (cpl - tgt) * vol);
      } else {
        smart = "ajustar";
        suggested = "Testar novo criativo ou público";
        score = 52;
      }
    }
    if (opts.medianCtr != null && ctrPct != null && row.impressions >= 400) {
      if (ctrPct < opts.medianCtr * 0.65) {
        smart = "ajustar";
        suggested = "CTR baixo — testar criativo";
        score = Math.min(score, 45);
      } else if (ctrPct > opts.medianCtr * 1.2) {
        score = Math.min(100, score + 8);
      }
    }
  }

  if (mode === "SALES" || (mode === "HYBRID" && row.sales > 0 && roas != null)) {
    const tgtR = opts.targetRoas;
    if (roas != null && tgtR != null && row.sales > 0) {
      if (roas >= tgtR * 1.05) {
        smart = "escalar";
        suggested = "ROAS forte — escalar investimento";
        score = Math.max(score, 80);
        upliftHint = `+20% orçamento → revisar estoque de conversões`;
      } else if (roas <= tgtR * 0.82) {
        smart = "pausar";
        suggested = "Pausar ou cortar orçamento (ROAS fraco)";
        score = Math.min(score, 32);
        lossEstimateBrl = Math.max(0, row.spend - row.revenue / Math.max(tgtR, 0.01));
      }
    }
  }

  if (opts.medianCpl != null && cpl != null && cpl < opts.medianCpl * 0.85) {
    score = Math.min(100, score + 6);
  }
  if (opts.medianCpl != null && cpl != null && cpl > opts.medianCpl * 1.25) {
    score = Math.max(15, score - 10);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    smart,
    suggested,
    score,
    lossEstimateBrl: lossEstimateBrl != null && lossEstimateBrl > 1 ? lossEstimateBrl : null,
    upliftHint,
    ctrPct,
    cpl,
    cpa,
  };
}

export function sortOsRows(
  rows: OsCampaignRow[],
  mode: AccountObjective,
  sort: "spend" | "revenue" | "leads" | "cpl" | "ctr"
): OsCampaignRow[] {
  const copy = [...rows];
  const cplOf = (r: OsCampaignRow) => rowCpl(r, mode);
  const ctrOf = (r: OsCampaignRow) => (r.impressions > 0 ? (r.clicks / r.impressions) * 100 : -1);
  if (sort === "spend") {
    copy.sort((a, b) => b.spend - a.spend);
  } else if (sort === "revenue") {
    copy.sort((a, b) => b.revenue - a.revenue || b.spend - a.spend);
  } else if (sort === "leads") {
    copy.sort((a, b) => primaryVolume(b, mode) - primaryVolume(a, mode) || b.spend - a.spend);
  } else if (sort === "ctr") {
    copy.sort((a, b) => {
      const ca = ctrOf(a);
      const cb = ctrOf(b);
      if (ca < 0 && cb < 0) return b.spend - a.spend;
      if (ca < 0) return 1;
      if (cb < 0) return -1;
      return ca - cb;
    });
  } else {
    copy.sort((a, b) => {
      const pa = cplOf(a);
      const pb = cplOf(b);
      const sa = pa != null && pa > 0 ? pa : -1;
      const sb = pb != null && pb > 0 ? pb : -1;
      if (sa < 0 && sb < 0) return b.spend - a.spend;
      if (sa < 0) return 1;
      if (sb < 0) return -1;
      return sb - sa;
    });
  }
  return copy;
}
