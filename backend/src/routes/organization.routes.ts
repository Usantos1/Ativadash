import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireJwtOrganizationAccess } from "../middlewares/organization-context.middleware.js";
import * as orgController from "../controllers/organizations.controller.js";

const router = Router();

router.use(authMiddleware, requireJwtOrganizationAccess);

router.get("/", orgController.getCurrentOrganization);
router.patch("/", orgController.patchCurrentOrganization);
router.get("/children/operations", orgController.listChildrenOperationsHandler);
router.get("/children/portfolio", orgController.listChildrenPortfolioHandler);
router.get("/children", orgController.listManagedOrganizations);
router.post("/children", orgController.createManagedOrganization);
router.patch("/children/:childId", orgController.patchChildOrganizationHandler);
router.post("/children/:childId/members/assign", orgController.assignChildWorkspaceMemberHandler);
router.post("/children/:childId/members/agency-exclude", orgController.excludeAgencyMemberFromChildHandler);
router.delete(
  "/children/:childId/members/agency-exclude/:userId",
  orgController.restoreAgencyMemberOnChildHandler
);
router.patch("/plan-settings", orgController.patchOrganizationPlanSettingsHandler);

export default router;
