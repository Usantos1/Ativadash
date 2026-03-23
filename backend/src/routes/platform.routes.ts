import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { platformAdminMiddleware } from "../middlewares/platform-admin.middleware.js";
import * as platform from "../controllers/platform.controller.js";

const router = Router();

router.use(authMiddleware);
router.use(platformAdminMiddleware);

router.get("/plans", platform.plansList);
router.post("/plans", platform.plansCreate);
router.patch("/plans/:id", platform.plansUpdate);
router.delete("/plans/:id", platform.plansDelete);

router.get("/organizations", platform.organizationsList);
router.post("/organizations", platform.organizationCreate);
router.patch("/organizations/:organizationId/plan", platform.organizationAssignPlan);
router.get("/organizations/:organizationId/limits-override", platform.organizationOverrideGet);
router.put("/organizations/:organizationId/limits-override", platform.organizationOverridePut);
router.patch("/organizations/:organizationId/subscription", platform.organizationSubscriptionPatch);
router.patch("/organizations/:organizationId", platform.organizationPatch);
router.delete("/organizations/:organizationId", platform.organizationDelete);

router.get("/subscriptions", platform.subscriptionsList);
router.post("/maintenance/sync-subscriptions", platform.maintenanceSyncSubscriptions);

export default router;
