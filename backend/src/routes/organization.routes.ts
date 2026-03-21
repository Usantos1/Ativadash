import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import * as orgController from "../controllers/organizations.controller.js";

const router = Router();

router.use(authMiddleware);

router.get("/", orgController.getCurrentOrganization);
router.patch("/", orgController.patchCurrentOrganization);
router.get("/children", orgController.listManagedOrganizations);
router.post("/children", orgController.createManagedOrganization);

export default router;
