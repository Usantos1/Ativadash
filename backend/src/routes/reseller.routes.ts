import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import * as resellerController from "../controllers/reseller.controller.js";

const router = Router();

router.use(authMiddleware);

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

router.post("/children", resellerController.resellerCreateChildHandler);
router.get("/children/:childId/detail", resellerController.resellerChildDetailHandler);
router.patch("/children/:childId/governance", resellerController.resellerPatchGovernanceHandler);

router.patch("/ecosystem/users/:userId", resellerController.resellerPatchUserHandler);
router.post("/ecosystem/users/:userId/password", resellerController.resellerResetPasswordHandler);
router.post("/ecosystem/membership/role", resellerController.resellerMembershipRoleHandler);
router.post("/ecosystem/membership/remove", resellerController.resellerRemoveMemberHandler);
router.post("/ecosystem/membership/move", resellerController.resellerMoveMembershipHandler);

router.post("/enter-child", resellerController.resellerEnterChildHandler);

export default router;
