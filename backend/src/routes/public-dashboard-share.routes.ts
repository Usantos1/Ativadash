import { Router } from "express";
import {
  getPublicDashboardShareMetaHandler,
  getPublicDashboardShareSnapshotHandler,
} from "../controllers/dashboard-share.controller.js";

const router = Router();

router.get("/dashboard-share/:token", getPublicDashboardShareMetaHandler);
router.get("/dashboard-share/:token/snapshot", getPublicDashboardShareSnapshotHandler);

export default router;
