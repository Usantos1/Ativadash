/**
 * Objetivo principal da conta (MarketingSettings) — espelha regras do backend `business-goal-mode.ts`.
 */

export type BusinessGoalMode = "LEADS" | "SALES" | "HYBRID";

/** Alias de domínio — espelha o objetivo da conta (ex.: settings / goalContext no painel). */
export type AccountObjective = BusinessGoalMode;

export type DashboardModeConfig = {
  mode: BusinessGoalMode;
  metaKpiOrder: string[];
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

export function defaultMarketingGoalContext(): MarketingDashboardGoalContext {
  const dashboardModeConfig = buildDashboardModeConfig("HYBRID", false);
  return {
    businessGoalMode: "HYBRID",
    primaryConversionLabel: null,
    showRevenueBlocksInLeadMode: false,
    dashboardModeConfig,
    flags: {
      isLeadWorkspace: false,
      isSalesWorkspace: false,
      isHybridWorkspace: true,
    },
  };
}

export function goalContextFromSettingsDto(dto: {
  businessGoalMode: BusinessGoalMode;
  primaryConversionLabel: string | null;
  showRevenueBlocksInLeadMode: boolean;
}): MarketingDashboardGoalContext {
  const dashboardModeConfig = buildDashboardModeConfig(
    dto.businessGoalMode,
    dto.showRevenueBlocksInLeadMode
  );
  return {
    businessGoalMode: dto.businessGoalMode,
    primaryConversionLabel: dto.primaryConversionLabel?.trim() || null,
    showRevenueBlocksInLeadMode: dto.showRevenueBlocksInLeadMode,
    dashboardModeConfig,
    flags: {
      isLeadWorkspace: dto.businessGoalMode === "LEADS",
      isSalesWorkspace: dto.businessGoalMode === "SALES",
      isHybridWorkspace: dto.businessGoalMode === "HYBRID",
    },
  };
}
