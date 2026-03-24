import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  RefreshCw,
  Share2,
  Clock,
  CalendarRange,
  Pencil,
  Pause,
  Play,
  Wallet,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarketingDateRangeDialog } from "@/components/marketing/MarketingDateRangeDialog";
import { IndeterminateLoadingBar } from "@/components/ui/indeterminate-loading-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollRegion } from "@/components/ui/scroll-region";
import {
  PageHeaderPremium,
  FilterBarPremium,
  DataTablePremium,
  StatusBadge,
  AnalyticsSection,
} from "@/components/premium";
import { CaptureTrendComposedChart } from "@/components/marketing/CaptureTrendComposedChart";
import {
  CockpitSectionTitle,
  MarketingActionQueue,
  MarketingChannelPanel,
  MarketingChannelPanelSales,
  MarketingCockpitStatus,
  MarketingEfficiencyChips,
  MarketingFunnelStrip,
  type FunnelStripStep,
} from "@/components/marketing/MarketingCockpit";
import { formatNumber, formatSpend } from "@/lib/metrics-format";
import { cn } from "@/lib/utils";
import type { GoogleAdsCampaignRow, MetaAdsCampaignRow } from "@/lib/integrations-api";
import { useMarketingMetrics } from "@/hooks/useMarketingMetrics";
import { fetchLaunches, type LaunchRow } from "@/lib/workspace-api";
import { fetchMarketingSettings, type MarketingSettingsDto } from "@/lib/marketing-settings-api";
import { fetchOrganizationContext, type OrganizationContext } from "@/lib/organization-api";
import {
  defaultMarketingGoalContext,
  goalContextFromSettingsDto,
  type AccountObjective,
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
  type TempFilter,
  aggregateGoogle,
  aggregateMeta,
  buildMergedDailyChart,
  computeScaleFactor,
  filterGoogleCampaigns,
  filterMetaCampaigns,
} from "@/lib/marketing-capture-aggregate";
import {
  campaignEfficiencyTonesSorted,
  chartLeadExtrema,
  deriveAccountHealth,
  diagnoseConversionFunnel,
  type CampaignEfficiencyTone,
} from "@/lib/marketing-strategic-insights";

type UnifiedCampaignRow = {
  channel: "Google" | "Meta";
  campaignName: string;
  externalId?: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  sales: number;
  revenue: number;
};

/** Volume “principal” por campanha conforme objetivo (evita misturar lead Meta com compra). */
function campaignPrimaryVolume(row: UnifiedCampaignRow, mode: AccountObjective): number {
  if (mode === "SALES" && row.channel === "Meta") return row.sales;
  return row.leads;
}

function sortUnifiedCampaignSlice(
  rows: UnifiedCampaignRow[],
  sort: "spend" | "revenue" | "leads",
  goalMode: AccountObjective
): UnifiedCampaignRow[] {
  const copy = [...rows];
  if (sort === "spend") copy.sort((a, b) => b.spend - a.spend);
  else if (sort === "revenue") copy.sort((a, b) => b.revenue - a.revenue || b.spend - a.spend);
  else
    copy.sort((a, b) => {
      const va = campaignPrimaryVolume(a, goalMode);
      const vb = campaignPrimaryVolume(b, goalMode);
      return vb - va || b.spend - a.spend;
    });
  return copy;
}

type CockpitCampaignsTableProps = {
  rows: UnifiedCampaignRow[];
  tones: CampaignEfficiencyTone[];
  goalMode: AccountObjective;
  canMutateCampaigns: boolean;
  mutatingAdsKey: string | null;
  runMetaStatus: (id: string, next: "PAUSED" | "ACTIVE") => void;
  runGoogleStatus: (id: string, next: "PAUSED" | "ENABLED") => void;
  openBudgetDialog: (id: string, name: string) => void;
};

