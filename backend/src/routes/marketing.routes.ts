import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireJwtOrganizationAccess } from "../middlewares/organization-context.middleware.js";
import {
  getGoogleAdsMetricsHandler,
  getMetaAdsMetricsHandler,
  getMarketingDashboardHandler,
  getMarketingDashboardSummaryHandler,
  getMarketingDashboardTimeseriesHandler,
  getMarketingDashboardPerformanceHandler,
  getMarketingDashboardIntegrationHandler,
  getMarketingSummaryContractHandler,
  getMarketingTimeseriesContractHandler,
  getMarketingFunnelContractHandler,
  getMarketingDetailCampaignsHandler,
  getMarketingAlertsInsightHandler,
  getMarketingSettingsHandler,
  putMarketingSettingsHandler,
  postMarketingInsightsHandler,
  postAtivaCrmTestHandler,
  getMetaAdsetsHandler,
  getMetaAdsLevelHandler,
  getMetaDemographicsHandler,
  postMetaCampaignStatusHandler,
  patchMetaCampaignStatusContractHandler,
  patchMetaCampaignBudgetContractHandler,
  patchGoogleCampaignStatusContractHandler,
  getGoogleAdGroupsHandler,
  getGoogleSearchTermsHandler,
  postGoogleCampaignMutateStubHandler,
  postMetricsSnapshotHandler,
  getMetricsSnapshotLatestHandler,
} from "../controllers/marketing.controller.js";

const router = Router();

const authCtx = [authMiddleware, requireJwtOrganizationAccess] as const;

router.get("/summary", ...authCtx, getMarketingSummaryContractHandler);
router.get("/timeseries", ...authCtx, getMarketingTimeseriesContractHandler);
router.get("/funnel", ...authCtx, getMarketingFunnelContractHandler);
router.get("/detail/campaigns", ...authCtx, getMarketingDetailCampaignsHandler);
router.get("/alerts/insight", ...authCtx, getMarketingAlertsInsightHandler);

router.get("/google-ads/metrics", ...authCtx, getGoogleAdsMetricsHandler);
router.get("/google-ads/ad-groups", ...authCtx, getGoogleAdGroupsHandler);
router.get("/google-ads/search-terms", ...authCtx, getGoogleSearchTermsHandler);
router.post("/google-ads/campaign-mutate-stub", ...authCtx, postGoogleCampaignMutateStubHandler);

router.get("/meta-ads/metrics", ...authCtx, getMetaAdsMetricsHandler);
router.get("/dashboard/summary", ...authCtx, getMarketingDashboardSummaryHandler);
router.get("/dashboard/timeseries", ...authCtx, getMarketingDashboardTimeseriesHandler);
router.get("/dashboard/performance", ...authCtx, getMarketingDashboardPerformanceHandler);
router.get("/dashboard/integration-status", ...authCtx, getMarketingDashboardIntegrationHandler);
router.get("/dashboard", ...authCtx, getMarketingDashboardHandler);
router.get("/meta-ads/adsets", ...authCtx, getMetaAdsetsHandler);
router.get("/meta-ads/ads", ...authCtx, getMetaAdsLevelHandler);
router.get("/meta-ads/demographics", ...authCtx, getMetaDemographicsHandler);
router.post("/meta-ads/campaigns/:campaignId/status", ...authCtx, postMetaCampaignStatusHandler);
router.patch("/meta/campaigns/:externalId/status", ...authCtx, patchMetaCampaignStatusContractHandler);
router.patch("/meta/campaigns/:externalId/budget", ...authCtx, patchMetaCampaignBudgetContractHandler);
router.patch("/google/campaigns/:externalId/status", ...authCtx, patchGoogleCampaignStatusContractHandler);

router.get("/settings", ...authCtx, getMarketingSettingsHandler);
router.put("/settings", ...authCtx, putMarketingSettingsHandler);
router.post("/insights/evaluate", ...authCtx, postMarketingInsightsHandler);
router.post("/ativacrm/test-message", ...authCtx, postAtivaCrmTestHandler);

router.post("/metrics-snapshot", ...authCtx, postMetricsSnapshotHandler);
router.get("/metrics-snapshot/latest", ...authCtx, getMetricsSnapshotLatestHandler);

export default router;
