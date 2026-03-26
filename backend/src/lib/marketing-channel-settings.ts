import type { MarketingSettings } from "@prisma/client";

export type ChannelKey = "meta" | "google";

export type ChannelGoalsPartial = {
  targetCpaBrl?: number | null;
  maxCpaBrl?: number | null;
  targetRoas?: number | null;
  minSpendForAlertsBrl?: number | null;
  minResultsForCpa?: number | null;
};

export type ResolvedChannelGoals = {
  targetCpaBrl: number | null;
  maxCpaBrl: number | null;
  targetRoas: number | null;
  minSpendForAlertsBrl: number | null;
  minResultsForCpa: number;
};

export type ChannelAutomationsState = {
  pauseIfCplAboveMax: boolean;
  pauseIfCplAboveMaxMinResults: number | null;
  reduceBudgetIfCplAboveTarget: boolean;
  reduceBudgetPercent: number | null;
  increaseBudgetIfCplBelowTarget: boolean;
  increaseBudgetPercent: number | null;
  flagScaleIfCplGood: boolean;
  flagReviewSpendUpConvDown: boolean;
};

export type ChannelWhatsappAlertsState = {
  cplAboveMax: boolean;
  cplAboveTarget: boolean;
  roasBelowMin: boolean;
  minSpendNoResults: boolean;
  scaleOpportunity: boolean;
  sharpPerformanceDrop: boolean;
  clearAdjustmentOpportunity: boolean;
  useIntegrationPhone: boolean;
  overridePhone: string | null;
  muteStartHourUtc: number | null;
  muteEndHourUtc: number | null;
};

function decToNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function decToInt(v: unknown, fallback: number): number {
  if (v == null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

export function parseGoalsByChannel(json: unknown): Partial<Record<ChannelKey, ChannelGoalsPartial>> {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return {};
  const o = json as Record<string, unknown>;
  const out: Partial<Record<ChannelKey, ChannelGoalsPartial>> = {};
  for (const k of ["meta", "google"] as const) {
    const raw = o[k];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const g = raw as Record<string, unknown>;
      out[k] = {
        targetCpaBrl: g.targetCpaBrl === undefined ? undefined : decToNumber(g.targetCpaBrl),
        maxCpaBrl: g.maxCpaBrl === undefined ? undefined : decToNumber(g.maxCpaBrl),
        targetRoas: g.targetRoas === undefined ? undefined : decToNumber(g.targetRoas),
        minSpendForAlertsBrl:
          g.minSpendForAlertsBrl === undefined ? undefined : decToNumber(g.minSpendForAlertsBrl),
        minResultsForCpa:
          g.minResultsForCpa === undefined ? undefined : decToInt(g.minResultsForCpa, 1),
      };
    }
  }
  return out;
}

export function mergeGoalsByChannel(
  current: unknown,
  patch: Partial<Record<ChannelKey, ChannelGoalsPartial | null | undefined>>
): Record<string, unknown> {
  const base = parseGoalsByChannel(current);
  const next: Record<string, unknown> = {};
  for (const ck of ["meta", "google"] as const) {
    const prev = base[ck];
    if (!(ck in patch)) {
      if (prev && Object.keys(prev).length) next[ck] = prev;
      continue;
    }
    const p = patch[ck];
    if (p === undefined) {
      if (prev && Object.keys(prev).length) next[ck] = prev;
      continue;
    }
    if (p === null) continue;
    next[ck] = { ...(prev ?? {}), ...p };
  }
  return next;
}

export function resolveLegacyGoals(row: MarketingSettings): ResolvedChannelGoals {
  return {
    targetCpaBrl: decToNumber(row.targetCpaBrl),
    maxCpaBrl: decToNumber(row.maxCpaBrl),
    targetRoas: decToNumber(row.targetRoas),
    minSpendForAlertsBrl: decToNumber(row.minSpendForAlertsBrl),
    minResultsForCpa: row.minResultsForCpa,
  };
}

export function resolveChannelGoals(row: MarketingSettings, channel: ChannelKey): ResolvedChannelGoals {
  const o = parseGoalsByChannel(row.goalsByChannel)[channel] ?? {};
  const leg = resolveLegacyGoals(row);
  return {
    targetCpaBrl: o.targetCpaBrl !== undefined ? o.targetCpaBrl : leg.targetCpaBrl,
    maxCpaBrl: o.maxCpaBrl !== undefined ? o.maxCpaBrl : leg.maxCpaBrl,
    targetRoas: o.targetRoas !== undefined ? o.targetRoas : leg.targetRoas,
    minSpendForAlertsBrl:
      o.minSpendForAlertsBrl !== undefined ? o.minSpendForAlertsBrl : leg.minSpendForAlertsBrl,
    minResultsForCpa:
      o.minResultsForCpa !== undefined && o.minResultsForCpa != null
        ? Math.min(500, Math.max(1, o.minResultsForCpa))
        : leg.minResultsForCpa,
  };
}

const defaultAutomations = (): ChannelAutomationsState => ({
  pauseIfCplAboveMax: false,
  pauseIfCplAboveMaxMinResults: null,
  reduceBudgetIfCplAboveTarget: false,
  reduceBudgetPercent: null,
  increaseBudgetIfCplBelowTarget: false,
  increaseBudgetPercent: null,
  flagScaleIfCplGood: false,
  flagReviewSpendUpConvDown: false,
});

export function parseAutomationsByChannel(json: unknown): Partial<Record<ChannelKey, ChannelAutomationsState>> {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return {};
  const o = json as Record<string, unknown>;
  const out: Partial<Record<ChannelKey, ChannelAutomationsState>> = {};
  for (const k of ["meta", "google"] as const) {
    const raw = o[k];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const a = raw as Record<string, unknown>;
      const d = defaultAutomations();
      out[k] = {
        pauseIfCplAboveMax: Boolean(a.pauseIfCplAboveMax),
        pauseIfCplAboveMaxMinResults:
          a.pauseIfCplAboveMaxMinResults === undefined || a.pauseIfCplAboveMaxMinResults === null
            ? null
            : Math.max(1, decToInt(a.pauseIfCplAboveMaxMinResults, 1)),
        reduceBudgetIfCplAboveTarget: Boolean(a.reduceBudgetIfCplAboveTarget),
        reduceBudgetPercent:
          a.reduceBudgetPercent === undefined || a.reduceBudgetPercent === null
            ? null
            : decToNumber(a.reduceBudgetPercent),
        increaseBudgetIfCplBelowTarget: Boolean(a.increaseBudgetIfCplBelowTarget),
        increaseBudgetPercent:
          a.increaseBudgetPercent === undefined || a.increaseBudgetPercent === null
            ? null
            : decToNumber(a.increaseBudgetPercent),
        flagScaleIfCplGood: Boolean(a.flagScaleIfCplGood),
        flagReviewSpendUpConvDown: Boolean(a.flagReviewSpendUpConvDown),
      };
    }
  }
  return out;
}

