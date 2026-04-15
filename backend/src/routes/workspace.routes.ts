import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireJwtOrganizationAccess } from "../middlewares/organization-context.middleware.js";
import * as workspace from "../controllers/workspace.controller.js";
import * as webhooks from "../controllers/webhooks.controller.js";
import * as checkout from "../controllers/checkout.controller.js";
import * as auditLog from "../controllers/audit-log.controller.js";

const router = Router();

router.use(authMiddleware, requireJwtOrganizationAccess);

router.get("/clients", workspace.clientsList);
router.post("/clients", workspace.clientsCreate);
router.patch("/clients/:id", workspace.clientsUpdate);
router.delete("/clients/:id", workspace.clientsDelete);

router.get("/projects", workspace.projectsList);
router.post("/projects", workspace.projectsCreate);
router.patch("/projects/:id", workspace.projectsUpdate);
router.delete("/projects/:id", workspace.projectsDelete);

router.get("/launches", workspace.launchesList);
router.post("/launches", workspace.launchesCreate);
router.patch("/launches/:id", workspace.launchesUpdate);
router.delete("/launches/:id", workspace.launchesDelete);

router.get("/goals", workspace.goalsList);

router.get("/members", workspace.membersList);
router.post("/members", workspace.membersCreate);
router.patch("/members/:userId", workspace.membersPatch);
router.post("/members/:userId/password", workspace.membersResetPassword);
router.delete("/members/:userId", workspace.membersRemove);

router.post("/invitations", workspace.invitationsCreate);
router.get("/invitations", workspace.invitationsList);
router.delete("/invitations/:id", workspace.invitationsRevoke);

router.get("/webhooks/endpoints", webhooks.webhooksEndpointsList);
router.post("/webhooks/endpoints", webhooks.webhooksEndpointsCreate);
router.patch("/webhooks/endpoints/:id", webhooks.webhooksEndpointsPatch);
router.get("/webhooks/events", webhooks.webhooksEventsList);
router.post("/webhooks/events/:id/replay", webhooks.webhooksEventsReplay);

router.get("/checkout-events", checkout.checkoutEventsList);
router.get("/checkout-events/summary", checkout.checkoutRevenueSummary);
router.get("/checkout-events/by-campaign", checkout.checkoutRevenueByCampaign);
router.get("/checkout-product-mappings", checkout.checkoutMappingsList);
router.post("/checkout-product-mappings", checkout.checkoutMappingsUpsert);
router.delete("/checkout-product-mappings/:id", checkout.checkoutMappingsDelete);

router.get("/audit-logs", auditLog.auditLogsList);

export default router;
