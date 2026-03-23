import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireJwtOrganizationAccess } from "../middlewares/organization-context.middleware.js";
import * as workspace from "../controllers/workspace.controller.js";

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
router.patch("/members/:userId", workspace.membersPatchRole);
router.delete("/members/:userId", workspace.membersRemove);

router.post("/invitations", workspace.invitationsCreate);
router.get("/invitations", workspace.invitationsList);
router.delete("/invitations/:id", workspace.invitationsRevoke);

export default router;