function CockpitCampaignsTable({
  rows,
  tones,
  goalMode,
  canMutateCampaigns,
  mutatingAdsKey,
  runMetaStatus,
  runGoogleStatus,
  openBudgetDialog,
}: CockpitCampaignsTableProps) {
  return (
    <ScrollRegion className="scrollbar-thin">
      <DataTablePremium className="min-w-[820px] text-[13px]">
        <thead>
          <tr>
            <th className="w-10 text-center" aria-label="Status" />
            <th className="sticky left-0 z-30 min-w-[200px] max-w-[280px] bg-card text-left shadow-[4px_0_12px_-8px_rgba(0,0,0,0.2)]">
              Campanha
            </th>
            <th className="text-right">Investimento</th>
            <th className="text-right">Impr.</th>
            <th className="text-right">Cliques</th>
            <th className="text-right">CTR</th>
            <th className="text-right">CPC</th>
            <th className="text-right">
              {goalMode === "SALES" ? "Compras / conv." : "Leads / conv."}
            </th>
            {goalMode === "HYBRID" ? <th className="text-right">Vendas</th> : null}
            {goalMode === "LEADS" ? (
              <th className="text-right">CPA</th>
            ) : (
              <>
                <th className="text-right">Receita</th>
                <th className="text-right">CPA</th>
                <th className="text-right">ROAS</th>
              </>
            )}
            {canMutateCampaigns ? <th className="text-right">Ações</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : null;
            const cpc = row.clicks > 0 ? row.spend / row.clicks : null;
            const primaryVol = campaignPrimaryVolume(row, goalMode);
            const volumeDisplay = goalMode === "HYBRID" ? row.leads : primaryVol;
            const cpa =
              goalMode === "LEADS"
                ? row.leads > 0
                  ? row.spend / row.leads
                  : null
                : goalMode === "SALES"
                  ? primaryVol > 0
                    ? row.spend / primaryVol
                    : null
                  : row.leads + row.sales > 0
                    ? row.spend / (row.leads + row.sales)
                    : null;
            const roasRow = row.spend > 0 && row.revenue > 0 ? row.revenue / row.spend : null;
            const ext = row.externalId;
            const gBusy = ext && mutatingAdsKey?.startsWith(`google:${ext}:`);
            const mBusy = ext && mutatingAdsKey?.startsWith(`meta:${ext}:`);
            const effTone = tones[i] ?? "neutral";
            const rowTint =
              effTone === "bad"
                ? "bg-rose-500/[0.07]"
                : effTone === "good"
                  ? "bg-emerald-500/[0.07]"
                  : "";
            const stickyBg = rowTint || "bg-card";
            const rowKey = `${row.channel}-${row.externalId ?? row.campaignName}-${i}`;
            return (
              <tr key={rowKey} className={cn("border-b border-border/40", rowTint)}>
                <td className="px-1 text-center align-middle">
                  <span
                    className={cn(
                      "mx-auto block h-2.5 w-2.5 rounded-full",
                      effTone === "bad" && "bg-rose-500 shadow-[0_0_0_2px_rgba(244,63,94,0.25)]",
                      effTone === "good" && "bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]",
                      effTone === "neutral" && "bg-amber-400/90"
                    )}
                    title={effTone === "good" ? "Performance forte" : effTone === "bad" ? "Atenção" : "Neutro"}
                  />
                </td>
                <td
                  className={cn(
                    "sticky left-0 z-20 min-w-[200px] max-w-[280px] truncate py-2 font-medium text-foreground shadow-[4px_0_12px_-8px_rgba(0,0,0,0.15)]",
                    stickyBg
                  )}
                  title={row.campaignName}
                >
                  {row.campaignName || "—"}
                </td>
                <td className="text-right tabular-nums font-medium">{formatSpend(row.spend)}</td>
                <td className="text-right tabular-nums text-muted-foreground">
                  {formatNumber(row.impressions)}
                </td>
                <td className="text-right tabular-nums text-muted-foreground">
                  {formatNumber(row.clicks)}
                </td>
                <td className="text-right tabular-nums">{ctr != null ? `${ctr.toFixed(2)}%` : "—"}</td>
                <td className="text-right tabular-nums">{cpc != null ? formatSpend(cpc) : "—"}</td>
                <td className="text-right tabular-nums">{formatNumber(volumeDisplay)}</td>
                {goalMode === "HYBRID" ? (
                  <td className="text-right tabular-nums">{formatNumber(row.sales)}</td>
                ) : null}
                {goalMode === "LEADS" ? (
                  <td className="text-right tabular-nums">{cpa != null ? formatSpend(cpa) : "—"}</td>
                ) : (
                  <>
                    <td className="text-right tabular-nums">{formatSpend(row.revenue)}</td>
                    <td className="text-right tabular-nums">{cpa != null ? formatSpend(cpa) : "—"}</td>
                    <td className="text-right tabular-nums font-medium">
                      {roasRow != null ? `${roasRow.toFixed(2)}x` : "—"}
                    </td>
                  </>
                )}
                {canMutateCampaigns ? (
                  <td className="text-right">
                    {row.channel === "Meta" && ext ? (
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Pausar (Meta)"
                          disabled={!!mBusy}
                          onClick={() => void runMetaStatus(ext, "PAUSED")}
                        >
                          {mBusy && mutatingAdsKey === `meta:${ext}:PAUSED` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pause className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Ativar (Meta)"
                          disabled={!!mBusy}
                          onClick={() => void runMetaStatus(ext, "ACTIVE")}
                        >
                          {mBusy && mutatingAdsKey === `meta:${ext}:ACTIVE` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Orçamento diário"
                          disabled={!!mBusy}
                          onClick={() => openBudgetDialog(ext, row.campaignName)}
                        >
                          <Wallet className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : row.channel === "Google" && ext ? (
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Pausar (Google)"
                          disabled={!!gBusy}
                          onClick={() => void runGoogleStatus(ext, "PAUSED")}
                        >
                          {gBusy && mutatingAdsKey === `google:${ext}:PAUSED` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pause className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Ativar (Google)"
                          disabled={!!gBusy}
                          onClick={() => void runGoogleStatus(ext, "ENABLED")}
                        >
                          {gBusy && mutatingAdsKey === `google:${ext}:ENABLED` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </DataTablePremium>
    </ScrollRegion>
  );
}

export function Marketing() {
  const navigate = useNavigate();
  const {
    dateRange,
    dateRangeLabel,
    presetId,
    compareEnabled,
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

  const [launches, setLaunches] = useState<LaunchRow[]>([]);
  const [launchId, setLaunchId] = useState<string>("all");
  const [tempFilter, setTempFilter] = useState<TempFilter>("geral");
  const [settings, setSettings] = useState<MarketingSettingsDto | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [adsActionHint, setAdsActionHint] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [mutatingAdsKey, setMutatingAdsKey] = useState<string | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetTarget, setBudgetTarget] = useState<{ id: string; name: string } | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [orgCtx, setOrgCtx] = useState<OrganizationContext | null>(null);
  const [campaignSort, setCampaignSort] = useState<"spend" | "revenue" | "leads">("spend");
  const campaignSortInitRef = useRef(false);

  const membershipRole = useMemo(() => {
    if (!user?.organizationId) return null;
    return memberships?.find((m) => m.organizationId === user.organizationId)?.role ?? null;
  }, [user?.organizationId, memberships]);
  const canMutateAds = canUserMutateMarketingAds(membershipRole);
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

  useEffect(() => {
    let c = false;
    fetchLaunches()
      .then((list) => {
        if (!c) setLaunches(list);
      })
      .catch(() => {
        if (!c) setLaunches([]);
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

  useEffect(() => {
    if (!settings || campaignSortInitRef.current) return;
    campaignSortInitRef.current = true;
    const m = settings.businessGoalMode;
    if (m === "LEADS") setCampaignSort("leads");
    else if (m === "SALES") setCampaignSort("revenue");
    else setCampaignSort("spend");
  }, [settings]);

  const selectedLaunch = useMemo(
    () => (launchId === "all" ? null : launches.find((l) => l.id === launchId) ?? null),
    [launches, launchId]
  );
  const launchNameForFilter = selectedLaunch?.name ?? null;

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
    return filterGoogleCampaigns(metrics.campaigns, launchNameForFilter, tempFilter);
  }, [metrics, launchNameForFilter, tempFilter]);

  const metaCampaignsFiltered = useMemo(() => {
    if (!metaMetrics?.ok) return [];
    return filterMetaCampaigns(metaMetrics.campaigns, launchNameForFilter, tempFilter);
  }, [metaMetrics, launchNameForFilter, tempFilter]);

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
  const leadToSalePct = aggM.leads > 0 ? (aggM.purchases / aggM.leads) * 100 : null;

  const goalCtx = useMemo(() => {
    if (!settings) return defaultMarketingGoalContext();
    return goalContextFromSettingsDto(settings);
  }, [settings]);
  const goalMode = goalCtx.businessGoalMode;

  const unifiedCampaignRows = useMemo(() => {
    const gRows: GoogleAdsCampaignRow[] = metrics?.ok ? googleCampaignsFiltered : [];
    const mRows: MetaAdsCampaignRow[] = metaMetrics?.ok ? metaCampaignsFiltered : [];
    const out: UnifiedCampaignRow[] = [];
    for (const r of gRows) {
      out.push({
        channel: "Google",
        campaignName: r.campaignName,
        externalId: r.campaignId,
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
        externalId: r.campaignId,
        spend: r.spend,
        impressions: r.impressions,
        clicks: r.clicks,
        leads: r.leads,
        sales: r.purchases ?? 0,
        revenue: r.purchaseValue ?? 0,
      });
    }
    return out;
  }, [metrics?.ok, metaMetrics?.ok, googleCampaignsFiltered, metaCampaignsFiltered]);

  const sortedMetaCampaignRows = useMemo(() => {
    const meta = unifiedCampaignRows.filter((r) => r.channel === "Meta");
    return sortUnifiedCampaignSlice(meta, campaignSort, goalMode);
  }, [unifiedCampaignRows, campaignSort, goalMode]);

  const sortedGoogleCampaignRows = useMemo(() => {
    const google = unifiedCampaignRows.filter((r) => r.channel === "Google");
    return sortUnifiedCampaignSlice(google, campaignSort, goalMode);
  }, [unifiedCampaignRows, campaignSort, goalMode]);

  const metaCampaignEfficiencyTones = useMemo(
    () =>
      campaignEfficiencyTonesSorted(
        goalMode,
        sortedMetaCampaignRows.map((r) => ({
          spend: r.spend,
          leads: r.leads,
          sales: r.sales,
          revenue: r.revenue,
        }))
      ),
    [goalMode, sortedMetaCampaignRows]
  );

  const googleCampaignEfficiencyTones = useMemo(
    () =>
      campaignEfficiencyTonesSorted(
        goalMode,
        sortedGoogleCampaignRows.map((r) => ({
          spend: r.spend,
          leads: r.leads,
          sales: r.sales,
          revenue: r.revenue,
        }))
      ),
    [goalMode, sortedGoogleCampaignRows]
  );

  const cpaTrafego = leadsReais > 0 ? filteredSpend / leadsReais : 0;
  const surveyRatePct = clicksT > 0 ? (leadsReais / clicksT) * 100 : null;

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

  const funnelDiagnosis = useMemo(
    () =>
      diagnoseConversionFunnel({
        goalMode,
        ctrT,
        surveyRatePct,
        leadToSalePct,
        aggMLeads: aggM.leads,
      }),
    [goalMode, ctrT, surveyRatePct, leadToSalePct, aggM.leads]
  );

  const chartDayInsights = useMemo(() => chartLeadExtrema(mergedChartData), [mergedChartData]);

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

  const cpmT = impressionsT > 0 ? (filteredSpend / impressionsT) * 1_000 : null;
  const cpcT = clicksT > 0 ? filteredSpend / clicksT : null;

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
    const steps: FunnelStripStep[] = [
      { key: "imp_click", title: "Impressões", volume: impressionsT, ratePct: ctrT },
      { key: "click_lead", title: "Cliques", volume: clicksT, ratePct: surveyRatePct },
    ];
    if (funnelDiagnosis.steps.some((s) => s.key === "lead_sale")) {
      steps.push({
        key: "lead_sale",
        title: "Lead → compra",
        volume: Math.max(0, aggM.leads),
        ratePct: leadToSalePct,
      });
    }
    return steps;
  }, [impressionsT, clicksT, ctrT, surveyRatePct, funnelDiagnosis.steps, aggM.leads, leadToSalePct]);

  const dataHealthy =
    (hasGoogle && metrics?.ok && !metricsError) || (hasMeta && metaMetrics?.ok && !metaMetricsError);
  const loadingAny = metricsLoading || metaMetricsLoading;

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShareHint("Link copiado.");
    } catch {
      setShareHint("Não foi possível copiar.");
    }
    setTimeout(() => setShareHint(null), 2500);
  }, []);

  const tempBtn = (id: TempFilter, label: string) => (
    <Button
      type="button"
      size="sm"
      variant={tempFilter === id ? "default" : "outline"}
      className={cn("h-8 rounded-md px-3 text-xs font-medium", tempFilter !== id && "border-border/80 bg-background")}
      onClick={() => setTempFilter(id)}
    >
      {label}
    </Button>
  );

  const dataSourceLabel =
    hasMeta && hasGoogle ? "Meta + Google Ads" : hasMeta ? "Meta Ads" : hasGoogle ? "Google Ads" : "—";

  return (
    <div className="w-full space-y-6">
      <PageHeaderPremium
        eyebrow="Mídia paga"
        title="Performance de mídia"
        subtitle="Período único nas redes. Status, fila de ações e campanhas no mesmo lugar."
        meta={
          <>
            {lastUpdated ? (
              <span>
                Última sincronização:{" "}
                <span className="font-medium text-foreground">
                  {lastUpdated.toLocaleDateString("pt-BR")} ·{" "}
                  {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
            ) : null}
            {compareEnabled ? (
              <span className="rounded-md border border-primary/20 bg-primary/[0.08] px-2 py-0.5 text-[11px] font-semibold text-primary">
                Comparando com período anterior
              </span>
            ) : null}
            <span>
              Fonte: <span className="font-medium text-foreground">{dataSourceLabel}</span>
            </span>
            {hasGoogle || hasMeta ? (
              <StatusBadge tone={dataHealthy && !loadingAny ? "healthy" : "alert"} dot>
                {loadingAny ? "Sincronizando" : dataHealthy ? "Dados disponíveis" : "Checar integrações"}
              </StatusBadge>
            ) : null}
          </>
        }
        actions={
          hasGoogle || hasMeta ? (
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex flex-wrap items-center justify-end gap-2">
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
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg border-border/70 bg-background/80 shadow-sm"
                  type="button"
                  onClick={() => navigate("/lancamentos")}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Lançamentos
                </Button>
                <Button
                  size="sm"
                  className="h-9 rounded-lg shadow-sm"
                  variant="secondary"
                  type="button"
                  onClick={handleShare}
                >
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  Compartilhar
                </Button>
                <Button variant="default" size="sm" className="h-9 rounded-lg shadow-sm" asChild>
                  <Link to="/marketing/configuracoes">Metas e alertas</Link>
                </Button>
              </div>
              {shareHint ? <span className="text-right text-xs text-muted-foreground">{shareHint}</span> : null}
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

      <FilterBarPremium
        sticky
        label="Contexto e período"
        footer={
          launchId !== "all" && selectedLaunch ? (
            <>Lançamento: nomes de campanha devem refletir “{selectedLaunch.name}”.</>
          ) : undefined
        }
      >
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 max-w-full items-center gap-2 sm:max-w-[min(100%,380px)]">
              <Select value={launchId} onValueChange={setLaunchId}>
                <SelectTrigger className="h-9 min-w-0 flex-1 rounded-lg border-border/70 bg-background text-sm shadow-sm">
                  <SelectValue placeholder="Lançamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os lançamentos</SelectItem>
                  {launches.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} · {l.project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {launchId !== "all" && selectedLaunch ? (
                <StatusBadge tone={dataHealthy && !loadingAny ? "connected" : "alert"} dot>
                  {dataHealthy && !loadingAny ? "Contexto OK" : "Aguardando"}
                </StatusBadge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/55 bg-muted/30 p-1 shadow-inner">
              {tempBtn("geral", "Geral")}
              {tempBtn("frio", "Frio")}
              {tempBtn("quente", "Quente")}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 max-w-full justify-start gap-2 rounded-lg border-border/70 bg-background shadow-sm sm:max-w-[300px]"
              onClick={() => setPickerOpen(true)}
            >
              <CalendarRange className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="truncate text-left font-medium">{dateRangeLabel}</span>
            </Button>
            <MarketingDateRangeDialog
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              initial={dateRange}
              initialLabel={dateRangeLabel}
              initialPresetId={presetId}
              initialCompare={compareEnabled}
              onApply={applyDateFilter}
            />
          </div>
          {!(hasGoogle || hasMeta) ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              Conecte integrações para liberar métricas nesta página.
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Comparação: calendário.</span>
          )}
        </div>
      </FilterBarPremium>

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
              <div>
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
              <MarketingEfficiencyChips ctr={ctrT} cpc={cpcT} cpm={cpmT} />
              <div>
                <CockpitSectionTitle kicker="Funil">Etapas</CockpitSectionTitle>
                <MarketingFunnelStrip
                  steps={funnelStripSteps}
                  worstKey={funnelDiagnosis.bottleneckKey}
                />
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

          {(metrics?.ok || metaMetrics?.ok) && unifiedCampaignRows.length > 0 && (
            <>
              <div className="mb-3 flex flex-col gap-2 rounded-xl border border-border/60 bg-gradient-to-r from-muted/40 to-background px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-foreground">
                  <span className="tabular-nums text-lg font-bold">{sortedMetaCampaignRows.length}</span>
                  <span className="text-muted-foreground"> Meta · </span>
                  <span className="tabular-nums text-lg font-bold">{sortedGoogleCampaignRows.length}</span>
                  <span className="text-muted-foreground"> Google</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">Ordenar:</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={campaignSort === "spend" ? "default" : "outline"}
                    className="h-8 rounded-md px-3 text-xs"
                    onClick={() => setCampaignSort("spend")}
                  >
                    Investimento
                  </Button>
                  {goalMode !== "LEADS" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={campaignSort === "revenue" ? "default" : "outline"}
                      className="h-8 rounded-md px-3 text-xs"
                      onClick={() => setCampaignSort("revenue")}
                    >
                      Receita
                    </Button>
                  ) : null}
                  {goalMode !== "SALES" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={campaignSort === "leads" ? "default" : "outline"}
                      className="h-8 rounded-md px-3 text-xs"
                      onClick={() => setCampaignSort("leads")}
                    >
                      Leads / conv.
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant={campaignSort === "leads" ? "default" : "outline"}
                      className="h-8 rounded-md px-3 text-xs"
                      onClick={() => setCampaignSort("leads")}
                    >
                      Compras / conv.
                    </Button>
                  )}
                  <Link
                    to="/marketing/integracoes"
                    className="font-semibold text-primary underline-offset-4 hover:underline sm:ml-1"
                  >
                    Integrações
                  </Link>
                </div>
              </div>
              {sortedMetaCampaignRows.length > 0 ? (
                <AnalyticsSection title="Meta — campanhas" dense>
                  <CockpitCampaignsTable
                    rows={sortedMetaCampaignRows}
                    tones={metaCampaignEfficiencyTones}
                    goalMode={goalMode}
                    canMutateCampaigns={canMutateCampaigns}
                    mutatingAdsKey={mutatingAdsKey}
                    runMetaStatus={runMetaStatus}
                    runGoogleStatus={runGoogleStatus}
                    openBudgetDialog={openBudgetDialog}
                  />
                </AnalyticsSection>
              ) : null}
              {sortedGoogleCampaignRows.length > 0 ? (
                <AnalyticsSection title="Google — campanhas" dense>
                  <CockpitCampaignsTable
                    rows={sortedGoogleCampaignRows}
                    tones={googleCampaignEfficiencyTones}
                    goalMode={goalMode}
                    canMutateCampaigns={canMutateCampaigns}
                    mutatingAdsKey={mutatingAdsKey}
                    runMetaStatus={runMetaStatus}
                    runGoogleStatus={runGoogleStatus}
                    openBudgetDialog={openBudgetDialog}
                  />
                </AnalyticsSection>
              ) : null}
            </>
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
    </div>
  );
}
