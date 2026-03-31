import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { differenceInDays, parseISO } from "date-fns";
import { BarChart3, RefreshCw, Share2, CalendarRange, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { MarketingDateRangeDialog } from "@/components/marketing/MarketingDateRangeDialog";
import { MarketingShareDialog } from "@/components/marketing/MarketingShareDialog";
import { IndeterminateLoadingBar } from "@/components/ui/indeterminate-loading-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { MarketingCampaignsOsTable } from "@/components/marketing/MarketingCampaignsOsTable";
import { PageHeaderPremium, StatusBadge, AnalyticsSection } from "@/components/premium";
import { CaptureTrendComposedChart } from "@/components/marketing/CaptureTrendComposedChart";
import {
  CockpitSectionTitle,
  MarketingActionQueue,
  MarketingChannelPanel,
  MarketingChannelPanelSales,
  MarketingCockpitStatus,
  MarketingFunnelStrip,
  type FunnelStripStep,
} from "@/components/marketing/MarketingCockpit";
import { AppMainRouteBody } from "@/components/layout/AppMainRouteBody";
import { cn } from "@/lib/utils";
import type {
  GoogleAdsAdGroupRow,
  GoogleAdsAdRow,
  MetaAdRow,
  MetaAdsetRow,
} from "@/lib/integrations-api";
import {
  fetchGoogleAdsAdGroups,
  fetchGoogleAdsAds,
  fetchMetaAdsByAdLevel,
  fetchMetaAdsetsMetrics,
} from "@/lib/integrations-api";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import { fetchMarketingSettings, type MarketingSettingsDto } from "@/lib/marketing-settings-api";
import { fetchOrganizationContext, type OrganizationContext } from "@/lib/organization-api";
import {
  defaultMarketingGoalContext,
  goalContextFromSettingsDto,
} from "@/lib/business-goal-mode";
import {
  buildOperationalActions,
  findCtrLowCampaigns,
} from "@/lib/marketing-operational-actions";
import { deriveChannelPerformanceSignals } from "@/lib/channel-performance-compare";
import { useAuthStore } from "@/stores/auth-store";
import {
  patchMarketingGoogleCampaignStatus,
  patchMarketingMetaCampaignBudget,
  patchMarketingMetaCampaignStatus,
} from "@/lib/marketing-contract-api";
import { canUserMutateMarketingAds } from "@/lib/marketing-ads-permissions";
import {
  aggregateGoogle,
  aggregateMeta,
  buildMergedDailyChart,
  computeScaleFactor,
  filterGoogleCampaigns,
  filterMetaCampaigns,
} from "@/lib/marketing-capture-aggregate";
import { chartLeadExtrema, deriveAccountHealth } from "@/lib/marketing-strategic-insights";
import { generateInsights } from "@/lib/marketing-insights-engine";
import { isNonDefaultPeriod } from "@/lib/marketing-period-storage";
import type { OsCampaignRow } from "@/lib/marketing-campaign-os";

export function Marketing() {
  const navigate = useNavigate();
  const {
    dateRange,
    dateRangeLabel,
    presetId,
    pickerOpen,
    setPickerOpen,
    applyDateFilter,
    hasGoogle,
    hasMeta,
    metrics,
    metaMetrics,
    metricsLoading,
    metaMetricsLoading,
    metricsError,
    metaMetricsError,
    refreshAll,
    lastUpdated,
  } = useMarketingMetrics();

  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);

  const [osPlatform, setOsPlatform] = useState<"meta" | "google">("meta");
  const [osLevel, setOsLevel] = useState<"campaign" | "adset" | "ad">("campaign");
  const [metaAdsetRows, setMetaAdsetRows] = useState<MetaAdsetRow[]>([]);
  const [metaAdRows, setMetaAdRows] = useState<MetaAdRow[]>([]);
  const [googleAdGroupRowsOs, setGoogleAdGroupRowsOs] = useState<GoogleAdsAdGroupRow[]>([]);
  const [googleAdRowsOs, setGoogleAdRowsOs] = useState<GoogleAdsAdRow[]>([]);
  const [deepLoading, setDeepLoading] = useState(false);
  const [settings, setSettings] = useState<MarketingSettingsDto | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [adsActionHint, setAdsActionHint] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [mutatingAdsKey, setMutatingAdsKey] = useState<string | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetTarget, setBudgetTarget] = useState<{ id: string; name: string } | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [orgCtx, setOrgCtx] = useState<OrganizationContext | null>(null);

  const membershipRole = useMemo(() => {
    if (!user?.organizationId) return null;
    return memberships?.find((m) => m.organizationId === user.organizationId)?.role ?? null;
  }, [user?.organizationId, memberships]);
  const canMutateAds = canUserMutateMarketingAds(membershipRole);
  const planAllowsCampaignWrite = orgCtx?.enabledFeatures?.campaignWrite !== false;
  const canMutateCampaigns = canMutateAds && planAllowsCampaignWrite;

  useEffect(() => {
    const scrollToActions = () => {
      if (window.location.hash !== "#painel-acoes-ads") return;
      requestAnimationFrame(() => {
        document.getElementById("painel-acoes-ads")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    scrollToActions();
    window.addEventListener("hashchange", scrollToActions);
    return () => window.removeEventListener("hashchange", scrollToActions);
  }, []);

  useEffect(() => {
    let c = false;
    fetchOrganizationContext()
      .then((ctx) => {
        if (!c) setOrgCtx(ctx);
      })
      .catch(() => {
        if (!c) setOrgCtx(null);
      });
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    let c = false;
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

  const runMetaStatus = useCallback(
    async (id: string, status: "PAUSED" | "ACTIVE") => {
      const key = `meta:${id}:${status}`;
      setMutatingAdsKey(key);
      setAdsActionHint(null);
      try {
        await patchMarketingMetaCampaignStatus(id, status);
        setAdsActionHint({
          tone: "ok",
          text: status === "PAUSED" ? "Campanha Meta pausada." : "Campanha Meta ativada.",
        });
        refreshAll();
      } catch (e) {
        setAdsActionHint({
          tone: "err",
          text: e instanceof Error ? e.message : "Não foi possível alterar a campanha na Meta.",
        });
      } finally {
        setMutatingAdsKey(null);
      }
    },
    [refreshAll]
  );

  const runGoogleStatus = useCallback(
    async (id: string, status: "ENABLED" | "PAUSED") => {
      setMutatingAdsKey(`google:${id}:${status}`);
      setAdsActionHint(null);
      try {
        await patchMarketingGoogleCampaignStatus(id, status);
        setAdsActionHint({
          tone: "ok",
          text: status === "PAUSED" ? "Campanha Google pausada." : "Campanha Google ativada.",
        });
        refreshAll();
      } catch (e) {
        setAdsActionHint({
          tone: "err",
          text: e instanceof Error ? e.message : "Não foi possível alterar a campanha no Google.",
        });
      } finally {
        setMutatingAdsKey(null);
      }
    },
    [refreshAll]
  );

  const openBudgetDialog = useCallback((id: string, name: string) => {
    setBudgetTarget({ id, name });
    setBudgetInput("");
    setBudgetDialogOpen(true);
    setAdsActionHint(null);
  }, []);

  const submitMetaBudget = useCallback(async () => {
    if (!budgetTarget) return;
    const v = parseFloat(budgetInput.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      setAdsActionHint({ tone: "err", text: "Informe um valor diário maior que zero." });
      return;
    }
    setBudgetSaving(true);
    setAdsActionHint(null);
    try {
      await patchMarketingMetaCampaignBudget(budgetTarget.id, v);
      setAdsActionHint({ tone: "ok", text: "Orçamento diário da campanha Meta atualizado." });
      setBudgetDialogOpen(false);
      setBudgetTarget(null);
      refreshAll();
    } catch (e) {
      setAdsActionHint({
        tone: "err",
        text: e instanceof Error ? e.message : "Não foi possível atualizar o orçamento.",
      });
    } finally {
      setBudgetSaving(false);
    }
  }, [budgetTarget, budgetInput, refreshAll]);

  const googleDaily = metrics?.ok ? metrics.daily ?? [] : [];
  const metaDaily = metaMetrics?.ok ? metaMetrics.daily ?? [] : [];

  const googleCampaignsFiltered = useMemo(() => {
    if (!metrics?.ok) return [];
    return filterGoogleCampaigns(metrics.campaigns, null, "geral");
  }, [metrics]);

  const metaCampaignsFiltered = useMemo(() => {
    if (!metaMetrics?.ok) return [];
    return filterMetaCampaigns(metaMetrics.campaigns, null, "geral");
  }, [metaMetrics]);

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

  const leadsReais = aggG.conversions + aggM.leads + aggM.messagingConversationsStarted;
  const attributedRevenue = aggG.conversionsValue + aggM.purchaseValue;
  const impressionsT = aggG.impressions + aggM.impressions;
  const clicksT = aggG.clicks + aggM.clicks;
  const ctrT = impressionsT > 0 ? (clicksT / impressionsT) * 100 : null;
  const roasBlend = filteredSpend > 0 && attributedRevenue > 0 ? attributedRevenue / filteredSpend : null;
  const goalCtx = useMemo(() => {
    if (!settings) return defaultMarketingGoalContext();
    return goalContextFromSettingsDto(settings);
  }, [settings]);
  const goalMode = goalCtx.businessGoalMode;

  const periodDays = useMemo(() => {
    const a = parseISO(dateRange.startDate);
    const b = parseISO(dateRange.endDate);
    return Math.max(1, differenceInDays(b, a) + 1);
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    let cancelled = false;
    if (osPlatform === "meta") {
      if (osLevel === "campaign") {
        setMetaAdsetRows([]);
        setMetaAdRows([]);
        setDeepLoading(false);
        return;
      }
      if (!hasMeta) return;
      setDeepLoading(true);
      void (async () => {
        try {
          if (osLevel === "adset") {
            const res = await fetchMetaAdsetsMetrics(dateRange);
            if (!cancelled) {
              setMetaAdsetRows(res?.ok ? res.rows : []);
              setMetaAdRows([]);
            }
          } else {
            const res = await fetchMetaAdsByAdLevel(dateRange);
            if (!cancelled) {
              setMetaAdRows(res?.ok ? res.rows : []);
              setMetaAdsetRows([]);
            }
          }
        } finally {
          if (!cancelled) setDeepLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    if (osPlatform === "google") {
      if (osLevel === "campaign") {
        setGoogleAdGroupRowsOs([]);
        setGoogleAdRowsOs([]);
        setDeepLoading(false);
        return;
      }
      if (!hasGoogle || metrics?.ok !== true) {
        setGoogleAdGroupRowsOs([]);
        setGoogleAdRowsOs([]);
        setDeepLoading(false);
        return;
      }
      setDeepLoading(true);
      void (async () => {
        try {
          if (osLevel === "adset") {
            const ag = await fetchGoogleAdsAdGroups(dateRange);
            if (!cancelled) {
              setGoogleAdGroupRowsOs(ag?.ok ? ag.rows : []);
              setGoogleAdRowsOs([]);
            }
          } else {
            const ads = await fetchGoogleAdsAds(dateRange);
            if (!cancelled) {
              setGoogleAdRowsOs(ads?.ok ? ads.rows : []);
              setGoogleAdGroupRowsOs([]);
            }
          }
        } finally {
          if (!cancelled) setDeepLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [osPlatform, osLevel, dateRange.startDate, dateRange.endDate, hasMeta, hasGoogle, metrics?.ok]);

  const osRows: OsCampaignRow[] = useMemo(() => {
    if (osPlatform === "meta") {
      if (!metaMetrics?.ok) return [];
      if (osLevel === "campaign") {
        return metaCampaignsFiltered.map((r, i) => ({
          id: `meta-camp-${r.campaignId ?? i}`,
          channel: "Meta",
          level: "campaign",
          name: r.campaignName,
          externalId: r.campaignId,
          effectiveStatus: r.entityStatus ?? null,
          spend: r.spend,
          impressions: r.impressions,
          clicks: r.clicks,
          leads: r.leads + (r.messagingConversationsStarted ?? 0),
          sales: r.purchases ?? 0,
          revenue: r.purchaseValue ?? 0,
        }));
      }
      if (osLevel === "adset") {
        return metaAdsetRows.map((r, i) => ({
          id: `meta-adset-${r.adsetId ?? "x"}-${i}`,
          channel: "Meta",
          level: "adset",
          name: r.adsetName,
          parentLabel: r.campaignName ?? null,
          externalId: r.adsetId,
          spend: r.spend,
          impressions: r.impressions,
          clicks: r.clicks,
          leads: r.leads,
          sales: r.purchases ?? 0,
          revenue: r.purchaseValue ?? 0,
        }));
      }
      return metaAdRows.map((r, i) => ({
        id: `meta-ad-${r.adId ?? "x"}-${i}`,
        channel: "Meta",
        level: "ad",
        name: r.adName,
        parentLabel: [r.campaignName, r.adsetName].filter(Boolean).join(" · ") || null,
        externalId: r.adId,
        spend: r.spend,
        impressions: r.impressions,
        clicks: r.clicks,
        leads: r.leads,
        sales: r.purchases ?? 0,
        revenue: r.purchaseValue ?? 0,
      }));
    }
    if (osPlatform === "google" && metrics?.ok) {
      if (osLevel === "campaign") {
        return googleCampaignsFiltered.map((r, i) => ({
          id: `gg-camp-${r.campaignId ?? i}`,
          channel: "Google",
          level: "campaign",
          name: r.campaignName,
          externalId: r.campaignId,
          effectiveStatus: r.entityStatus ?? null,
          spend: r.costMicros / 1_000_000,
          impressions: r.impressions,
          clicks: r.clicks,
          leads: r.conversions,
          sales: r.conversions,
          revenue: r.conversionsValue ?? 0,
        }));
      }
      if (osLevel === "adset") {
        return googleAdGroupRowsOs.map((r, i) => ({
          id: `gg-ag-${r.campaignName}-${r.adGroupName}-${i}`,
          channel: "Google",
          level: "adset",
          name: r.adGroupName,
          parentLabel: r.campaignName,
          effectiveStatus: r.entityStatus ?? null,
          spend: r.costMicros / 1_000_000,
          impressions: r.impressions,
          clicks: r.clicks,
          leads: r.conversions,
          sales: r.conversions,
          revenue: r.conversionsValue ?? 0,
        }));
      }
      return googleAdRowsOs.map((r, i) => ({
        id: `gg-ad-${r.adId}-${i}`,
        channel: "Google",
        level: "ad",
        name: r.adId ? `Anúncio ${r.adId}` : `Anúncio ${i + 1}`,
        parentLabel: `${r.campaignName} · ${r.adGroupName}`,
        effectiveStatus: r.entityStatus ?? null,
        spend: r.costMicros / 1_000_000,
        impressions: r.impressions,
        clicks: r.clicks,
        leads: r.conversions,
        sales: r.conversions,
        revenue: r.conversionsValue ?? 0,
      }));
    }
    return [];
  }, [
    osPlatform,
    osLevel,
    metaMetrics?.ok,
    metrics?.ok,
    metaCampaignsFiltered,
    googleCampaignsFiltered,
    metaAdsetRows,
    metaAdRows,
    googleAdGroupRowsOs,
    googleAdRowsOs,
  ]);

  const cpaTrafego = leadsReais > 0 ? filteredSpend / leadsReais : 0;
  const targetCpa = settings?.targetCpaBrl ?? null;

  const accountHealth = useMemo(
    () =>
      deriveAccountHealth({
        mode: goalMode,
        filteredSpend,
        leadsReais,
        roasBlend,
        blendCpl: cpaTrafego,
        ctrT,
        targetCpa,
        maxCpa: settings?.maxCpaBrl ?? null,
        targetRoas: settings?.targetRoas ?? null,
      }),
    [
      goalMode,
      filteredSpend,
      leadsReais,
      roasBlend,
      cpaTrafego,
      ctrT,
      targetCpa,
      settings?.maxCpaBrl,
      settings?.targetRoas,
    ]
  );

  const chartDayInsights = useMemo(() => chartLeadExtrema(mergedChartData), [mergedChartData]);

  const insightPulse = useMemo(
    () =>
      generateInsights({
        goalMode,
        spend: filteredSpend,
        clicks: clicksT,
        leads: leadsReais,
        impressions: impressionsT,
        landingPageViews: aggM.landingPageViews,
        cpl: leadsReais > 0 ? cpaTrafego : null,
        cplTarget: settings?.targetCpaBrl ?? null,
        maxCpl: settings?.maxCpaBrl ?? null,
        ctrPct: ctrT,
        purchases: aggM.purchases,
      }),
    [
      goalMode,
      filteredSpend,
      clicksT,
      leadsReais,
      impressionsT,
      aggM.landingPageViews,
      aggM.purchases,
      cpaTrafego,
      settings?.targetCpaBrl,
      settings?.maxCpaBrl,
      ctrT,
    ]
  );

  const metaLeadishAgg = aggM.leads + aggM.messagingConversationsStarted;
  const metaCplChannel =
    aggM.spend > 0 && metaLeadishAgg > 0 ? aggM.spend / metaLeadishAgg : null;
  const metaRoasChannel =
    aggM.spend > 0 && aggM.purchaseValue > 0 ? aggM.purchaseValue / aggM.spend : null;

  const googleSpendAgg = aggG.costMicros / 1_000_000;
  const googleCplChannel =
    googleSpendAgg > 0 && aggG.conversions > 0 ? googleSpendAgg / aggG.conversions : null;
  const googleRoasChannel =
    googleSpendAgg > 0 && (aggG.conversionsValue ?? 0) > 0
      ? (aggG.conversionsValue ?? 0) / googleSpendAgg
      : null;

  const ctrLowCampaigns = useMemo(
    () => findCtrLowCampaigns(metaCampaignsFiltered, googleCampaignsFiltered),
    [metaCampaignsFiltered, googleCampaignsFiltered]
  );

  const operationalActions = useMemo(
    () =>
      buildOperationalActions({
        goalMode,
        targetCpa: settings?.targetCpaBrl ?? null,
        targetRoas: settings?.targetRoas ?? null,
        metaRows: metaCampaignsFiltered,
        googleRows: googleCampaignsFiltered,
        ctrLowCampaigns,
        maxItems: 10,
      }),
    [
      goalMode,
      settings?.targetCpaBrl,
      settings?.targetRoas,
      metaCampaignsFiltered,
      googleCampaignsFiltered,
      ctrLowCampaigns,
    ]
  );

  const channelSignals = useMemo(() => {
    if (!hasMeta || !hasGoogle) return null;
    return deriveChannelPerformanceSignals(
      goalMode,
      {
        cpl: metaCplChannel,
        costPerPurchase:
          aggM.purchases > 0 && aggM.spend > 0 ? aggM.spend / aggM.purchases : null,
        roas: metaRoasChannel,
      },
      { costPerConv: googleCplChannel, roas: googleRoasChannel }
    );
  }, [
    hasMeta,
    hasGoogle,
    goalMode,
    metaCplChannel,
    googleCplChannel,
    metaRoasChannel,
    googleRoasChannel,
    aggM.purchases,
    aggM.spend,
  ]);

  const funnelStripSteps: FunnelStripStep[] = useMemo(() => {
    const lpv = aggM.landingPageViews;
    const ctrFromImpr = ctrT;
    const lpvPerClick = clicksT > 0 ? (lpv / clicksT) * 100 : null;
    const leadPerClick = clicksT > 0 ? (leadsReais / clicksT) * 100 : null;
    return [
      { key: "impr", title: "Impressões", volume: impressionsT, ratePct: null },
      { key: "clk", title: "Cliques", volume: clicksT, ratePct: ctrFromImpr },
      { key: "lpv", title: "LPV", volume: lpv, ratePct: lpvPerClick },
      { key: "lead", title: "Leads", volume: leadsReais, ratePct: leadPerClick },
    ];
  }, [impressionsT, clicksT, ctrT, aggM.landingPageViews, leadsReais]);

  const funnelWorstKey = useMemo(() => {
    const lpv = aggM.landingPageViews;
    const ctrS = ctrT == null ? 1 : ctrT >= 1 ? 3 : ctrT >= 0.5 ? 2 : 0;
    const lpvS =
      clicksT < 10 ? 2 : lpv / Math.max(1, clicksT) >= 0.28 ? 3 : lpv / Math.max(1, clicksT) >= 0.12 ? 2 : 0;
    const leadS =
      clicksT < 10
        ? 2
        : leadsReais / Math.max(1, clicksT) >= 0.04
          ? 3
          : leadsReais / Math.max(1, clicksT) >= 0.015
            ? 2
            : 0;
    const ranked = [
      { key: "clk" as const, s: ctrS },
      { key: "lpv" as const, s: lpvS },
      { key: "lead" as const, s: leadS },
    ];
    ranked.sort((a, b) => a.s - b.s);
    return ranked[0].s < 2 ? ranked[0].key : null;
  }, [ctrT, clicksT, aggM.landingPageViews, leadsReais]);

  const dataHealthy =
    (hasGoogle && metrics?.ok && !metricsError) || (hasMeta && metaMetrics?.ok && !metaMetricsError);
  const loadingAny = metricsLoading || metaMetricsLoading;

  useEffect(() => {
    if (!hasMeta && hasGoogle) setOsPlatform("google");
    if (hasMeta && !hasGoogle) setOsPlatform("meta");
  }, [hasMeta, hasGoogle]);

  return (
    <AppMainRouteBody className="space-y-6">
      <PageHeaderPremium
        eyebrow="ADS"
        title="Painel ADS"
        subtitle="Cockpit operacional — ler, decidir e agir."
        meta={
          <>
            {lastUpdated ? (
              <span className="text-xs text-muted-foreground">
                Sync{" "}
                <span className="font-medium text-foreground">
                  {lastUpdated.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </span>
            ) : null}
            {hasGoogle || hasMeta ? (
              <StatusBadge tone={dataHealthy && !loadingAny ? "healthy" : "alert"} dot>
                {loadingAny ? "…" : dataHealthy ? "OK" : "Integrações"}
              </StatusBadge>
            ) : null}
          </>
        }
        actions={
          hasGoogle || hasMeta ? (
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 rounded-lg border-border/70 bg-background/80 shadow-sm",
                    isNonDefaultPeriod(presetId) && "border-amber-500/45 bg-amber-500/[0.07] ring-1 ring-amber-500/20"
                  )}
                  onClick={() => setPickerOpen(true)}
                >
                  <CalendarRange className="mr-1.5 h-3.5 w-3.5 opacity-70" />
                  {dateRangeLabel}
                  {isNonDefaultPeriod(presetId) ? (
                    <span className="ml-2 rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-950 dark:text-amber-100">
                      Período
                    </span>
                  ) : null}
                </Button>
                <MarketingDateRangeDialog
                  open={pickerOpen}
                  onOpenChange={setPickerOpen}
                  initial={dateRange}
                  initialLabel={dateRangeLabel}
                  initialPresetId={presetId}
                  initialCompare={false}
                  onApply={applyDateFilter}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg border-border/70 bg-background/80 shadow-sm"
                  disabled={metricsLoading || metaMetricsLoading}
                  onClick={() => refreshAll()}
                >
                  <RefreshCw
                    className={`mr-1.5 h-3.5 w-3.5 ${metricsLoading || metaMetricsLoading ? "animate-spin" : ""}`}
                  />
                  Atualizar
                </Button>
                <Button
                  size="sm"
                  className="h-9 rounded-lg shadow-sm"
                  variant="secondary"
                  type="button"
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  Compartilhar
                </Button>
                <MarketingShareDialog
                  open={shareOpen}
                  onOpenChange={setShareOpen}
                  page="painel"
                  startDate={dateRange.startDate}
                  endDate={dateRange.endDate}
                  periodLabel={dateRangeLabel}
                />
                <Button variant="default" size="sm" className="h-9 rounded-lg shadow-sm" asChild>
                  <Link to="/marketing/configuracoes">Metas e alertas</Link>
                </Button>
              </div>
            </div>
          ) : null
        }
      />

      {adsActionHint ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            adsActionHint.tone === "ok"
              ? "border-emerald-500/35 bg-emerald-500/[0.08] text-foreground"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          )}
          role="status"
        >
          {adsActionHint.text}
        </div>
      ) : null}

      {canMutateAds && orgCtx != null && orgCtx.enabledFeatures.campaignWrite === false ? (
        <div
          className="rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-4 py-3 text-sm text-foreground"
          role="status"
        >
          O plano desta empresa não inclui edição de campanhas nas redes (pausar, ativar ou orçamento). Peça ao
          administrador da plataforma ou da matriz para habilitar o recurso no plano.
        </div>
      ) : null}

      {(hasGoogle || hasMeta) && loadingAny && (
        <div className="rounded-xl border border-primary/25 bg-primary/[0.07] px-4 py-3 shadow-[var(--shadow-surface-sm)]">
          <IndeterminateLoadingBar label="Carregando métricas na API (Google / Meta)…" />
        </div>
      )}

      {!hasGoogle && !hasMeta ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhum dado de marketing ainda"
          description="Conecte o Google Ads ou Meta Ads nas Integrações para começar a ver métricas aqui."
          actionLabel="Ir para Integrações"
          onAction={() => navigate("/marketing/integracoes")}
          className="min-h-[320px]"
        />
      ) : (
        <div className="space-y-5">
          {(metrics?.ok || metaMetrics?.ok) && (
            <>
              <MarketingCockpitStatus
                health={accountHealth}
                goalMode={goalMode}
                leads={leadsReais}
                cpl={leadsReais > 0 ? cpaTrafego : null}
                cplTarget={settings?.targetCpaBrl ?? null}
                spend={filteredSpend}
                revenue={
                  goalMode === "SALES" || goalMode === "HYBRID" ? attributedRevenue : null
                }
                roas={
                  goalMode === "SALES" || goalMode === "HYBRID" ? roasBlend : null
                }
              />
              {insightPulse.length ? (
                <div className="flex flex-wrap gap-2">
                  {insightPulse.slice(0, 4).map((i) => (
                    <span
                      key={i.id}
                      className="max-w-full rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium leading-snug text-foreground"
                    >
                      {i.title}
                    </span>
                  ))}
                </div>
              ) : null}
              <div id="painel-acoes-ads" className="scroll-mt-24">
                <CockpitSectionTitle kicker="Ações">O que fazer agora</CockpitSectionTitle>
                <MarketingActionQueue
                  items={operationalActions}
                  busyKey={mutatingAdsKey}
                  canMutate={canMutateCampaigns}
                  onPauseMeta={(id) => void runMetaStatus(id, "PAUSED")}
                  onPauseGoogle={(id) => void runGoogleStatus(id, "PAUSED")}
                  onBudgetMeta={(id, name) => openBudgetDialog(id, name)}
                  onDuplicateStub={() =>
                    setAdsActionHint({
                      tone: "ok",
                      text: "Duplicar campanha: use o Gerenciador Meta/Google (integração em breve no painel).",
                    })
                  }
                />
              </div>
              <div>
                <CockpitSectionTitle kicker="Canais">Meta · Google</CockpitSectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  {goalMode === "SALES" ? (
                    <>
                      {hasMeta && metaMetrics?.ok ? (
                        <MarketingChannelPanelSales
                          name="Meta"
                          status={
                            channelSignals
                              ? channelSignals.meta === "best"
                                ? "good"
                                : channelSignals.meta === "attention"
                                  ? "bad"
                                  : "mid"
                              : "mid"
                          }
                          revenue={aggM.purchaseValue}
                          roas={metaRoasChannel}
                          spend={aggM.spend}
                          mixPct={
                            filteredSpend > 0 ? (aggM.spend / filteredSpend) * 100 : null
                          }
                        />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                          Meta
                        </div>
                      )}
                      {hasGoogle && metrics?.ok ? (
                        <MarketingChannelPanelSales
                          name="Google"
                          status={
                            channelSignals
                              ? channelSignals.google === "best"
                                ? "good"
                                : channelSignals.google === "attention"
                                  ? "bad"
                                  : "mid"
                              : "mid"
                          }
                          revenue={aggG.conversionsValue ?? 0}
                          roas={googleRoasChannel}
                          spend={googleSpendAgg}
                          mixPct={
                            filteredSpend > 0 ? (googleSpendAgg / filteredSpend) * 100 : null
                          }
                        />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                          Google
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {hasMeta && metaMetrics?.ok ? (
                        <MarketingChannelPanel
                          name="Meta"
                          status={
                            channelSignals
                              ? channelSignals.meta === "best"
                                ? "good"
                                : channelSignals.meta === "attention"
                                  ? "bad"
                                  : "mid"
                              : "mid"
                          }
                          leads={metaLeadishAgg}
                          cpl={metaCplChannel}
                          spend={aggM.spend}
                          mixPct={
                            filteredSpend > 0 ? (aggM.spend / filteredSpend) * 100 : null
                          }
                        />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                          Meta
                        </div>
                      )}
                      {hasGoogle && metrics?.ok ? (
                        <MarketingChannelPanel
                          name="Google"
                          status={
                            channelSignals
                              ? channelSignals.google === "best"
                                ? "good"
                                : channelSignals.google === "attention"
                                  ? "bad"
                                  : "mid"
                              : "mid"
                          }
                          leads={aggG.conversions}
                          cpl={googleCplChannel}
                          spend={googleSpendAgg}
                          mixPct={
                            filteredSpend > 0 ? (googleSpendAgg / filteredSpend) * 100 : null
                          }
                        />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                          Google
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div>
                <CockpitSectionTitle kicker="Funil">Etapas</CockpitSectionTitle>
                <MarketingFunnelStrip steps={funnelStripSteps} worstKey={funnelWorstKey} />
              </div>
              <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-[var(--shadow-surface-sm)]">
                <CaptureTrendComposedChart
                  embedded
                  data={mergedChartData}
                  description=""
                  barHighlight={{
                    bestIndex: chartDayInsights.best?.index ?? null,
                    worstIndex: chartDayInsights.worst?.index ?? null,
                  }}
                  footer={null}
                />
              </div>
            </>
          )}

          {(metrics?.ok || metaMetrics?.ok) && (hasMeta || hasGoogle) && (
            <AnalyticsSection eyebrow="Operação" title="Central de controle" dense>
              {deepLoading ? (
                <p className="mb-3 text-xs font-semibold text-primary">Carregando nível ({osLevel})…</p>
              ) : null}
              {osRows.length > 0 ? (
                <MarketingCampaignsOsTable
                  rows={osRows}
                  goalMode={goalMode}
                  targetCplBrl={settings?.targetCpaBrl ?? null}
                  maxCplBrl={settings?.maxCpaBrl ?? null}
                  targetRoas={settings?.targetRoas ?? null}
                  periodDays={periodDays}
                  canMutateCampaigns={canMutateCampaigns}
                  mutatingAdsKey={mutatingAdsKey}
                  runMetaStatus={(id, s) => void runMetaStatus(id, s)}
                  runGoogleStatus={(id, s) => void runGoogleStatus(id, s)}
                  openBudgetDialog={openBudgetDialog}
                  onAfterMutation={() => void refreshAll()}
                  platform={osPlatform}
                  onPlatformChange={setOsPlatform}
                  level={osLevel}
                  onLevelChange={setOsLevel}
                  hasMeta={hasMeta}
                  hasGoogle={hasGoogle}
                />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma linha para este nível e período.
                </p>
              )}
            </AnalyticsSection>
          )}


          {hasGoogle &&
            !metrics?.ok &&
            !metricsError &&
            !metricsLoading &&
            hasMeta &&
            !metaMetrics?.ok &&
            !metaMetricsError &&
            !metaMetricsLoading && (
              <div className="rounded-xl border border-border/80 bg-card p-6">
                <p className="text-sm text-muted-foreground">
                  Nenhum dado no período. Altere o período ou confira as integrações.
                </p>
              </div>
            )}
        </div>
      )}

      <Dialog
        open={budgetDialogOpen}
        onOpenChange={(open) => {
          setBudgetDialogOpen(open);
          if (!open) setBudgetTarget(null);
        }}
      >
        <DialogContent title="Orçamento diário · Meta" showClose alignTop>
          {budgetTarget?.name ? (
            <p className="text-sm text-muted-foreground">Campanha: {budgetTarget.name}</p>
          ) : null}
          <div className="space-y-2 py-2">
            <Label htmlFor="meta-daily-budget">Valor diário (moeda da conta)</Label>
            <Input
              id="meta-daily-budget"
              inputMode="decimal"
              placeholder="Ex.: 120,50"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBudgetDialogOpen(false);
                setBudgetTarget(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={budgetSaving} onClick={() => void submitMetaBudget()}>
              {budgetSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppMainRouteBody>
  );
}