export function mergeAutomationsByChannel(
  current: unknown,
  patch: Partial<Record<ChannelKey, Partial<ChannelAutomationsState> | null | undefined>>
): Record<string, unknown> {
  const base = parseAutomationsByChannel(current);
  const next: Record<string, unknown> = {};
  for (const ck of ["meta", "google"] as const) {
    const merged = { ...defaultAutomations(), ...(base[ck] ?? {}) };
    if (!(ck in patch)) {
      if (base[ck]) next[ck] = merged;
      continue;
    }
    const p = patch[ck];
    if (p === undefined) {
      if (base[ck]) next[ck] = merged;
      continue;
    }
    if (p === null) continue;
    next[ck] = { ...merged, ...p };
  }
  return next;
}

export function resolveAutomations(row: MarketingSettings, channel: ChannelKey): ChannelAutomationsState {
  return { ...defaultAutomations(), ...(parseAutomationsByChannel(row.automationsByChannel)[channel] ?? {}) };
}

const defaultWhatsappAlerts = (row: MarketingSettings): ChannelWhatsappAlertsState => ({
  cplAboveMax: row.alertCpaAboveMax,
  cplAboveTarget: row.alertCpaAboveTarget,
  roasBelowMin: row.alertRoasBelowTarget,
  minSpendNoResults: true,
  scaleOpportunity: false,
  sharpPerformanceDrop: false,
  clearAdjustmentOpportunity: false,
  useIntegrationPhone: true,
  overridePhone: null,
  muteStartHourUtc: null,
  muteEndHourUtc: null,
});

