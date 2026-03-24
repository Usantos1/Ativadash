import { formatNumber, formatPercent, formatSpend } from "@/lib/metrics-format";
import type { MarketingDashboardSummary } from "@/lib/marketing-dashboard-api";
import type {
  GoogleAdsMetricsResponse,
  MetaAdsMetricsSummary,
  GoogleAdsMetricsSummary,
} from "@/lib/integrations-api";
import type { BusinessGoalMode } from "@/lib/business-goal-mode";
import type { DashboardChannelMetric } from "@/components/dashboard/build-channel-performance-layout";
import type { ChannelTargets } from "@/components/dashboard/build-channel-performance-layout";
import {
  healthFromCostTargets,
  healthFromDelta,
  healthFromRoasTargets,
  mergeHealth,
  trendFromDeltaPct,
} from "@/lib/metric-visual-signal";

type RelDeltaFn = (
  current: number,
  prev: number,
  compareEnabled: boolean
) => { pct: number } | undefined;

function d(rel: RelDeltaFn, cur: number, prev: number, cmp: boolean): number | undefined {
  return rel(cur, prev, cmp)?.pct;
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
  let health = healthFromDelta(deltaPct, !!deltaInvert);
  if (costMetric && valueNum != null) {
    health = mergeHealth(health, healthFromCostTargets(valueNum, target ?? null, max ?? null));
  }
  if (roas != null && targetRoas != null) {
    health = mergeHealth(health, healthFromRoasTargets(roas, targetRoas));
  }
  return {
    label,
    value,
    deltaPct,
    deltaInvert,
    health,
    trend: trendFromDeltaPct(deltaPct),
  };
}

