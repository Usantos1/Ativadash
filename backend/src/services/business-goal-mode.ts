import type { BusinessGoalMode as PrismaBusinessGoalMode } from "@prisma/client";

export type BusinessGoalMode = "LEADS" | "SALES" | "HYBRID";

export type DashboardModeConfig = {
  mode: BusinessGoalMode;
  /** Ordem dos 8 cards Meta no dashboard */
  metaKpiOrder: string[];
  /** Ordem dos 8 cards Google no dashboard */
  googleKpiOrder: string[];
  funnelVariant: "lead" | "sales" | "hybrid";
  showRevenueCards: boolean;
  showPurchaseCards: boolean;
  showLeadQualityCards: boolean;
  hybridInsightSplit: boolean;
  highlightFunnelTop: boolean;
  highlightFunnelBottom: boolean;
};

export type MarketingDashboardGoalContext = {
  businessGoalMode: BusinessGoalMode;
  primaryConversionLabel: string | null;
  showRevenueBlocksInLeadMode: boolean;
  dashboardModeConfig: DashboardModeConfig;
  flags: {
    isLeadWorkspace: boolean;
    isSalesWorkspace: boolean;
    isHybridWorkspace: boolean;
  };
};

export function prismaModeToApi(mode: PrismaBusinessGoalMode): BusinessGoalMode {
  return mode;
}

export function buildDashboardModeConfig(
  mode: BusinessGoalMode,
  showRevenueBlocksInLeadMode: boolean
): DashboardModeConfig {
  const isLead = mode === "LEADS";
  const isSales = mode === "SALES";
  const showRev = !isLead || showRevenueBlocksInLeadMode;

  const metaLead = ["spend", "impressions", "reach", "clicks", "leads", "cpl", "click_to_lead", "ctr"];
  const metaSales = [
    "spend",
    "purchases",
    "purchase_value",
    "roas",
    "cost_per_purchase",
    "checkout",
    "lead_to_purchase",
    "clicks",
  ];
  const metaHybrid = ["spend", "impressions", "clicks", "leads", "purchases", "roas", "cpl", "ctr"];

  const googleLead = ["spend", "impressions", "clicks", "conversions", "cost_per_conv", "ctr", "cpc", "conv_value"];
  const googleSales = ["spend", "conv_value", "conversions", "cost_per_conv", "impressions", "clicks", "ctr", "cpc"];
  const googleHybrid = ["spend", "impressions", "clicks", "conversions", "conv_value", "cost_per_conv", "ctr", "cpc"];

  return {
    mode,
    metaKpiOrder: isLead ? metaLead : isSales ? metaSales : metaHybrid,
    googleKpiOrder: isLead ? googleLead : isSales ? googleSales : googleHybrid,
    funnelVariant: isLead ? "lead" : isSales ? "sales" : "hybrid",
    showRevenueCards: showRev,
    showPurchaseCards: isSales || mode === "HYBRID",
    showLeadQualityCards: isLead || mode === "HYBRID",
    hybridInsightSplit: mode === "HYBRID",
    highlightFunnelTop: isLead || mode === "HYBRID",
    highlightFunnelBottom: isSales || mode === "HYBRID",
  };
}

export function buildGoalContextFromSettingsRow(row: {
  businessGoalMode: PrismaBusinessGoalMode;
  primaryConversionLabel: string | null;
  showRevenueBlocksInLeadMode: boolean;
}): MarketingDashboardGoalContext {
  const mode = prismaModeToApi(row.businessGoalMode);
  const primaryConversionLabel = row.primaryConversionLabel?.trim() || null;
  const dashboardModeConfig = buildDashboardModeConfig(mode, row.showRevenueBlocksInLeadMode);
  return {
    businessGoalMode: mode,
    primaryConversionLabel,
    showRevenueBlocksInLeadMode: row.showRevenueBlocksInLeadMode,
    dashboardModeConfig,
    flags: {
      isLeadWorkspace: mode === "LEADS",
      isSalesWorkspace: mode === "SALES",
      isHybridWorkspace: mode === "HYBRID",
    },
  };
}
