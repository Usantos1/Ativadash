import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import * as orgController from "../controllers/organizations.controller.js";

const router = Router();

router.use(authMiddleware);

router.get("/", orgController.getCurrentOrganization);
router.patch("/", orgController.patchCurrentOrganization);
router.get("/children/operations", orgController.listChildrenOperationsHandler);
router.get("/children/portfolio", orgController.listChildrenPortfolioHandler);
router.get("/children", orgController.listManagedOrganizations);
router.post("/children", orgController.createManagedOrganization);
router.patch("/children/:childId", orgController.patchChildOrganizationHandler);
router.patch("/plan-settings", orgController.patchOrganizationPlanSettingsHandler);

export default router;