export function parseWhatsappAlertsByChannel(
  json: unknown
): Partial<Record<ChannelKey, Partial<ChannelWhatsappAlertsState>>> {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return {};
  const o = json as Record<string, unknown>;
  const out: Partial<Record<ChannelKey, Partial<ChannelWhatsappAlertsState>>> = {};
  for (const k of ["meta", "google"] as const) {
    const raw = o[k];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const w = raw as Record<string, unknown>;
      out[k] = {
        cplAboveMax: w.cplAboveMax === undefined ? undefined : Boolean(w.cplAboveMax),
        cplAboveTarget: w.cplAboveTarget === undefined ? undefined : Boolean(w.cplAboveTarget),
        roasBelowMin: w.roasBelowMin === undefined ? undefined : Boolean(w.roasBelowMin),
        minSpendNoResults: w.minSpendNoResults === undefined ? undefined : Boolean(w.minSpendNoResults),
        scaleOpportunity: w.scaleOpportunity === undefined ? undefined : Boolean(w.scaleOpportunity),
        sharpPerformanceDrop:
          w.sharpPerformanceDrop === undefined ? undefined : Boolean(w.sharpPerformanceDrop),
        clearAdjustmentOpportunity:
          w.clearAdjustmentOpportunity === undefined ? undefined : Boolean(w.clearAdjustmentOpportunity),
        useIntegrationPhone:
          w.useIntegrationPhone === undefined ? undefined : Boolean(w.useIntegrationPhone),
        overridePhone:
          w.overridePhone === undefined
            ? undefined
            : w.overridePhone === null
              ? null
              : String(w.overridePhone).trim() || null,
        muteStartHourUtc:
          w.muteStartHourUtc === undefined || w.muteStartHourUtc === null
            ? undefined
            : decToInt(w.muteStartHourUtc, 0),
        muteEndHourUtc:
          w.muteEndHourUtc === undefined || w.muteEndHourUtc === null
            ? undefined
            : decToInt(w.muteEndHourUtc, 0),
      };
    }
  }
  return out;
}

export function mergeWhatsappAlertsByChannel(
  current: unknown,
  patch: Partial<Record<ChannelKey, Partial<ChannelWhatsappAlertsState> | null | undefined>>
): Record<string, unknown> {
  const baseParsed = parseWhatsappAlertsByChannel(current);
  const next: Record<string, unknown> = {};
  for (const ck of ["meta", "google"] as const) {
    const b = baseParsed[ck];
    if (!(ck in patch)) {
      if (b && Object.keys(b).length) next[ck] = b;
      continue;
    }
    const p = patch[ck];
    if (p === undefined) {
      if (b && Object.keys(b).length) next[ck] = b;
      continue;
    }
    if (p === null) continue;
    next[ck] = { ...(b ?? {}), ...p };
  }
  return next;
}

export function resolveWhatsappAlerts(
  row: MarketingSettings,
  channel: ChannelKey
): ChannelWhatsappAlertsState {
  const def = defaultWhatsappAlerts(row);
  const o = parseWhatsappAlertsByChannel(row.whatsappAlertsByChannel)[channel] ?? {};
  return {
    cplAboveMax: o.cplAboveMax ?? def.cplAboveMax,
    cplAboveTarget: o.cplAboveTarget ?? def.cplAboveTarget,
    roasBelowMin: o.roasBelowMin ?? def.roasBelowMin,
    minSpendNoResults: o.minSpendNoResults ?? def.minSpendNoResults,
    scaleOpportunity: o.scaleOpportunity ?? def.scaleOpportunity,
    sharpPerformanceDrop: o.sharpPerformanceDrop ?? def.sharpPerformanceDrop,
    clearAdjustmentOpportunity: o.clearAdjustmentOpportunity ?? def.clearAdjustmentOpportunity,
    useIntegrationPhone: o.useIntegrationPhone ?? def.useIntegrationPhone,
    overridePhone: o.overridePhone !== undefined ? o.overridePhone : def.overridePhone,
    muteStartHourUtc: o.muteStartHourUtc !== undefined ? o.muteStartHourUtc : def.muteStartHourUtc,
    muteEndHourUtc: o.muteEndHourUtc !== undefined ? o.muteEndHourUtc : def.muteEndHourUtc,
  };
}

export function automationSummaryActiveCount(auto: ChannelAutomationsState): number {
  let n = 0;
  if (auto.pauseIfCplAboveMax) n++;
  if (auto.reduceBudgetIfCplAboveTarget) n++;
  if (auto.increaseBudgetIfCplBelowTarget) n++;
  if (auto.flagScaleIfCplGood) n++;
  if (auto.flagReviewSpendUpConvDown) n++;
  return n;
}

export function whatsappAlertsActiveCount(w: ChannelWhatsappAlertsState): number {
  let n = 0;
  if (w.cplAboveMax) n++;
  if (w.cplAboveTarget) n++;
  if (w.roasBelowMin) n++;
  if (w.minSpendNoResults) n++;
  if (w.scaleOpportunity) n++;
  if (w.sharpPerformanceDrop) n++;
  if (w.clearAdjustmentOpportunity) n++;
  return n;
}
