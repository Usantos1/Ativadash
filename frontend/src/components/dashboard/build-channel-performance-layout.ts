import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import type { MetaAdsMetricsSummary, GoogleAdsMetricsSummary } from "@/lib/integrations-api";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";

type RelDeltaFn = (
  current: number,
  prev: number,
  compareEnabled: boolean
) => { pct: number } | undefined;

export type PerfStat = {
  label: string;
  value: string;
  deltaPct?: number;
  deltaInvert?: boolean;
};

/** KPI principal grande + investimento + eficiência + tráfego */
export type ChannelPerformanceLayout = {
  primaryHero: PerfStat;
  rowSpend: PerfStat;
  rowEfficiency: PerfStat[];
  rowTraffic: [PerfStat, PerfStat, PerfStat];
};

function cmpMetaNum(cmp: MetaAdsMetricsSummary | null, pick: (s: MetaAdsMetricsSummary) => number): number {
  if (!cmp) return 0;
  const v = pick(cmp);
  return Number.isFinite(v) ? v : 0;
}

function dPct(
  rel: RelDeltaFn,
  cur: number,
  prev: number,
  compareEnabled: boolean
): number | undefined {
  return rel(cur, prev, compareEnabled)?.pct;
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
};

export function buildMetaChannelPerformanceLayout(
  mode: BusinessGoalMode,
  ctx: MetaLayoutCtx
): ChannelPerformanceLayout {
  const { summary, derived, metaSpend, cmpMetaSpend, compareEnabled, relDelta, leadLabel, cmpMeta } = ctx;

  const rowSpend: PerfStat = {
    label: "Investimento",
    value: formatSpend(metaSpend),
    deltaPct: dPct(relDelta, metaSpend, cmpMetaSpend, compareEnabled),
  };

  let primaryHero: PerfStat;
  if (mode === "SALES") {
    primaryHero = {
      label: "Compras",
      value: formatNumber(summary.purchases),
      deltaPct: dPct(
        relDelta,
        summary.purchases,
        cmpMetaNum(cmpMeta, (c) => c.purchases),
        compareEnabled && !!cmpMeta
      ),
    };
  } else if (mode === "HYBRID") {
    primaryHero = {
      label: `${leadLabel} · compras`,
      value: `${formatNumber(summary.leads)} / ${formatNumber(summary.purchases)}`,
      deltaPct: dPct(relDelta, summary.leads, cmpMetaNum(cmpMeta, (c) => c.leads), compareEnabled && !!cmpMeta),
    };
  } else {
    primaryHero = {
      label: leadLabel,
      value: formatNumber(summary.leads),
      deltaPct: dPct(
        relDelta,
        summary.leads,
        cmpMetaNum(cmpMeta, (c) => c.leads),
        compareEnabled && !!cmpMeta
      ),
    };
  }

  const rowTraffic: [PerfStat, PerfStat, PerfStat] = [
    {
      label: "Impressões",
      value: formatNumber(summary.impressions),
      deltaPct: dPct(
        relDelta,
        summary.impressions,
        cmpMetaNum(cmpMeta, (c) => c.impressions),
        compareEnabled && !!cmpMeta
      ),
    },
    {
      label: "Cliques",
      value: formatNumber(summary.clicks),
      deltaPct: dPct(relDelta, summary.clicks, cmpMetaNum(cmpMeta, (c) => c.clicks), compareEnabled && !!cmpMeta),
    },
    {
      label: "CPC",
      value: derived?.cpc != null ? formatSpend(derived.cpc) : "—",
      deltaInvert: true,
    },
  ];

  let rowEfficiency: PerfStat[];

  if (mode === "LEADS") {
    rowEfficiency = [
      {
        label: "CPL",
        value: derived?.cplLeads != null ? formatSpend(derived.cplLeads) : "—",
        deltaInvert: true,
      },
      {
        label: "CTR",
        value: derived?.ctrPct != null ? formatPercent(derived.ctrPct) : "—",
      },
    ];
  } else if (mode === "SALES") {
    rowEfficiency = [
      {
        label: "Custo / compra",
        value: derived?.costPerPurchase != null ? formatSpend(derived.costPerPurchase) : "—",
        deltaInvert: true,
      },
      {
        label: "CTR",
        value: derived?.ctrPct != null ? formatPercent(derived.ctrPct) : "—",
      },
    ];
  } else {
    rowEfficiency = [
      {
        label: "CPL",
        value: derived?.cplLeads != null ? formatSpend(derived.cplLeads) : "—",
        deltaInvert: true,
      },
      {
        label: "ROAS",
        value:
          derived?.roas != null && Number.isFinite(derived.roas)
            ? `${derived.roas.toFixed(2).replace(".", ",")}×`
            : "—",
      },
      {
        label: "CTR",
        value: derived?.ctrPct != null ? formatPercent(derived.ctrPct) : "—",
      },
    ];
  }

  return { primaryHero, rowSpend, rowEfficiency, rowTraffic };
}

