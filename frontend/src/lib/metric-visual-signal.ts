/** Saúde visual para métricas do dashboard (metas + variação). */
export type MetricHealth = "good" | "warn" | "bad" | "neutral";

/** Tendência numérica vs período anterior (seta = direção do delta). */
export type MetricTrend = "up" | "down" | "flat" | null;

export function trendFromDeltaPct(deltaPct: number | undefined | null): MetricTrend {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return null;
  if (Math.abs(deltaPct) < 0.35) return "flat";
  return deltaPct > 0 ? "up" : "down";
}

/**
 * Para custo (CPL, CPC, CPA): menor é melhor.
 * Para volume/CTR: maior é melhor (invert = false).
 */
export function healthFromDelta(
  deltaPct: number | undefined | null,
  invert: boolean
): MetricHealth {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return "neutral";
  const improved = invert ? deltaPct <= 0 : deltaPct >= 0;
  const strong = Math.abs(deltaPct) >= 8;
  const mildBad = invert ? deltaPct > 12 : deltaPct < -12;
  if (mildBad) return "bad";
  if (improved && strong) return "good";
  if (improved) return "warn";
  if (Math.abs(deltaPct) < 3) return "neutral";
  return "bad";
}

export function healthFromCostTargets(
  value: number | null | undefined,
  target: number | null | undefined,
  max: number | null | undefined
): MetricHealth {
  if (value == null || !Number.isFinite(value) || value <= 0) return "neutral";
  if (max != null && max > 0 && value > max) return "bad";
  if (target != null && target > 0 && value <= target) return "good";
  if (target != null && target > 0 && value <= target * 1.12) return "warn";
  if (target != null && target > 0) return "bad";
  return "neutral";
}

export function healthFromRoasTargets(
  roas: number | null | undefined,
  targetRoas: number | null | undefined
): MetricHealth {
  if (roas == null || !Number.isFinite(roas) || roas <= 0) return "neutral";
  if (targetRoas != null && targetRoas > 0 && roas >= targetRoas * 1.05) return "good";
  if (targetRoas != null && targetRoas > 0 && roas >= targetRoas * 0.92) return "warn";
  if (targetRoas != null && targetRoas > 0) return "bad";
  return "neutral";
}

/** Prioridade: alvo explícito > delta. */
export function mergeHealth(a: MetricHealth, b: MetricHealth): MetricHealth {
  const rank: Record<MetricHealth, number> = {
    bad: 3,
    warn: 2,
    good: 1,
    neutral: 0,
  };
  return rank[a] >= rank[b] ? a : b;
}
