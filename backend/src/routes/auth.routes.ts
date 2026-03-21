import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/login", authController.login);
router.post("/register", authController.register);
router.post("/forgot-password", authController.forgotPassword);
router.post("/refresh", authController.refresh);
router.get("/me", authMiddleware, authController.me);
router.post("/switch-organization", authMiddleware, authController.switchOrganization);
router.patch("/profile", authMiddleware, authController.patchProfile);

export default router;