export type GoogleLayoutCtx = {
  googleDerived: { spend: number; ctrPct: number | null; cpc: number | null; costPerConv: number | null };
  metrics: GoogleAdsMetricsSummary;
  cmpGoogleSummary: GoogleAdsMetricsSummary | null;
  compareEnabled: boolean;
  relDelta: RelDeltaFn;
};

export function buildGoogleChannelPerformanceLayout(
  mode: BusinessGoalMode,
  ctx: GoogleLayoutCtx
): ChannelPerformanceLayout {
  const { googleDerived, metrics, cmpGoogleSummary, compareEnabled, relDelta } = ctx;
  const cmp = cmpGoogleSummary;

  const spend = googleDerived.spend;
  const rowSpend: PerfStat = {
    label: "Investimento",
    value: formatSpend(spend),
    deltaPct: dPct(relDelta, spend, (cmp?.costMicros ?? 0) / 1_000_000, compareEnabled && !!cmp),
  };

  const primaryHero: PerfStat = {
    label: "Conversões",
    value: formatNumber(metrics.conversions),
    deltaPct: dPct(relDelta, metrics.conversions, cmp?.conversions ?? 0, compareEnabled && !!cmp),
  };

  const googleRoas =
    spend > 0 && metrics.conversionsValue > 0 ? metrics.conversionsValue / spend : null;

  const rowTraffic: [PerfStat, PerfStat, PerfStat] = [
    {
      label: "Impressões",
      value: formatNumber(metrics.impressions),
      deltaPct: dPct(relDelta, metrics.impressions, cmp?.impressions ?? 0, compareEnabled && !!cmp),
    },
    {
      label: "Cliques",
      value: formatNumber(metrics.clicks),
      deltaPct: dPct(relDelta, metrics.clicks, cmp?.clicks ?? 0, compareEnabled && !!cmp),
    },
    {
      label: "CPC",
      value: googleDerived.cpc != null ? formatSpend(googleDerived.cpc) : "—",
      deltaInvert: true,
    },
  ];

  let rowEfficiency: PerfStat[];

  if (mode === "LEADS") {
    rowEfficiency = [
      {
        label: "Custo / conv.",
        value: googleDerived.costPerConv != null ? formatSpend(googleDerived.costPerConv) : "—",
        deltaInvert: true,
      },
      {
        label: "CTR",
        value: googleDerived.ctrPct != null ? formatPercent(googleDerived.ctrPct) : "—",
      },
    ];
  } else if (mode === "SALES") {
    rowEfficiency = [
      {
        label: "Custo / conv.",
        value: googleDerived.costPerConv != null ? formatSpend(googleDerived.costPerConv) : "—",
        deltaInvert: true,
      },
      {
        label: "CTR",
        value: googleDerived.ctrPct != null ? formatPercent(googleDerived.ctrPct) : "—",
      },
    ];
  } else {
    rowEfficiency = [
      {
        label: "Custo / conv.",
        value: googleDerived.costPerConv != null ? formatSpend(googleDerived.costPerConv) : "—",
        deltaInvert: true,
      },
      {
        label: "ROAS",
        value:
          googleRoas != null && Number.isFinite(googleRoas)
            ? `${googleRoas.toFixed(2).replace(".", ",")}×`
            : "—",
      },
      {
        label: "CTR",
        value: googleDerived.ctrPct != null ? formatPercent(googleDerived.ctrPct) : "—",
      },
    ];
  }

  return { primaryHero, rowSpend, rowEfficiency, rowTraffic };
}
