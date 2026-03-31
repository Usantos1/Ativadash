import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { differenceInDays, parseISO } from "date-fns";
import {
  BarChart3,
  CalendarRange,
  Loader2,
  RefreshCw,
  Share2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { IndeterminateLoadingBar } from "@/components/ui/indeterminate-loading-bar";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { MarketingDateRangeDialog } from "@/components/marketing/MarketingDateRangeDialog";
import { MarketingShareDialog } from "@/components/marketing/MarketingShareDialog";
import { CaptureTrendComposedChart } from "@/components/marketing/CaptureTrendComposedChart";
import {
  CockpitSectionTitle,
  MarketingChannelPanel,
  MarketingChannelPanelSales,
  MarketingFunnelStrip,
  type FunnelStripStep,
} from "@/components/marketing/MarketingCockpit";
import { MarketingCampaignsOsTable } from "@/components/marketing/MarketingCampaignsOsTable";
import { PageHeaderPremium, KpiCardPremium, DataTablePremium, StatusBadge, AnalyticsSection } from "@/components/premium";
import { formatNumber, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import { useMarketingFilteredAggregates } from "@/hooks/useMarketingFilteredAggregates";
import { buildCombinedCampaignOsRows } from "@/lib/ads-os-rows";
import { deriveChannelPerformanceSignals } from "@/lib/channel-performance-compare";
import {
  defaultMarketingGoalContext,
  goalContextFromSettingsDto,
} from "@/lib/business-goal-mode";
import { chartLeadExtrema, deriveAccountHealth } from "@/lib/marketing-strategic-insights";
import { useAuthStore } from "@/stores/auth-store";
import { fetchOrganizationContext, type OrganizationContext } from "@/lib/organization-api";
import {
  patchMarketingGoogleCampaignStatus,
  patchMarketingMetaCampaignBudget,
  patchMarketingMetaCampaignStatus,
} from "@/lib/marketing-contract-api";
import { canUserMutateMarketingAds } from "@/lib/marketing-ads-permissions";
import { isAgencyClientPortalUser } from "@/lib/navigation-mode";
import { fetchIntegrations, type IntegrationFromApi } from "@/lib/integrations-api";
import { isNonDefaultPeriod } from "@/lib/marketing-period-storage";
import type { DashboardSharePage } from "@/lib/dashboard-share-api";

export type FunnelVariant = "captacao" | "conversao" | "receita";

const CHECKOUT_SLUGS = new Set(["hotmart", "kiwify", "eduzz", "braip", "greenn"]);

type CampAgg = {
  channel: "Meta" | "Google";
  name: string;
  spend: number;
  impr: number;
  clicks: number;
  leads: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpl: number | null;
  convPct: number;
  roas: number | null;
};

const VARIANT_META: Record<FunnelVariant, { eyebrow: string; title: string; subtitle: string }> = {
  captacao: { eyebrow: "ADS", title: "Captação", subtitle: "Eficiência de tráfego." },
  conversao: { eyebrow: "ADS", title: "Conversão", subtitle: "Eficiência de conversão." },
  receita: { eyebrow: "ADS", title: "Receita", subtitle: "Monetização." },
};

function trafficChannelStatus(
  a: number | null,
  b: number | null
): { first: "good" | "mid" | "bad"; second: "good" | "mid" | "bad" } {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    return { first: "mid", second: "mid" };
  }
  const rel = Math.abs(a - b) / Math.max(a, b);
  if (rel < 0.05) return { first: "mid", second: "mid" };
  return a < b ? { first: "good", second: "bad" } : { first: "bad", second: "good" };
}

function ChannelTrafficPanel(props: {
  name: "Meta" | "Google";
  status: "good" | "mid" | "bad";
  spend: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  mixPct: number | null;
}) {
  const { name, status, spend, clicks, ctr, cpc, mixPct } = props;
  const ring =
    status === "good"
      ? "ring-2 ring-emerald-500/40"
      : status === "bad"
        ? "ring-2 ring-rose-500/45"
        : "ring-2 ring-amber-500/35";
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-card/80 p-4 backdrop-blur-sm", ring)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.15em] text-foreground">{name}</p>
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            status === "good" ? "bg-emerald-500" : status === "bad" ? "bg-rose-500" : "bg-amber-500"
          )}
        />
      </div>
      <p className="mt-3 text-3xl font-black tabular-nums text-foreground">{formatNumber(Math.round(clicks))}</p>
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">cliques</p>
      <div className="mt-3 flex items-end justify-between gap-2 border-t border-border/40 pt-3">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground">CPC</p>
          <p className="text-lg font-bold tabular-nums">{cpc != null && Number.isFinite(cpc) ? formatSpend(cpc) : "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-muted-foreground">Gasto</p>
          <p className="text-lg font-bold tabular-nums">{formatSpend(spend)}</p>
          {mixPct != null ? (
            <p className="text-[10px] font-semibold tabular-nums text-muted-foreground">{mixPct.toFixed(0)}% mix</p>
          ) : null}
          <p className="text-[10px] font-semibold tabular-nums text-muted-foreground">
            CTR {ctr != null ? `${ctr.toFixed(2)}%` : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function ScrollTable({ minWidth, children }: { minWidth: string; children: ReactNode }) {
  return (
    <ScrollRegion className="scrollbar-thin">
      <DataTablePremium zebra className={cn("text-[13px]", minWidth)}>
        {children}
      </DataTablePremium>
    </ScrollRegion>
  );
}

function RankBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-[var(--shadow-surface-sm)]">
      <p className="border-b border-border/40 bg-muted/20 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="p-2">{children}</div>
    </div>
  );
}

