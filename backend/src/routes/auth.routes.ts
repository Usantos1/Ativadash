import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/auth.controller.js";
import { env } from "../config/env.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireJwtOrganizationAccess } from "../middlewares/organization-context.middleware.js";

const router = Router();

/** Protege força bruta em senha; logins com sucesso (2xx) não incrementam o contador. */
const loginLimiter = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_LOGIN_RATE_LIMIT_MAX,
  message: { message: "Muitas tentativas de login. Aguarde alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  skipSuccessfulRequests: true,
});

const sensitiveLimiter = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  max: 20,
  message: { message: "Muitas tentativas. Aguarde alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

router.post("/login", loginLimiter, authController.login);
router.post("/register", sensitiveLimiter, authController.register);
router.get("/invite-preview", authController.invitePreview);
router.post("/register-with-invite", sensitiveLimiter, authController.registerWithInvite);
router.post("/forgot-password", sensitiveLimiter, authController.forgotPassword);
router.post("/refresh", sensitiveLimiter, authController.refresh);
router.get("/me", authMiddleware, requireJwtOrganizationAccess, authController.me);
router.get("/me/context", authMiddleware, requireJwtOrganizationAccess, authController.meContext);
router.post("/accept-invite", authMiddleware, requireJwtOrganizationAccess, authController.acceptInviteLoggedIn);
router.post("/switch-organization", authMiddleware, authController.switchOrganization);
router.post("/me/active-organization", authMiddleware, authController.activeOrganization);
router.patch("/profile", authMiddleware, requireJwtOrganizationAccess, authController.patchProfile);
router.patch("/password", authMiddleware, requireJwtOrganizationAccess, authController.patchPassword);

export default router;
