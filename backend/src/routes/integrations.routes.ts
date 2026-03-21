import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import * as integrations from "../controllers/integrations.controller.js";

const router = Router();

router.get("/", authMiddleware, integrations.listHandler);
router.patch("/:id/client", authMiddleware, integrations.patchIntegrationClientHandler);
router.delete("/:id", authMiddleware, integrations.disconnectHandler);

router.get("/google-ads/auth-url", authMiddleware, integrations.getGoogleAdsAuthUrlHandler);
router.get("/google-ads/callback", integrations.googleAdsCallbackHandler);

router.get("/meta-ads/auth-url", authMiddleware, integrations.getMetaAdsAuthUrlHandler);
router.get("/meta-ads/callback", integrations.metaAdsCallbackHandler);

export default router;
