import type { BusinessGoalMode } from "./business-goal-mode";

export type ChannelPerformanceSignal = "best" | "attention" | null;

const REL_TIE = 0.06;

function isValidCost(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0;
}

function isValidRoas(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0;
}

/**
 * Compara Meta vs Google para exibir "Melhor desempenho" / "Atenção" nos headers.
 * LEADS: menor CPL (Meta) vs CPA (Google).
 * SALES: maior ROAS.
 * HYBRID: ROAS quando ambos > 0; senão custo por resultado.
 */
export function deriveChannelPerformanceSignals(
  mode: BusinessGoalMode,
  meta: {
    cpl: number | null;
    costPerPurchase: number | null;
    roas: number | null;
  },
  google: { costPerConv: number | null; roas: number | null }
): { meta: ChannelPerformanceSignal; google: ChannelPerformanceSignal } {
  const neutral = { meta: null as ChannelPerformanceSignal, google: null as ChannelPerformanceSignal };

  if (mode === "SALES") {
    const m = meta.roas;
    const g = google.roas;
    if (!isValidRoas(m) || !isValidRoas(g)) return neutral;
    const maxR = Math.max(m, g);
    if (maxR <= 0) return neutral;
    if (Math.abs(m - g) / maxR < REL_TIE) return neutral;
    if (m > g) return { meta: "best", google: "attention" };
    return { meta: "attention", google: "best" };
  }

  if (mode === "LEADS") {
    const m = meta.cpl;
    const g = google.costPerConv;
    if (!isValidCost(m) || !isValidCost(g)) return neutral;
    const maxC = Math.max(m, g);
    if (Math.abs(m - g) / maxC < REL_TIE) return neutral;
    if (m < g) return { meta: "best", google: "attention" };
    return { meta: "attention", google: "best" };
  }

  // HYBRID
  const mR = meta.roas;
  const gR = google.roas;
  if (isValidRoas(mR) && isValidRoas(gR)) {
    const maxR = Math.max(mR, gR);
    if (Math.abs(mR - gR) / maxR < REL_TIE) return neutral;
    if (mR > gR) return { meta: "best", google: "attention" };
    return { meta: "attention", google: "best" };
  }

  const m = meta.cpl;
  const g = google.costPerConv;
  if (!isValidCost(m) || !isValidCost(g)) return neutral;
  const maxC = Math.max(m, g);
  if (Math.abs(m - g) / maxC < REL_TIE) return neutral;
  if (m < g) return { meta: "best", google: "attention" };
  return { meta: "attention", google: "best" };
}
