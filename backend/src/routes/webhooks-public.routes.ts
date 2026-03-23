import { Router } from "express";
import * as ctrl from "../controllers/webhooks-public.controller.js";

const router = Router();

router.post("/w/:publicSlug", ctrl.postPublicWebhook);

export default router;
