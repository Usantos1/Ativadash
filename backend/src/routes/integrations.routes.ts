import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  getGoogleAdsAuthUrlHandler,
  googleAdsCallbackHandler,
  getMetaAdsAuthUrlHandler,
  metaAdsCallbackHandler,
  listHandler,
  disconnectHandler,
} from "../controllers/integrations.controller.js";

const router = Router();

router.get("/", authMiddleware, listHandler);
router.delete("/:id", authMiddleware, disconnectHandler);

router.get("/google-ads/auth-url", authMiddleware, getGoogleAdsAuthUrlHandler);
router.get("/google-ads/callback", googleAdsCallbackHandler);

router.get("/meta-ads/auth-url", authMiddleware, getMetaAdsAuthUrlHandler);
router.get("/meta-ads/callback", metaAdsCallbackHandler);

export default router;
