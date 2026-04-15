import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireJwtOrganizationAccess } from "../middlewares/organization-context.middleware.js";
import * as ctrl from "../controllers/impersonation.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/start", requireJwtOrganizationAccess, ctrl.impersonationStart);
router.post("/stop", ctrl.impersonationStop);
router.get("/me", ctrl.impersonationMe);

export default router;
