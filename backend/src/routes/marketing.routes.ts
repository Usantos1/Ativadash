import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  getGoogleAdsMetricsHandler,
  getMetaAdsMetricsHandler,
  getMarketingSettingsHandler,
  putMarketingSettingsHandler,
  postMarketingInsightsHandler,
  postAtivaCrmTestHandler,
} from "../controllers/marketing.controller.js";

const router = Router();

router.get("/google-ads/metrics", authMiddleware, getGoogleAdsMetricsHandler);
router.get("/meta-ads/metrics", authMiddleware, getMetaAdsMetricsHandler);
router.get("/settings", authMiddleware, getMarketingSettingsHandler);
router.put("/settings", authMiddleware, putMarketingSettingsHandler);
router.post("/insights/evaluate", authMiddleware, postMarketingInsightsHandler);
router.post("/ativacrm/test-message", authMiddleware, postAtivaCrmTestHandler);

export default router;
