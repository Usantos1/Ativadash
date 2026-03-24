import type { BusinessGoalMode } from "@/lib/business-goal-mode";
import type { ChannelPerformanceSignal } from "@/lib/channel-performance-compare";

export type ExecutiveChannelBadge = "best" | "attention" | "scale" | "low_efficiency" | null;

type Input = {
  mode: BusinessGoalMode;
  crossSignal: ChannelPerformanceSignal;
  channel: "meta" | "google";
  /** Canal com melhor eficiência relativa (mesma regra que deriveChannelPerformanceSignals). */
  efficiencyWinner: "meta" | "google" | null;
  cplOrCpa: number | null;
  ctrPct: number | null;
  impressions: number;
  spend: number;
  results: number;
  targetCpaBrl: number | null;
  maxCpaBrl: number | null;
  compareEnabled: boolean;
  resultsDeltaPct: number | undefined;
  spendDeltaPct: number | undefined;
};

function validCost(n: number | null): n is number {
  return n != null && Number.isFinite(n) && n > 0;
}

/**
 * Badge único no topo do card. Prioridade: baixa eficiência → escalar → comparativo Meta×Google.
 */
export function resolveExecutiveChannelBadge(input: Input): ExecutiveChannelBadge {
  const {
    mode,
    crossSignal,
    channel,
    efficiencyWinner,
    cplOrCpa,
    ctrPct,
    impressions,
    spend,
    results,
    targetCpaBrl,
    maxCpaBrl,
    compareEnabled,
    resultsDeltaPct,
    spendDeltaPct,
  } = input;

  const careCost = mode === "LEADS" || mode === "HYBRID";

  if (careCost && validCost(cplOrCpa)) {
    if (maxCpaBrl != null && maxCpaBrl > 0 && cplOrCpa > maxCpaBrl) {
      return "low_efficiency";
    }
    if (targetCpaBrl != null && targetCpaBrl > 0 && cplOrCpa > targetCpaBrl * 1.15) {
      return "low_efficiency";
    }
  }

  if (ctrPct != null && impressions >= 4000 && ctrPct < 0.55) {
    return "low_efficiency";
  }

  if (
    compareEnabled &&
    resultsDeltaPct != null &&
    resultsDeltaPct >= 18 &&
    spend > 80 &&
    results >= 5 &&
    spendDeltaPct != null &&
    spendDeltaPct < 35
  ) {
    return "scale";
  }

  if (efficiencyWinner && crossSignal != null) {
    if (crossSignal === "best" && efficiencyWinner === channel) return "best";
    if (crossSignal === "attention" && efficiencyWinner !== channel) return "attention";
  }

  return null;
}
