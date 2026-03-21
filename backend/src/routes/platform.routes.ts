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
router.patch("/organizations/:organizationId/plan", platform.organizationAssignPlan);

export default router;
