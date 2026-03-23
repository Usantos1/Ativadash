import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  getGoogleAdsMetricsHandler,
  getMetaAdsMetricsHandler,
  getMarketingDashboardHandler,
  getMarketingDashboardSummaryHandler,
  getMarketingDashboardTimeseriesHandler,
  getMarketingDashboardPerformanceHandler,
  getMarketingDashboardIntegrationHandler,
  getMarketingSettingsHandler,
  putMarketingSettingsHandler,
  postMarketingInsightsHandler,
  postAtivaCrmTestHandler,
  getMetaAdsetsHandler,
  getMetaAdsLevelHandler,
  getMetaDemographicsHandler,
  postMetaCampaignStatusHandler,
  getGoogleAdGroupsHandler,
  getGoogleSearchTermsHandler,
  postGoogleCampaignMutateStubHandler,
  postMetricsSnapshotHandler,
  getMetricsSnapshotLatestHandler,
} from "../controllers/marketing.controller.js";

const router = Router();

router.get("/google-ads/metrics", authMiddleware, getGoogleAdsMetricsHandler);
router.get("/google-ads/ad-groups", authMiddleware, getGoogleAdGroupsHandler);
router.get("/google-ads/search-terms", authMiddleware, getGoogleSearchTermsHandler);
router.post("/google-ads/campaign-mutate-stub", authMiddleware, postGoogleCampaignMutateStubHandler);

router.get("/meta-ads/metrics", authMiddleware, getMetaAdsMetricsHandler);
router.get("/dashboard/summary", authMiddleware, getMarketingDashboardSummaryHandler);
router.get("/dashboard/timeseries", authMiddleware, getMarketingDashboardTimeseriesHandler);
router.get("/dashboard/performance", authMiddleware, getMarketingDashboardPerformanceHandler);
router.get("/dashboard/integration-status", authMiddleware, getMarketingDashboardIntegrationHandler);
router.get("/dashboard", authMiddleware, getMarketingDashboardHandler);
router.get("/meta-ads/adsets", authMiddleware, getMetaAdsetsHandler);
router.get("/meta-ads/ads", authMiddleware, getMetaAdsLevelHandler);
router.get("/meta-ads/demographics", authMiddleware, getMetaDemographicsHandler);
router.post("/meta-ads/campaigns/:campaignId/status", authMiddleware, postMetaCampaignStatusHandler);

router.get("/settings", authMiddleware, getMarketingSettingsHandler);
router.put("/settings", authMiddleware, putMarketingSettingsHandler);
router.post("/insights/evaluate", authMiddleware, postMarketingInsightsHandler);
router.post("/ativacrm/test-message", authMiddleware, postAtivaCrmTestHandler);

router.post("/metrics-snapshot", authMiddleware, postMetricsSnapshotHandler);
router.get("/metrics-snapshot/latest", authMiddleware, getMetricsSnapshotLatestHandler);

export default router;
