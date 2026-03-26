import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireJwtOrganizationAccess } from "../middlewares/organization-context.middleware.js";
import * as integrations from "../controllers/integrations.controller.js";

const router = Router();

const authCtx = [authMiddleware, requireJwtOrganizationAccess] as const;

router.get("/", ...authCtx, integrations.listHandler);
router.patch("/:id/client", ...authCtx, integrations.patchIntegrationClientHandler);
router.delete("/:id", ...authCtx, integrations.disconnectHandler);

router.get("/google-ads/setup", ...authCtx, integrations.getGoogleAdsSetupHandler);
router.post("/google-ads/sync-accessible", ...authCtx, integrations.postGoogleAdsSyncAccessibleHandler);
router.patch(
  "/google-ads/:integrationId/default-customer",
  ...authCtx,
  integrations.patchGoogleAdsDefaultCustomerHandler
);
router.put(
  "/google-ads/:integrationId/assignments/:clientAccountId",
  ...authCtx,
  integrations.putGoogleAdsClientAssignmentHandler
);
router.delete(
  "/google-ads/:integrationId/assignments/:clientAccountId",
  ...authCtx,
  integrations.deleteGoogleAdsClientAssignmentHandler
);

router.get("/google-ads/auth-url", ...authCtx, integrations.getGoogleAdsAuthUrlHandler);
router.get("/google-ads/callback", integrations.googleAdsCallbackHandler);

router.get("/meta-ads/auth-url", ...authCtx, integrations.getMetaAdsAuthUrlHandler);
router.get("/meta-ads/callback", integrations.metaAdsCallbackHandler);
router.get("/meta-ads/setup", ...authCtx, integrations.getMetaAdsSetupHandler);
router.patch(
  "/meta-ads/:integrationId/default-ad-account",
  ...authCtx,
  integrations.patchMetaAdsDefaultAdAccountHandler
);
router.put(
  "/meta-ads/:integrationId/assignments/:clientAccountId",
  ...authCtx,
  integrations.putMetaAdsClientAssignmentHandler
);
router.delete(
  "/meta-ads/:integrationId/assignments/:clientAccountId",
  ...authCtx,
  integrations.deleteMetaAdsClientAssignmentHandler
);

export default router;
