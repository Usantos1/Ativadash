import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireJwtOrganizationAccess } from "../middlewares/organization-context.middleware.js";
import * as resellerController from "../controllers/reseller.controller.js";

const router = Router();

router.use(authMiddleware, requireJwtOrganizationAccess);

router.get("/overview", resellerController.resellerOverview);
router.get("/operational-health", resellerController.resellerOperationalHealth);
router.get("/plans", resellerController.resellerPlans);
router.get("/plans/catalog", resellerController.resellerPlansCatalog);
router.post("/plans", resellerController.resellerPlansCreateHandler);
router.patch("/plans/:planId", resellerController.resellerPlansUpdateHandler);
router.delete("/plans/:planId", resellerController.resellerPlansDeleteHandler);
router.post("/plans/duplicate", resellerController.resellerPlansDuplicateHandler);

router.get("/ecosystem/organizations", resellerController.resellerEcosystemOrganizations);
router.get("/ecosystem/users", resellerController.resellerEcosystemUsers);
router.post("/ecosystem/users", resellerController.resellerCreateUserHandler);
router.post("/ecosystem/invitations", resellerController.resellerCreateInvitationHandler);
router.get("/audit", resellerController.resellerAuditHandler);
router.get("/network-activity", resellerController.resellerNetworkActivityHandler);

router.post("/children", resellerController.resellerCreateChildHandler);
router.post("/children/:childId/detach", resellerController.resellerDetachChildHandler);
router.get("/children/:childId/detail", resellerController.resellerChildDetailHandler);
router.patch("/children/:childId/governance", resellerController.resellerPatchGovernanceHandler);
router.delete("/children/:childId", resellerController.resellerDeleteChildHandler);

router.patch("/ecosystem/users/:userId", resellerController.resellerPatchUserHandler);
router.post("/ecosystem/users/:userId/password", resellerController.resellerResetPasswordHandler);
router.post("/ecosystem/membership/role", resellerController.resellerMembershipRoleHandler);
router.post("/ecosystem/membership/remove", resellerController.resellerRemoveMemberHandler);
router.post("/ecosystem/membership/move", resellerController.resellerMoveMembershipHandler);

router.post("/enter-child", resellerController.resellerEnterChildHandler);

router.get("/grants/matrix-workspace", resellerController.resellerMatrixGrantsListHandler);
router.post("/grants/matrix-workspace", resellerController.resellerMatrixGrantsUpsertHandler);
router.delete("/grants/matrix-workspace/:grantId", resellerController.resellerMatrixGrantsDeleteHandler);

export default router;
