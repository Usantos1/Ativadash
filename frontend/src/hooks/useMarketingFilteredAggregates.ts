import { useEffect, useMemo, useState } from "react";
import type { GoogleAdsCampaignRow, MetaAdsCampaignRow } from "@/lib/integrations-api";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import { fetchLaunches, fetchGoals, type LaunchRow } from "@/lib/workspace-api";
import { fetchMarketingSettings, type MarketingSettingsDto } from "@/lib/marketing-settings-api";
import {
  type TempFilter,
  aggregateGoogle,
  aggregateMeta,
  buildGoogleOnlyDailyChart,
  buildMergedDailyChart,
  buildMetaOnlyDailyChart,
  computeScaleFactor,
  filterGoogleCampaigns,
  filterMetaCampaigns,
  gradeDistributionFromCampaigns,
  isHotCampaignName,
  pickLeadGoalTarget,
  splitHotColdLeadsSpend,
} from "@/lib/marketing-capture-aggregate";

export function useMarketingFilteredAggregates() {
  const metricsApi = useMarketingMetrics();
  const {
    dateRange,
    metrics,
    metaMetrics,
    cmpMetrics,
    cmpMetaMetrics,
    hasGoogle,
    hasMeta,
    metricsError,
    metaMetricsError,
    metricsLoading,
    metaMetricsLoading,
  } = metricsApi;

  const [launches, setLaunches] = useState<LaunchRow[]>([]);
  const [launchId, setLaunchId] = useState<string>("all");
  const [tempFilter, setTempFilter] = useState<TempFilter>("geral");
  const [settings, setSettings] = useState<MarketingSettingsDto | null>(null);
  const [leadGoalTarget, setLeadGoalTarget] = useState<number | null>(null);

  useEffect(() => {
    let c = false;
    fetchLaunches()
      .then((list) => {
        if (!c) setLaunches(list);
      })
      .catch(() => {
        if (!c) setLaunches([]);
      });
    fetchGoals()
      .then((g) => {
        if (!c) setLeadGoalTarget(pickLeadGoalTarget(g));
      })
      .catch(() => {
        if (!c) setLeadGoalTarget(null);
      });
    fetchMarketingSettings()
      .then((s) => {
        if (!c) setSettings(s);
      })
      .catch(() => {
        if (!c) setSettings(null);
      });
    return () => {
      c = true;
    };
  }, []);

  const selectedLaunch = useMemo(
    () => (launchId === "all" ? null : launches.find((l) => l.id === launchId) ?? null),
    [launches, launchId]
  );
  const launchNameForFilter = selectedLaunch?.name ?? null;

  const googleDaily = metrics?.ok ? metrics.daily ?? [] : [];
  const metaDaily = metaMetrics?.ok ? metaMetrics.daily ?? [] : [];

  const googleCampaignsFiltered = useMemo(() => {
    if (!metrics?.ok) return [];
    return filterGoogleCampaigns(metrics.campaigns, launchNameForFilter, tempFilter);
  }, [metrics, launchNameForFilter, tempFilter]);

  const metaCampaignsFiltered = useMemo(() => {
    if (!metaMetrics?.ok) return [];
    return filterMetaCampaigns(metaMetrics.campaigns, launchNameForFilter, tempFilter);
  }, [metaMetrics, launchNameForFilter, tempFilter]);

  const googleCampaignsCmpFiltered = useMemo(() => {
    if (!cmpMetrics?.ok) return [];
    return filterGoogleCampaigns(cmpMetrics.campaigns, launchNameForFilter, tempFilter);
  }, [cmpMetrics, launchNameForFilter, tempFilter]);

  const metaCampaignsCmpFiltered = useMemo(() => {
    if (!cmpMetaMetrics?.ok) return [];
    return filterMetaCampaigns(cmpMetaMetrics.campaigns, launchNameForFilter, tempFilter);
  }, [cmpMetaMetrics, launchNameForFilter, tempFilter]);

  const cmpAggG = useMemo(() => aggregateGoogle(googleCampaignsCmpFiltered), [googleCampaignsCmpFiltered]);
  const cmpAggM = useMemo(() => aggregateMeta(metaCampaignsCmpFiltered), [metaCampaignsCmpFiltered]);

  const aggG = useMemo(() => aggregateGoogle(googleCampaignsFiltered), [googleCampaignsFiltered]);
  const aggM = useMemo(() => aggregateMeta(metaCampaignsFiltered), [metaCampaignsFiltered]);

  const totalSpendSummary =
    (metrics?.ok ? metrics.summary.costMicros / 1_000_000 : 0) +
    (metaMetrics?.ok ? metaMetrics.summary.spend : 0);
  const filteredSpend = aggG.costMicros / 1_000_000 + aggM.spend;
  const chartScale = computeScaleFactor(filteredSpend, totalSpendSummary);

  const mergedChartData = useMemo(
    () =>
      buildMergedDailyChart(dateRange.startDate, dateRange.endDate, googleDaily, metaDaily, chartScale),
    [dateRange.startDate, dateRange.endDate, googleDaily, metaDaily, chartScale]
  );

  const googleSpendTotal = metrics?.ok ? metrics.summary.costMicros / 1_000_000 : 0;
  const metaSpendTotal = metaMetrics?.ok ? metaMetrics.summary.spend : 0;
  const googleScale = computeScaleFactor(aggG.costMicros / 1_000_000, googleSpendTotal || 0);
  const metaScale = computeScaleFactor(aggM.spend, metaSpendTotal || 0);

  const googleOnlyChart = useMemo(
    () => buildGoogleOnlyDailyChart(dateRange.startDate, dateRange.endDate, googleDaily, googleScale || chartScale),
    [dateRange.startDate, dateRange.endDate, googleDaily, googleScale, chartScale]
  );
  const metaOnlyChart = useMemo(
    () => buildMetaOnlyDailyChart(dateRange.startDate, dateRange.endDate, metaDaily, metaScale || chartScale),
    [dateRange.startDate, dateRange.endDate, metaDaily, metaScale, chartScale]
  );

  const leadsReais = aggG.conversions + aggM.leads;
  const prevFilteredSpend = cmpAggG.costMicros / 1_000_000 + cmpAggM.spend;
  const prevLeadsReais = cmpAggG.conversions + cmpAggM.leads;
  const prevAttributedRevenue = cmpAggG.conversionsValue + cmpAggM.purchaseValue;

  const attributedRevenue = aggG.conversionsValue + aggM.purchaseValue;
  const impressionsT = aggG.impressions + aggM.impressions;
  const clicksT = aggG.clicks + aggM.clicks;
  const ctrT = impressionsT > 0 ? (clicksT / impressionsT) * 100 : null;
  const cpcT = clicksT > 0 ? filteredSpend / clicksT : null;
  const cpmT = impressionsT > 0 ? (filteredSpend / impressionsT) * 1000 : null;
  const cplLeads = leadsReais > 0 ? filteredSpend / leadsReais : null;

  const unifiedCampaignRows = useMemo(() => {
    const gRows: GoogleAdsCampaignRow[] = metrics?.ok ? googleCampaignsFiltered : [];
    const mRows: MetaAdsCampaignRow[] = metaMetrics?.ok ? metaCampaignsFiltered : [];
    const out: {
      channel: "Google" | "Meta";
      campaignName: string;
      spend: number;
      impressions: number;
      clicks: number;
      leads: number;
      sales: number;
      revenue: number;
    }[] = [];
    for (const r of gRows) {
      out.push({
        channel: "Google",
        campaignName: r.campaignName,
        spend: r.costMicros / 1_000_000,
        impressions: r.impressions,
        clicks: r.clicks,
        leads: r.conversions,
        sales: 0,
        revenue: r.conversionsValue ?? 0,
      });
    }
    for (const r of mRows) {
      out.push({
        channel: "Meta",
        campaignName: r.campaignName,
        spend: r.spend,
        impressions: r.impressions,
        clicks: r.clicks,
        leads: r.leads,
        sales: r.purchases ?? 0,
        revenue: r.purchaseValue ?? 0,
      });
    }
    return out.sort((a, b) => b.spend - a.spend);
  }, [metrics?.ok, metaMetrics?.ok, googleCampaignsFiltered, metaCampaignsFiltered]);

  const mqlNumerator = aggG.conversions + aggM.purchases;
  const grades = useMemo(
    () => gradeDistributionFromCampaigns(googleCampaignsFiltered, metaCampaignsFiltered),
    [googleCampaignsFiltered, metaCampaignsFiltered]
  );

  const hotCold = useMemo(
    () => splitHotColdLeadsSpend(googleCampaignsFiltered, metaCampaignsFiltered),
    [googleCampaignsFiltered, metaCampaignsFiltered]
  );

  const googleOnlyHotCold = useMemo(() => {
    const hot = googleCampaignsFiltered.filter((r) => isHotCampaignName(r.campaignName));
    const cold = googleCampaignsFiltered.filter((r) => !isHotCampaignName(r.campaignName));
    const h = aggregateGoogle(hot);
    const c = aggregateGoogle(cold);
    return {
      hotLeads: h.conversions,
      coldLeads: c.conversions,
      hotSpend: h.costMicros / 1_000_000,
      coldSpend: c.costMicros / 1_000_000,
    };
  }, [googleCampaignsFiltered]);

  const metaOnlyHotCold = useMemo(() => {
    const hot = metaCampaignsFiltered.filter((r) => isHotCampaignName(r.campaignName));
    const cold = metaCampaignsFiltered.filter((r) => !isHotCampaignName(r.campaignName));
    const h = aggregateMeta(hot);
    const c = aggregateMeta(cold);
    return {
      hotLeads: h.leads + h.purchases,
      coldLeads: c.leads + c.purchases,
      hotSpend: h.spend,
      coldSpend: c.spend,
    };
  }, [metaCampaignsFiltered]);

  const dataHealthy =
    (hasGoogle && metrics?.ok && !metricsError) || (hasMeta && metaMetrics?.ok && !metaMetricsError);
  const loadingAny = metricsLoading || metaMetricsLoading;

  return {
    ...metricsApi,
    launches,
    launchId,
    setLaunchId,
    tempFilter,
    setTempFilter,
    selectedLaunch,
    launchNameForFilter,
    settings,
    leadGoalTarget,
    googleDaily,
    metaDaily,
    googleCampaignsFiltered,
    metaCampaignsFiltered,
    cmpAggG,
    cmpAggM,
    aggG,
    aggM,
    filteredSpend,
    chartScale,
    mergedChartData,
    googleOnlyChart,
    metaOnlyChart,
    leadsReais,
    prevFilteredSpend,
    prevLeadsReais,
    prevAttributedRevenue,
    attributedRevenue,
    impressionsT,
    clicksT,
    ctrT,
    cpcT,
    cpmT,
    cplLeads,
    unifiedCampaignRows,
    mqlNumerator,
    grades,
    hotCold,
    googleOnlyHotCold,
    metaOnlyHotCold,
    dataHealthy,
    loadingAny,
  };
}
