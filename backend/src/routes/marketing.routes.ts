import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { getGoogleAdsMetricsHandler } from "../controllers/marketing.controller.js";

const router = Router();

router.get("/google-ads/metrics", authMiddleware, getGoogleAdsMetricsHandler);

export default router;