export function buildConsolidatedAccountKpis(
  mode: BusinessGoalMode,
  meta: MarketingDashboardSummary | null,
  google: GoogleAdsMetricsResponse | null,
  cmpMeta: MetaAdsMetricsSummary | null,
  cmpGoogle: GoogleAdsMetricsSummary | null,
  compareEnabled: boolean,
  relDelta: RelDeltaFn,
  leadLabel: string,
  targets: ChannelTargets
): DashboardChannelMetric[] {
  const gOk = google?.ok === true;
  const gSpend = gOk ? google.summary.costMicros / 1_000_000 : 0;
  const gImp = gOk ? google.summary.impressions : 0;
  const gClk = gOk ? google.summary.clicks : 0;
  const gConv = gOk ? google.summary.conversions : 0;
  const gVal = gOk ? google.summary.conversionsValue : 0;

  const mSpend = meta?.spend ?? 0;
  const mImp = meta?.impressions ?? 0;
  const mClk = meta?.clicks ?? 0;
  const mLeads = meta?.leads ?? 0;
  const mPurch = meta?.purchases ?? 0;
  const mMsg = meta?.messagingConversations ?? 0;
  const mVal = meta?.purchaseValue ?? 0;

  const spend = mSpend + gSpend;
  const impr = mImp + gImp;
  const clk = mClk + gClk;

  const cmpGSpend = (cmpGoogle?.costMicros ?? 0) / 1_000_000;
  const cmpGImp = cmpGoogle?.impressions ?? 0;
  const cmpGClk = cmpGoogle?.clicks ?? 0;
  const cmpGConv = cmpGoogle?.conversions ?? 0;

  const cmpMSpend = cmpMeta?.spend ?? 0;
  const cmpMImp = cmpMeta?.impressions ?? 0;
  const cmpMClk = cmpMeta?.clicks ?? 0;
  const cmpMLeads = cmpMeta?.leads ?? 0;
  const cmpMPurch = cmpMeta?.purchases ?? 0;
  const cmpMMsg = cmpMeta?.messagingConversationsStarted ?? 0;

  const prevSpend = cmpMSpend + cmpGSpend;
  const prevImpr = cmpMImp + cmpGImp;
  const prevClk = cmpMClk + cmpGClk;
  const cmpOn = compareEnabled && (!!cmpMeta || !!cmpGoogle);

  const ctr = impr > 0 ? (clk / impr) * 100 : null;
  const prevCtr = prevImpr > 0 ? (prevClk / prevImpr) * 100 : null;
  const ctrDelta =
    cmpOn && prevCtr != null && ctr != null ? relDelta(ctr, prevCtr, true)?.pct : undefined;

  const cpc = clk > 0 ? spend / clk : null;
  const prevCpc = prevClk > 0 ? prevSpend / prevClk : null;
  const cpcDelta =
    cmpOn && cpc != null && prevCpc != null && prevCpc > 0
      ? relDelta(cpc, prevCpc, true)?.pct
      : undefined;

  const t = targets.targetCpaBrl;
  const maxC = targets.maxCpaBrl;
  const tRoas = targets.targetRoas;

  if (mode === "LEADS") {
    const leads = mLeads + gConv;
    const prevLeads = cmpMLeads + cmpGConv;
    const cpl = leads > 0 ? spend / leads : null;
    const prevCpl = prevLeads > 0 ? prevSpend / prevLeads : null;
    const cplDelta =
      cmpOn && cpl != null && prevCpl != null && prevCpl > 0
        ? relDelta(cpl, prevCpl, true)?.pct
        : undefined;

    return [
      mk(leadLabel, formatNumber(leads), leads, {
        deltaPct: d(relDelta, leads, prevLeads, cmpOn),
        deltaInvert: false,
      }),
      mk("Investimento", formatSpend(spend), spend, {
        deltaPct: d(relDelta, spend, prevSpend, cmpOn),
        deltaInvert: false,
      }),
      mk("CPL", cpl != null ? formatSpend(cpl) : "—", cpl, {
        deltaPct: cplDelta,
        deltaInvert: true,
        target: t,
        max: maxC,
        costMetric: true,
      }),
      mk("CTR", ctr != null ? formatPercent(ctr) : "—", ctr, {
        deltaPct: ctrDelta,
        deltaInvert: false,
      }),
      mk("Cliques", formatNumber(clk), clk, {
        deltaPct: d(relDelta, clk, prevClk, cmpOn),
        deltaInvert: false,
      }),
      mk("CPC", cpc != null ? formatSpend(cpc) : "—", cpc, {
        deltaPct: cpcDelta,
        deltaInvert: true,
        costMetric: !!cpc,
      }),
    ];
  }

  if (mode === "SALES") {
    const purch = mPurch + gConv;
    const prevPurch = cmpMPurch + cmpGConv;
    const val = mVal + gVal;
    const prevVal =
      (cmpMeta?.purchaseValue ?? 0) +
      (cmpGoogle?.conversionsValue ?? 0);
    const roas = spend > 0 && val > 0 ? val / spend : null;
    const prevRoas = prevSpend > 0 && prevVal > 0 ? prevVal / prevSpend : null;
    const roasDelta =
      cmpOn && roas != null && prevRoas != null && prevRoas > 0
        ? relDelta(roas, prevRoas, false)?.pct
        : undefined;
    const cpa = purch > 0 ? spend / purch : null;
    const prevCpa = prevPurch > 0 ? prevSpend / prevPurch : null;
    const cpaDelta =
      cmpOn && cpa != null && prevCpa != null && prevCpa > 0
        ? relDelta(cpa, prevCpa, true)?.pct
        : undefined;

    const roasMetric: DashboardChannelMetric = {
      label: "ROAS",
      value: roas != null && Number.isFinite(roas) ? `${roas.toFixed(2).replace(".", ",")}×` : "—",
      deltaPct: roasDelta,
      deltaInvert: false,
      health: mergeHealth(
        healthFromDelta(roasDelta, false),
        healthFromRoasTargets(roas, tRoas)
      ),
      trend: trendFromDeltaPct(roasDelta),
    };

    return [
      mk("Compras", formatNumber(purch), purch, {
        deltaPct: d(relDelta, purch, prevPurch, cmpOn),
        deltaInvert: false,
      }),
      mk("Investimento", formatSpend(spend), spend, {
        deltaPct: d(relDelta, spend, prevSpend, cmpOn),
        deltaInvert: false,
      }),
      roasMetric,
      mk("Custo / compra", cpa != null ? formatSpend(cpa) : "—", cpa, {
        deltaPct: cpaDelta,
        deltaInvert: true,
        target: t,
        max: maxC,
        costMetric: true,
      }),
      mk("Cliques", formatNumber(clk), clk, {
        deltaPct: d(relDelta, clk, prevClk, cmpOn),
        deltaInvert: false,
      }),
      mk("CTR", ctr != null ? formatPercent(ctr) : "—", ctr, {
        deltaPct: ctrDelta,
        deltaInvert: false,
      }),
    ];
  }

  /* HYBRID — leads incluem Google conv.; compras Meta (evita duplicar conv. Google em lead + compra). */
  const leadsH = mLeads + mMsg + gConv;
  const prevLeadsH = cmpMLeads + cmpMMsg + cmpGConv;
  const purchH = mPurch;
  const prevPurchH = cmpMPurch;
  const valH = mVal + gVal;
  const prevValH = (cmpMeta?.purchaseValue ?? 0) + (cmpGoogle?.conversionsValue ?? 0);
  const cplH = leadsH > 0 ? spend / leadsH : null;
  const prevCplH = prevLeadsH > 0 ? prevSpend / prevLeadsH : null;
  const cplDeltaH =
    cmpOn && cplH != null && prevCplH != null && prevCplH > 0
      ? relDelta(cplH, prevCplH, true)?.pct
      : undefined;
  const roasH = spend > 0 && valH > 0 ? valH / spend : null;
  const prevRoasH = prevSpend > 0 && prevValH > 0 ? prevValH / prevSpend : null;
  const roasDeltaH =
    cmpOn && roasH != null && prevRoasH != null && prevRoasH > 0
      ? relDelta(roasH, prevRoasH, false)?.pct
      : undefined;

  const roasMetricH: DashboardChannelMetric = {
    label: "ROAS",
    value: roasH != null && Number.isFinite(roasH) ? `${roasH.toFixed(2).replace(".", ",")}×` : "—",
    deltaPct: roasDeltaH,
    deltaInvert: false,
    health: mergeHealth(
      healthFromDelta(roasDeltaH, false),
      healthFromRoasTargets(roasH, tRoas)
    ),
    trend: trendFromDeltaPct(roasDeltaH),
  };

  return [
    mk(leadLabel, formatNumber(leadsH), leadsH, {
      deltaPct: d(relDelta, leadsH, prevLeadsH, cmpOn),
      deltaInvert: false,
    }),
    mk("Compras", formatNumber(purchH), purchH, {
      deltaPct: d(relDelta, purchH, prevPurchH, cmpOn),
      deltaInvert: false,
    }),
    mk("Investimento", formatSpend(spend), spend, {
      deltaPct: d(relDelta, spend, prevSpend, cmpOn),
      deltaInvert: false,
    }),
    mk("CPL", cplH != null ? formatSpend(cplH) : "—", cplH, {
      deltaPct: cplDeltaH,
      deltaInvert: true,
      target: t,
      max: maxC,
      costMetric: true,
    }),
    roasMetricH,
    mk("CTR", ctr != null ? formatPercent(ctr) : "—", ctr, {
      deltaPct: ctrDelta,
      deltaInvert: false,
    }),
  ];
}
