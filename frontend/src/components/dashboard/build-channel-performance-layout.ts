import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import type { MetaAdsMetricsSummary, GoogleAdsMetricsSummary } from "@/lib/integrations-api";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";
import {
  healthFromCostTargets,
  healthFromDelta,
  healthFromRoasTargets,
  mergeHealth,
  trendFromDeltaPct,
  type MetricHealth,
  type MetricTrend,
} from "@/lib/metric-visual-signal";

type RelDeltaFn = (
  current: number,
  prev: number,
  compareEnabled: boolean
) => { pct: number } | undefined;

export type DashboardChannelMetric = {
  label: string;
  value: string;
  deltaPct?: number;
  deltaInvert?: boolean;
  health: MetricHealth;
  trend: MetricTrend;
};

export type ChannelPerformanceLayout = {
  performance: DashboardChannelMetric[];
  traffic: DashboardChannelMetric[];
  conversion: DashboardChannelMetric[];
};

export type ChannelTargets = {
  targetCpaBrl: number | null;
  maxCpaBrl: number | null;
  targetRoas: number | null;
};

function dPct(
  rel: RelDeltaFn,
  cur: number,
  prev: number,
  compareEnabled: boolean
): number | undefined {
  return rel(cur, prev, compareEnabled)?.pct;
}

function cmpMetaNum(cmp: MetaAdsMetricsSummary | null, pick: (s: MetaAdsMetricsSummary) => number): number {
  if (!cmp) return 0;
  const v = pick(cmp);
  return Number.isFinite(v) ? v : 0;
}

function mk(
  label: string,
  value: string,
  valueNum: number | null,
  opts: {
    deltaPct?: number;
    deltaInvert?: boolean;
    target?: number | null;
    max?: number | null;
    roas?: number | null;
    targetRoas?: number | null;
    costMetric?: boolean;
  }
): DashboardChannelMetric {
  const { deltaPct, deltaInvert, target, max, roas, targetRoas, costMetric } = opts;
  let health: MetricHealth = "neutral";
  if (costMetric && valueNum != null) {
    health = mergeHealth(health, healthFromCostTargets(valueNum, target ?? null, max ?? null));
  }
  if (roas != null && targetRoas != null) {
    health = mergeHealth(health, healthFromRoasTargets(roas, targetRoas));
  }
  health = mergeHealth(health, healthFromDelta(deltaPct, !!deltaInvert));
  return {
    label,
    value,
    deltaPct,
    deltaInvert,
    health,
    trend: trendFromDeltaPct(deltaPct),
  };
}

export type MetaLayoutCtx = {
  summary: MarketingDashboardSummary;
  derived: MarketingDashboardSummary["derived"];
  metaSpend: number;
  cmpMetaSpend: number;
  compareEnabled: boolean;
  relDelta: RelDeltaFn;
  leadLabel: string;
  cmpMeta: MetaAdsMetricsSummary | null;
  targets: ChannelTargets;
};

