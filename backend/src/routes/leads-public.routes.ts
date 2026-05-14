import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as leads from "../controllers/leads.controller.js";

/**
 * Endpoint público da LP em ativadash.com → POST /api/leads.
 * Rate-limit por IP é estreito porque o form é único e não-recorrente.
 */
const router = Router();

const submitLimiter = rateLimit({
  /** 5 envios por IP a cada 10 minutos basta para um form de captura. */
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { message: "Muitas solicitações. Aguarde alguns minutos e tente novamente." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

router.post("/", submitLimiter, leads.createLeadPublic);

export default router;
