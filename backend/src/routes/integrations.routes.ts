import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  getGoogleAdsAuthUrlHandler,
  googleAdsCallbackHandler,
  listHandler,
  disconnectHandler,
} from "../controllers/integrations.controller.js";

const router = Router();

router.get("/", authMiddleware, listHandler);
router.delete("/:id", authMiddleware, disconnectHandler);

router.get("/google-ads/auth-url", authMiddleware, getGoogleAdsAuthUrlHandler);
router.get("/google-ads/callback", googleAdsCallbackHandler);

export default router;