export function buildMetaChannelPerformanceLayout(
  mode: BusinessGoalMode,
  ctx: MetaLayoutCtx
): ChannelPerformanceLayout {
  const { summary, derived, metaSpend, cmpMetaSpend, compareEnabled, relDelta, leadLabel, cmpMeta, targets } =
    ctx;
  const cmp = cmpMeta;
  const t = targets.targetCpaBrl;
  const m = targets.maxCpaBrl;

  const spendDelta = dPct(relDelta, metaSpend, cmpMetaSpend, compareEnabled && !!cmp);

  const performance: DashboardChannelMetric[] = [
    mk("Investimento", formatSpend(metaSpend), metaSpend, {
      deltaPct: spendDelta,
      deltaInvert: false,
    }),
  ];

  if (mode === "LEADS" || mode === "HYBRID") {
    const cpl = derived?.cplLeads ?? null;
    const cplDelta =
      cmp && summary.leads > 0 && cmp.leads > 0 && compareEnabled
        ? relDelta(summary.spend / summary.leads, cmp.spend / cmp.leads, true)?.pct
        : undefined;
    performance.push(
      mk("CPL", cpl != null ? formatSpend(cpl) : "—", cpl, {
        deltaPct: cplDelta,
        deltaInvert: true,
        target: t,
        max: m,
        costMetric: true,
      })
    );
  }

  if (mode === "SALES") {
    const cpa = derived?.costPerPurchase ?? null;
    performance.push(
      mk("Custo / compra", cpa != null ? formatSpend(cpa) : "—", cpa, {
        target: t,
        max: m,
        costMetric: true,
      })
    );
  }

  const cpc = derived?.cpc ?? null;
  const cpcDelta =
    cmp && summary.clicks > 0 && cmp.clicks > 0 && compareEnabled
      ? relDelta(summary.spend / summary.clicks, cmp.spend / cmp.clicks, true)?.pct
      : undefined;
  performance.push(
    mk("CPC", cpc != null ? formatSpend(cpc) : "—", cpc, {
      deltaPct: cpcDelta,
      deltaInvert: true,
      costMetric: !!cpc,
    })
  );

  const roas = derived?.roas ?? null;
  if ((mode === "HYBRID" || mode === "SALES") && roas != null) {
    performance.push({
      label: "ROAS",
      value: Number.isFinite(roas) ? `${roas.toFixed(2).replace(".", ",")}×` : "—",
      health: mergeHealth("neutral", healthFromRoasTargets(roas, targets.targetRoas)),
      trend: null,
    });
  }

  const ctrDelta =
    cmp && summary.impressions > 0 && cmp.impressions > 0 && compareEnabled
      ? relDelta(
          (summary.clicks / summary.impressions) * 100,
          (cmp.clicks / cmp.impressions) * 100,
          false
        )?.pct
      : undefined;

  const traffic: DashboardChannelMetric[] = [
    mk("Impressões", formatNumber(summary.impressions), summary.impressions, {
      deltaPct: dPct(relDelta, summary.impressions, cmpMetaNum(cmp, (c) => c.impressions), compareEnabled && !!cmp),
      deltaInvert: false,
    }),
    mk("Cliques", formatNumber(summary.clicks), summary.clicks, {
      deltaPct: dPct(relDelta, summary.clicks, cmpMetaNum(cmp, (c) => c.clicks), compareEnabled && !!cmp),
      deltaInvert: false,
    }),
    mk("CTR", derived?.ctrPct != null ? formatPercent(derived.ctrPct) : "—", derived?.ctrPct ?? null, {
      deltaPct: ctrDelta,
      deltaInvert: false,
    }),
  ];

  const conversion: DashboardChannelMetric[] = [];

  if ((mode === "LEADS" || mode === "HYBRID") && summary.landingPageViews > 0) {
    conversion.push(
      mk("LPV", formatNumber(summary.landingPageViews), summary.landingPageViews, {
        deltaPct: dPct(
          relDelta,
          summary.landingPageViews,
          cmpMetaNum(cmp, (c) => c.landingPageViews ?? 0),
          compareEnabled && !!cmp
        ),
        deltaInvert: false,
      })
    );
  }

  if (mode === "LEADS" || mode === "HYBRID") {
    const leadsDelta = dPct(relDelta, summary.leads, cmpMetaNum(cmp, (c) => c.leads), compareEnabled && !!cmp);
    conversion.push(
      mk(leadLabel, formatNumber(summary.leads), summary.leads, {
        deltaPct: leadsDelta,
        deltaInvert: false,
      })
    );
    const cr = summary.clicks > 0 ? (summary.leads / summary.clicks) * 100 : null;
    conversion.push(
      mk("Conv. clique → lead", cr != null ? formatPercent(cr) : "—", cr, {
        deltaInvert: false,
      })
    );
  }

  if (mode === "SALES") {
    const pDelta = dPct(
      relDelta,
      summary.purchases,
      cmpMetaNum(cmp, (c) => c.purchases),
      compareEnabled && !!cmp
    );
    conversion.push(
      mk("Compras", formatNumber(summary.purchases), summary.purchases, {
        deltaPct: pDelta,
        deltaInvert: false,
      })
    );
    const cr = summary.clicks > 0 ? (summary.purchases / summary.clicks) * 100 : null;
    conversion.push(
      mk("Conv. clique → compra", cr != null ? formatPercent(cr) : "—", cr, {
        deltaInvert: false,
      })
    );
  } else if (mode === "HYBRID") {
    const pDelta = dPct(
      relDelta,
      summary.purchases,
      cmpMetaNum(cmp, (c) => c.purchases),
      compareEnabled && !!cmp
    );
    conversion.push(
      mk("Compras", formatNumber(summary.purchases), summary.purchases, {
        deltaPct: pDelta,
        deltaInvert: false,
      })
    );
  }

  return { performance, traffic, conversion };
}

