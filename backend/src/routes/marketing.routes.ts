import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { getGoogleAdsMetricsHandler, getMetaAdsMetricsHandler } from "../controllers/marketing.controller.js";

const router = Router();

router.get("/google-ads/metrics", authMiddleware, getGoogleAdsMetricsHandler);
router.get("/meta-ads/metrics", authMiddleware, getMetaAdsMetricsHandler);

export default router;