export function MarketingFunnelPage({ variant }: { variant: FunnelVariant }) {
  const navigate = useNavigate();
  const vm = VARIANT_META[variant];
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
    refreshAll,
    lastUpdated,
    settings,
    aggG,
    aggM,
    filteredSpend,
    mergedChartData,
    leadsReais,
    attributedRevenue,
    impressionsT,
    clicksT,
    ctrT,
    cpcT,
    cplLeads,
    googleCampaignsFiltered,
    metaCampaignsFiltered,
    dataHealthy,
    loadingAny,
  } = useMarketingFilteredAggregates();

  const user = useAuthStore((s) => s.user);
  const memberships = useAuthStore((s) => s.memberships);
  const [orgCtx, setOrgCtx] = useState<OrganizationContext | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [adsActionHint, setAdsActionHint] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [mutatingAdsKey, setMutatingAdsKey] = useState<string | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetTarget, setBudgetTarget] = useState<{ id: string; name: string } | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [integrationsList, setIntegrationsList] = useState<IntegrationFromApi[]>([]);

  useEffect(() => {
    if (variant !== "receita") return;
    let c = false;
    fetchIntegrations()
      .then((r) => {
        if (!c) setIntegrationsList(r.integrations);
      })
      .catch(() => {
        if (!c) setIntegrationsList([]);
      });
    return () => {
      c = true;
    };
  }, [variant]);

  const hasCheckoutConnected = useMemo(
    () =>
      integrationsList.some(
        (i) => i.slug != null && CHECKOUT_SLUGS.has(i.slug) && i.status === "connected"
      ),
    [integrationsList]
  );

  const membershipRole = useMemo(() => {
    if (!user?.organizationId) return null;
    return memberships?.find((m) => m.organizationId === user.organizationId)?.role ?? null;
  }, [user?.organizationId, memberships]);
  const isClientPortalUser = useMemo(
    () => isAgencyClientPortalUser(user, memberships ?? null),
    [user, memberships]
  );
  const canMutateAds = canUserMutateMarketingAds(membershipRole) && !isClientPortalUser;
  const planAllowsCampaignWrite = orgCtx?.enabledFeatures?.campaignWrite !== false;
  const canMutateCampaigns = canMutateAds && planAllowsCampaignWrite;

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

  const googleSpendAgg = aggG.costMicros / 1_000_000;
  const metaLeadishAgg = aggM.leads + aggM.messagingConversationsStarted;
  const metaCplChannel =
    aggM.spend > 0 && metaLeadishAgg > 0 ? aggM.spend / metaLeadishAgg : null;
  const metaRoasChannel =
    aggM.spend > 0 && aggM.purchaseValue > 0 ? aggM.purchaseValue / aggM.spend : null;
  const googleCplChannel =
    googleSpendAgg > 0 && aggG.conversions > 0 ? googleSpendAgg / aggG.conversions : null;
  const googleRoasChannel =
    googleSpendAgg > 0 && (aggG.conversionsValue ?? 0) > 0
      ? (aggG.conversionsValue ?? 0) / googleSpendAgg
      : null;

  const metaCtr = aggM.impressions > 0 ? (aggM.clicks / aggM.impressions) * 100 : null;
  const googleCtr = aggG.impressions > 0 ? (aggG.clicks / aggG.impressions) * 100 : null;
  const metaCpcCh = aggM.clicks > 0 ? aggM.spend / aggM.clicks : null;
  const googleCpcCh = aggG.clicks > 0 ? googleSpendAgg / aggG.clicks : null;

  const trafficSig = useMemo(() => trafficChannelStatus(metaCpcCh, googleCpcCh), [metaCpcCh, googleCpcCh]);

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

  const roasBlend =
    filteredSpend > 0 && attributedRevenue > 0 ? attributedRevenue / filteredSpend : null;
  const cpaTrafego = leadsReais > 0 ? filteredSpend / leadsReais : 0;
  const totalPurchases = aggM.purchases + aggG.conversions;
  const ticketMedio =
    totalPurchases > 0 && attributedRevenue > 0 ? attributedRevenue / totalPurchases : null;
  const cpaCompra =
    totalPurchases > 0 && filteredSpend > 0 ? filteredSpend / totalPurchases : null;
  const convRatePct = clicksT > 0 ? (leadsReais / clicksT) * 100 : null;

  const accountHealth = useMemo(
    () =>
      deriveAccountHealth({
        mode: goalMode,
        filteredSpend,
        leadsReais,
        roasBlend,
        blendCpl: cpaTrafego,
        ctrT,
        targetCpa: settings?.targetCpaBrl ?? null,
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
      settings?.targetCpaBrl,
      settings?.maxCpaBrl,
      settings?.targetRoas,
    ]
  );

  const healthLabel =
    accountHealth === "healthy" ? "OK" : accountHealth === "attention" ? "Atenção" : "Crítico";

  const campaignRows: CampAgg[] = useMemo(() => {
    const out: CampAgg[] = [];
    for (const r of metaCampaignsFiltered) {
      const leads = r.leads + (r.messagingConversationsStarted ?? 0);
      const impr = r.impressions;
      const clicks = r.clicks;
      const spend = r.spend;
      const revenue = r.purchaseValue ?? 0;
      out.push({
        channel: "Meta",
        name: r.campaignName,
        spend,
        impr,
        clicks,
        leads,
        revenue,
        ctr: impr > 0 ? (clicks / impr) * 100 : 0,
        cpc: clicks > 0 ? spend / clicks : Number.POSITIVE_INFINITY,
        cpl: leads > 0 ? spend / leads : null,
        convPct: clicks > 0 ? (leads / clicks) * 100 : 0,
        roas: spend > 0 && revenue > 0 ? revenue / spend : null,
      });
    }
    for (const r of googleCampaignsFiltered) {
      const spend = r.costMicros / 1_000_000;
      const leads = r.conversions;
      const impr = r.impressions;
      const clicks = r.clicks;
      const revenue = r.conversionsValue ?? 0;
      out.push({
        channel: "Google",
        name: r.campaignName,
        spend,
        impr,
        clicks,
        leads,
        revenue,
        ctr: impr > 0 ? (clicks / impr) * 100 : 0,
        cpc: clicks > 0 ? spend / clicks : Number.POSITIVE_INFINITY,
        cpl: leads > 0 ? spend / leads : null,
        convPct: clicks > 0 ? (leads / clicks) * 100 : 0,
        roas: spend > 0 && revenue > 0 ? revenue / spend : null,
      });
    }
    return out;
  }, [metaCampaignsFiltered, googleCampaignsFiltered]);

  const rankCtr = useMemo(
    () =>
      [...campaignRows]
        .filter((r) => r.impr >= 300 && Number.isFinite(r.ctr))
        .sort((a, b) => b.ctr - a.ctr)
        .slice(0, 8),
    [campaignRows]
  );
  const rankCpcGood = useMemo(
    () =>
      [...campaignRows]
        .filter((r) => r.clicks >= 20 && Number.isFinite(r.cpc) && r.cpc < Number.POSITIVE_INFINITY)
        .sort((a, b) => a.cpc - b.cpc)
        .slice(0, 8),
    [campaignRows]
  );
  const rankCpcBad = useMemo(
    () =>
      [...campaignRows]
        .filter((r) => r.clicks >= 20 && Number.isFinite(r.cpc) && r.cpc < Number.POSITIVE_INFINITY)
        .sort((a, b) => b.cpc - a.cpc)
        .slice(0, 8),
    [campaignRows]
  );
  const rankClickVol = useMemo(
    () => [...campaignRows].filter((r) => r.clicks > 0).sort((a, b) => b.clicks - a.clicks).slice(0, 8),
    [campaignRows]
  );

  const rankConv = useMemo(
    () =>
      [...campaignRows]
        .filter((r) => r.clicks >= 30)
        .sort((a, b) => b.convPct - a.convPct)
        .slice(0, 8),
    [campaignRows]
  );
  const rankCplWorst = useMemo(
    () =>
      [...campaignRows]
        .filter((r) => r.leads > 0 && r.cpl != null)
        .sort((a, b) => (b.cpl ?? 0) - (a.cpl ?? 0))
        .slice(0, 8),
    [campaignRows]
  );
  const rankClickWaste = useMemo(
    () =>
      [...campaignRows]
        .filter((r) => r.leads === 0 && r.clicks >= 30)
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 8),
    [campaignRows]
  );

  const rankRevenue = useMemo(
    () => [...campaignRows].filter((r) => r.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    [campaignRows]
  );
  const rankRoasWorst = useMemo(
    () =>
      [...campaignRows]
        .filter((r) => r.spend > 0 && r.revenue > 0 && r.roas != null)
        .sort((a, b) => (a.roas ?? 0) - (b.roas ?? 0))
        .slice(0, 8),
    [campaignRows]
  );

  const funnelStripSteps: FunnelStripStep[] = useMemo(() => {
    const lpv = aggM.landingPageViews;
    const lpvPerClick = clicksT > 0 ? (lpv / clicksT) * 100 : null;
    const leadPerClick = clicksT > 0 ? (leadsReais / clicksT) * 100 : null;
    return [
      { key: "impr", title: "Impressões", volume: impressionsT, ratePct: null },
      { key: "clk", title: "Cliques", volume: clicksT, ratePct: ctrT },
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

  const chartDayInsights = useMemo(() => chartLeadExtrema(mergedChartData), [mergedChartData]);

  const osRows = useMemo(
    () => buildCombinedCampaignOsRows(metaCampaignsFiltered, googleCampaignsFiltered),
    [metaCampaignsFiltered, googleCampaignsFiltered]
  );

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

  const sharePage: DashboardSharePage =
    variant === "captacao" ? "captacao" : variant === "conversao" ? "conversao" : "receita";

  const hasData = metrics?.ok || metaMetrics?.ok;
  const leadLabel = settings?.primaryConversionLabel?.trim() || "Leads";

  const kpiLoading = loadingAny && !hasData;

  return (
    <div className="w-full space-y-5">
      <PageHeaderPremium
        eyebrow={vm.eyebrow}
        title={vm.title}
        subtitle={vm.subtitle}
        meta={
          <>
            {lastUpdated ? (
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{dateRangeLabel}</span>
                {" · "}
                {lastUpdated.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">{dateRangeLabel}</span>
            )}
            {hasGoogle || hasMeta ? (
              <StatusBadge tone={dataHealthy && !loadingAny ? "healthy" : "alert"} dot>
                {loadingAny ? "…" : dataHealthy ? healthLabel : "Integrações"}
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
                {!isClientPortalUser ? (
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
                ) : null}
                {!isClientPortalUser ? (
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
                ) : null}
                {!isClientPortalUser ? (
                  <MarketingShareDialog
                    open={shareOpen}
                    onOpenChange={setShareOpen}
                    page={sharePage}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    periodLabel={dateRangeLabel}
                  />
                ) : null}
                {!isClientPortalUser ? (
                  <Button variant="default" size="sm" className="h-9 rounded-lg shadow-sm" asChild>
                    <Link to="/marketing/configuracoes">Metas e alertas</Link>
                  </Button>
                ) : null}
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
          Plano sem edição de campanhas nas redes.
        </div>
      ) : null}

      {(hasGoogle || hasMeta) && loadingAny && (
        <div className="rounded-xl border border-primary/25 bg-primary/[0.07] px-4 py-3 shadow-[var(--shadow-surface-sm)]">
          <IndeterminateLoadingBar label="Carregando métricas…" />
        </div>
      )}

      {!hasGoogle && !hasMeta ? (
        <EmptyState
          icon={BarChart3}
          title="Sem integrações"
          description={
            isClientPortalUser
              ? "Os dados de mídia ainda não estão disponíveis para esta conta."
              : "Conecte Google ou Meta nas Integrações."
          }
          actionLabel={isClientPortalUser ? undefined : "Integrações"}
          onAction={isClientPortalUser ? undefined : () => navigate("/marketing/integracoes")}
          className="min-h-[280px]"
        />
      ) : hasData ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {variant === "captacao" && (
              <>
                <KpiCardPremium variant="primary" label="Investimento" value={formatSpend(filteredSpend)} hideSource loading={kpiLoading} />
                <KpiCardPremium variant="secondary" label="Impressões" value={formatNumber(Math.round(impressionsT))} hideSource loading={kpiLoading} />
                <KpiCardPremium variant="secondary" label="Cliques" value={formatNumber(Math.round(clicksT))} hideSource loading={kpiLoading} />
                <KpiCardPremium
                  variant="secondary"
                  label="CTR"
                  value={ctrT != null ? `${ctrT.toFixed(2)}%` : "—"}
                  hideSource
                  loading={kpiLoading}
                />
                <KpiCardPremium
                  variant="secondary"
                  label="CPC"
                  value={cpcT != null ? formatSpend(cpcT) : "—"}
                  hideSource
                  loading={kpiLoading}
                />
              </>
            )}
            {variant === "conversao" && (
              <>
                <KpiCardPremium variant="primary" label={leadLabel} value={formatNumber(Math.round(leadsReais))} hideSource loading={kpiLoading} />
                <KpiCardPremium
                  variant="secondary"
                  label="CPL"
                  value={cplLeads != null ? formatSpend(cplLeads) : "—"}
                  hideSource
                  loading={kpiLoading}
                />
                <KpiCardPremium
                  variant="secondary"
                  label="Taxa conv."
                  value={convRatePct != null ? `${convRatePct.toFixed(2)}%` : "—"}
                  hideSource
                  loading={kpiLoading}
                />
                <KpiCardPremium
                  variant="secondary"
                  label="LPV"
                  value={formatNumber(Math.round(aggM.landingPageViews))}
                  hideSource
                  loading={kpiLoading}
                />
                <KpiCardPremium variant="secondary" label="Investimento" value={formatSpend(filteredSpend)} hideSource loading={kpiLoading} />
              </>
            )}
            {variant === "receita" && (
              <>
                <KpiCardPremium
                  variant="primary"
                  label="Receita"
                  value={attributedRevenue > 0 ? formatSpend(attributedRevenue) : "—"}
                  hideSource
                  loading={kpiLoading}
                />
                <KpiCardPremium
                  variant="secondary"
                  label="ROAS"
                  value={roasBlend != null ? `${roasBlend.toFixed(2)}x` : "—"}
                  hideSource
                  loading={kpiLoading}
                />
                <KpiCardPremium
                  variant="secondary"
                  label="Ticket médio"
                  value={ticketMedio != null ? formatSpend(ticketMedio) : "—"}
                  hideSource
                  loading={kpiLoading}
                />
                <KpiCardPremium
                  variant="secondary"
                  label="CPA"
                  value={cpaCompra != null ? formatSpend(cpaCompra) : "—"}
                  hideSource
                  loading={kpiLoading}
                />
                <KpiCardPremium variant="secondary" label="Investimento" value={formatSpend(filteredSpend)} hideSource loading={kpiLoading} />
              </>
            )}
          </div>

          {variant === "receita" && attributedRevenue <= 0 ? (
            <div
              className={cn(
                "rounded-2xl border px-5 py-6",
                hasCheckoutConnected
                  ? "border-border/60 bg-muted/15"
                  : "border-amber-500/30 bg-gradient-to-br from-amber-500/[0.07] to-transparent"
              )}
            >
              {!hasCheckoutConnected ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-800 dark:text-amber-200">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <h3 className="text-base font-bold tracking-tight text-foreground">
                      Receita de checkout ainda não conectada
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Os valores desta página vêm das conversões das redes (Meta / Google). Para ver vendas de Hotmart,
                      Kiwify e outras plataformas aqui, conecte o checkout quando a integração estiver disponível em{" "}
                      <span className="font-medium text-foreground">Integrações · Pagamentos e checkout</span>.
                    </p>
                    <Button className="mt-2 w-fit rounded-xl" asChild>
                      <Link to="/marketing/integracoes#integracoes-checkout">Ir para checkout</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="neutral" dot>
                      Sem receita no período
                    </StatusBadge>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    A integração de checkout está ativa, mas não há receita atribuída neste intervalo de datas. Ajuste o
                    período ou confira se os eventos estão chegando corretamente.
                  </p>
                  <Button variant="outline" size="sm" className="rounded-xl" asChild>
                    <Link to="/marketing/integracoes#integracoes-checkout">Revisar integrações</Link>
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          <div>
            <CockpitSectionTitle kicker="Canais">Meta · Google</CockpitSectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {variant === "captacao" && (
                <>
                  {hasMeta && metaMetrics?.ok ? (
                    <ChannelTrafficPanel
                      name="Meta"
                      status={hasGoogle ? trafficSig.first : "mid"}
                      spend={aggM.spend}
                      clicks={aggM.clicks}
                      ctr={metaCtr}
                      cpc={metaCpcCh}
                      mixPct={filteredSpend > 0 ? (aggM.spend / filteredSpend) * 100 : null}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">Meta</div>
                  )}
                  {hasGoogle && metrics?.ok ? (
                    <ChannelTrafficPanel
                      name="Google"
                      status={hasMeta ? trafficSig.second : "mid"}
                      spend={googleSpendAgg}
                      clicks={aggG.clicks}
                      ctr={googleCtr}
                      cpc={googleCpcCh}
                      mixPct={filteredSpend > 0 ? (googleSpendAgg / filteredSpend) * 100 : null}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">Google</div>
                  )}
                </>
              )}
              {variant === "conversao" && (
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
                      mixPct={filteredSpend > 0 ? (aggM.spend / filteredSpend) * 100 : null}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">Meta</div>
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
                      mixPct={filteredSpend > 0 ? (googleSpendAgg / filteredSpend) * 100 : null}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">Google</div>
                  )}
                </>
              )}
              {variant === "receita" && (
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
                      mixPct={filteredSpend > 0 ? (aggM.spend / filteredSpend) * 100 : null}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">Meta</div>
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
                      mixPct={filteredSpend > 0 ? (googleSpendAgg / filteredSpend) * 100 : null}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">Google</div>
                  )}
                </>
              )}
            </div>
          </div>

          {variant === "conversao" ? (
            <div>
              <CockpitSectionTitle kicker="Funil">Etapas</CockpitSectionTitle>
              <MarketingFunnelStrip steps={funnelStripSteps} worstKey={funnelWorstKey} />
            </div>
          ) : null}

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

          {!isClientPortalUser ? (
            <div
              className={cn(
                "grid gap-3",
                variant === "captacao" ? "lg:grid-cols-2 xl:grid-cols-4" : "lg:grid-cols-3"
              )}
            >
              {variant === "captacao" && (
                <>
                  <RankBlock title="Melhor CTR">
                  <ScrollTable minWidth="min-w-[360px]">
                    <thead>
                      <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="pb-2 pr-2">Campanha</th>
                        <th className="pb-2 pr-2 text-right">CTR</th>
                        <th className="pb-2 text-right">Cliques</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankCtr.map((r, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="max-w-[200px] truncate py-2 pr-2 text-sm" title={r.name}>
                            <span className="mr-1 text-[10px] text-muted-foreground">{r.channel}</span>
                            {r.name}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">{r.ctr.toFixed(2)}%</td>
                          <td className="py-2 text-right tabular-nums">{formatNumber(r.clicks)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </ScrollTable>
                </RankBlock>
                <RankBlock title="Melhor CPC">
                  <ScrollTable minWidth="min-w-[360px]">
                    <thead>
                      <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="pb-2 pr-2">Campanha</th>
                        <th className="pb-2 pr-2 text-right">CPC</th>
                        <th className="pb-2 text-right">Cliques</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankCpcGood.map((r, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="max-w-[200px] truncate py-2 pr-2 text-sm" title={r.name}>
                            <span className="mr-1 text-[10px] text-muted-foreground">{r.channel}</span>
                            {r.name}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">{formatSpend(r.cpc)}</td>
                          <td className="py-2 text-right tabular-nums">{formatNumber(r.clicks)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </ScrollTable>
                </RankBlock>
                <RankBlock title="Pior CPC · tráfego">
                  <ScrollTable minWidth="min-w-[360px]">
                    <thead>
                      <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="pb-2 pr-2">Campanha</th>
                        <th className="pb-2 pr-2 text-right">CPC</th>
                        <th className="pb-2 text-right">Cliques</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankCpcBad.map((r, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="max-w-[200px] truncate py-2 pr-2 text-sm" title={r.name}>
                            <span className="mr-1 text-[10px] text-muted-foreground">{r.channel}</span>
                            {r.name}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">{formatSpend(r.cpc)}</td>
                          <td className="py-2 text-right tabular-nums">{formatNumber(r.clicks)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </ScrollTable>
                </RankBlock>
                <RankBlock title="Volume de clique">
                  <ScrollTable minWidth="min-w-[360px]">
                    <thead>
                      <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="pb-2 pr-2">Campanha</th>
                        <th className="pb-2 text-right">Cliques</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankClickVol.map((r, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="max-w-[200px] truncate py-2 pr-2 text-sm" title={r.name}>
                            <span className="mr-1 text-[10px] text-muted-foreground">{r.channel}</span>
                            {r.name}
                          </td>
                          <td className="py-2 text-right tabular-nums">{formatNumber(r.clicks)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </ScrollTable>
                </RankBlock>
              </>
            )}
            {variant === "conversao" && (
              <>
                <RankBlock title="Maior taxa de conversão">
                  <ScrollTable minWidth="min-w-[400px]">
                    <thead>
                      <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="pb-2 pr-2">Campanha</th>
                        <th className="pb-2 pr-2 text-right">Conv.</th>
                        <th className="pb-2 text-right">{leadLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankConv.map((r, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="max-w-[200px] truncate py-2 pr-2 text-sm" title={r.name}>
                            <span className="mr-1 text-[10px] text-muted-foreground">{r.channel}</span>
                            {r.name}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">{r.convPct.toFixed(2)}%</td>
                          <td className="py-2 text-right tabular-nums">{formatNumber(r.leads)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </ScrollTable>
                </RankBlock>
                <RankBlock title="Piores CPL">
                  <ScrollTable minWidth="min-w-[400px]">
                    <thead>
                      <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="pb-2 pr-2">Campanha</th>
                        <th className="pb-2 pr-2 text-right">CPL</th>
                        <th className="pb-2 text-right">{leadLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankCplWorst.map((r, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="max-w-[200px] truncate py-2 pr-2 text-sm" title={r.name}>
                            <span className="mr-1 text-[10px] text-muted-foreground">{r.channel}</span>
                            {r.name}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">{r.cpl != null ? formatSpend(r.cpl) : "—"}</td>
                          <td className="py-2 text-right tabular-nums">{formatNumber(r.leads)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </ScrollTable>
                </RankBlock>
                <RankBlock title="Desperdício de clique">
                  <ScrollTable minWidth="min-w-[400px]">
                    <thead>
                      <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="pb-2 pr-2">Campanha</th>
                        <th className="pb-2 text-right">Cliques · 0 {leadLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankClickWaste.map((r, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="max-w-[200px] truncate py-2 pr-2 text-sm" title={r.name}>
                            <span className="mr-1 text-[10px] text-muted-foreground">{r.channel}</span>
                            {r.name}
                          </td>
                          <td className="py-2 text-right tabular-nums">{formatNumber(r.clicks)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </ScrollTable>
                </RankBlock>
              </>
            )}
            {variant === "receita" && (
              <>
                <RankBlock title="Maior receita">
                  <ScrollTable minWidth="min-w-[380px]">
                    <thead>
                      <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="pb-2 pr-2">Campanha</th>
                        <th className="pb-2 pr-2 text-right">Receita</th>
                        <th className="pb-2 text-right">Gasto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankRevenue.map((r, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="max-w-[200px] truncate py-2 pr-2 text-sm" title={r.name}>
                            <span className="mr-1 text-[10px] text-muted-foreground">{r.channel}</span>
                            {r.name}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">{formatSpend(r.revenue)}</td>
                          <td className="py-2 text-right tabular-nums">{formatSpend(r.spend)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </ScrollTable>
                </RankBlock>
                <RankBlock title="Pior ROAS">
                  <ScrollTable minWidth="min-w-[380px]">
                    <thead>
                      <tr className="border-b text-left text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="pb-2 pr-2">Campanha</th>
                        <th className="pb-2 pr-2 text-right">ROAS</th>
                        <th className="pb-2 text-right">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankRoasWorst.map((r, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="max-w-[200px] truncate py-2 pr-2 text-sm" title={r.name}>
                            <span className="mr-1 text-[10px] text-muted-foreground">{r.channel}</span>
                            {r.name}
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">{r.roas != null ? `${r.roas.toFixed(2)}x` : "—"}</td>
                          <td className="py-2 text-right tabular-nums">{formatSpend(r.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </ScrollTable>
                </RankBlock>
                </>
              )}
            </div>
          ) : null}

          {!isClientPortalUser ? (
            <AnalyticsSection eyebrow="Operação" title="Central de controle" dense>
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
                  combinedCampaignMode
                  hasMeta={hasMeta}
                  hasGoogle={hasGoogle}
                />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem linhas no período.</p>
              )}
            </AnalyticsSection>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-border/80 bg-card p-6">
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
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
          {budgetTarget?.name ? <p className="text-sm text-muted-foreground">{budgetTarget.name}</p> : null}
          <div className="space-y-2 py-2">
            <Label htmlFor="funnel-meta-budget">Valor diário</Label>
            <Input
              id="funnel-meta-budget"
              inputMode="decimal"
              placeholder="Ex.: 120,50"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBudgetDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={budgetSaving} onClick={() => void submitMetaBudget()}>
              {budgetSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