export type GoogleLayoutCtx = {
  googleDerived: { spend: number; ctrPct: number | null; cpc: number | null; costPerConv: number | null };
  metrics: GoogleAdsMetricsSummary;
  cmpGoogleSummary: GoogleAdsMetricsSummary | null;
  compareEnabled: boolean;
  relDelta: RelDeltaFn;
  leadLabel?: string;
  targets: ChannelTargets;
};

export function buildGoogleChannelPerformanceLayout(
  mode: BusinessGoalMode,
  ctx: GoogleLayoutCtx
): ChannelPerformanceLayout {
  const { googleDerived, metrics, cmpGoogleSummary, compareEnabled, relDelta, leadLabel, targets } = ctx;
  const cmp = cmpGoogleSummary;
  const leadWord = leadLabel?.trim() || "Leads";
  const spend = googleDerived.spend;
  const t = targets.targetCpaBrl;
  const m = targets.maxCpaBrl;
  const googleRoas =
    spend > 0 && metrics.conversionsValue > 0 ? metrics.conversionsValue / spend : null;
  const cmpSpend = (cmp?.costMicros ?? 0) / 1_000_000;

  const spendDelta = dPct(relDelta, spend, cmpSpend, compareEnabled && !!cmp);

  const cpa = googleDerived.costPerConv;
  const cpaDelta =
    cmp && metrics.conversions > 0 && cmp.conversions > 0 && compareEnabled
      ? relDelta(spend / metrics.conversions, cmpSpend / cmp.conversions, true)?.pct
      : undefined;

  const cpcDelta =
    cmp && metrics.clicks > 0 && cmp.clicks > 0 && compareEnabled
      ? relDelta(
          googleDerived.cpc ?? spend / Math.max(1, metrics.clicks),
          cmpSpend / cmp.clicks,
          true
        )?.pct
      : undefined;

  const performance: DashboardChannelMetric[] = [
    mk("Investimento", formatSpend(spend), spend, {
      deltaPct: spendDelta,
      deltaInvert: false,
    }),
    mk("Custo / conv.", cpa != null ? formatSpend(cpa) : "—", cpa, {
      deltaPct: cpaDelta,
      deltaInvert: true,
      target: t,
      max: m,
      costMetric: true,
    }),
    mk("CPC", googleDerived.cpc != null ? formatSpend(googleDerived.cpc) : "—", googleDerived.cpc, {
      deltaPct: cpcDelta,
      deltaInvert: true,
      costMetric: googleDerived.cpc != null,
    }),
  ];

  if (mode === "HYBRID" || mode === "SALES") {
    performance.push({
      label: "ROAS",
      value:
        googleRoas != null && Number.isFinite(googleRoas)
          ? `${googleRoas.toFixed(2).replace(".", ",")}×`
          : "—",
      health: mergeHealth("neutral", healthFromRoasTargets(googleRoas, targets.targetRoas)),
      trend: null,
    });
  }

  const ctrDelta =
    cmp && metrics.impressions > 0 && cmp.impressions > 0 && compareEnabled
      ? relDelta(
          (metrics.clicks / metrics.impressions) * 100,
          (cmp.clicks / cmp.impressions) * 100,
          false
        )?.pct
      : undefined;

  const traffic: DashboardChannelMetric[] = [
    mk("Impressões", formatNumber(metrics.impressions), metrics.impressions, {
      deltaPct: dPct(relDelta, metrics.impressions, cmp?.impressions ?? 0, compareEnabled && !!cmp),
      deltaInvert: false,
    }),
    mk("Cliques", formatNumber(metrics.clicks), metrics.clicks, {
      deltaPct: dPct(relDelta, metrics.clicks, cmp?.clicks ?? 0, compareEnabled && !!cmp),
      deltaInvert: false,
    }),
    mk("CTR", googleDerived.ctrPct != null ? formatPercent(googleDerived.ctrPct) : "—", googleDerived.ctrPct, {
      deltaPct: ctrDelta,
      deltaInvert: false,
    }),
  ];

  const convDelta = dPct(relDelta, metrics.conversions, cmp?.conversions ?? 0, compareEnabled && !!cmp);
  const conversion: DashboardChannelMetric[] = [
    mk(mode === "LEADS" ? leadWord : "Conversões", formatNumber(metrics.conversions), metrics.conversions, {
      deltaPct: convDelta,
      deltaInvert: false,
    }),
  ];

  const cr = metrics.clicks > 0 ? (metrics.conversions / metrics.clicks) * 100 : null;
  conversion.push(
    mk("Conv. clique → resultado", cr != null ? formatPercent(cr) : "—", cr, {
      deltaInvert: false,
    })
  );

  return { performance, traffic, conversion };
}
