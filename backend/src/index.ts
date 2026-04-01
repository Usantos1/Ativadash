import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { prisma } from "./utils/prisma.js";
import { logDatabaseConnectionFailure } from "./utils/prisma-connection-error.js";
import authRoutes from "./routes/auth.routes.js";
import integrationsRoutes from "./routes/integrations.routes.js";
import marketingRoutes from "./routes/marketing.routes.js";
import workspaceRoutes from "./routes/workspace.routes.js";
import organizationRoutes from "./routes/organization.routes.js";
import platformRoutes from "./routes/platform.routes.js";
import resellerRoutes from "./routes/reseller.routes.js";
import hooksPublicRoutes from "./routes/webhooks-public.routes.js";
import publicDashboardShareRoutes from "./routes/public-dashboard-share.routes.js";

const app = express();

if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

const webhookIngestLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  message: { message: "Limite de webhooks por minuto excedido" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});
app.use(
  "/api/hooks",
  webhookIngestLimiter,
  express.raw({ type: "*/*", limit: "512kb" }),
  hooksPublicRoutes
);

app.use(express.json());

app.post("/api/internal/automation-tick", async (req, res) => {
  const secret = env.AUTOMATION_INTERNAL_SECRET;
  if (!secret) {
    return res.status(404).json({ message: "Not found" });
  }
  const h = req.get("x-automation-secret") ?? req.get("X-Automation-Secret") ?? "";
  if (h !== secret) {
    return res.status(403).json({ message: "Forbidden" });
  }
  try {
    const { runAutomationExecutionTick } = await import("./services/automation-execution-engine.service.js");
    const result = await runAutomationExecutionTick();
    return res.json(result);
  } catch (e) {
    console.error("[internal/automation-tick]", e);
    return res.status(500).json({ message: "Erro ao executar tick de automação" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "ativa-dash-api" });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ ok: true, database: "connected" });
  } catch (e) {
    logDatabaseConnectionFailure(e, "GET /api/health/db");
    return res.status(503).json({
      ok: false,
      database: "unavailable",
      message:
        "PostgreSQL indisponível ou DATABASE_URL incorreta. Veja o terminal do backend para detalhes.",
    });
  }
});

const limiter = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  max: env.API_RATE_LIMIT_MAX,
  message: { message: "Muitas requisições. Tente novamente em alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  /** Evita ValidationError se X-Forwarded-For existir sem trust proxy (edge cases) */
  validate: { xForwardedForHeader: false },
});
app.use("/api", limiter);

app.use("/api/public", publicDashboardShareRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/marketing", marketingRoutes);
app.use("/api/workspace", workspaceRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/reseller", resellerRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Rota não encontrada" });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Erro interno do servidor" });
});

app.listen(env.PORT, () => {
  console.log(`Ativa Dash API rodando em http://localhost:${env.PORT}`);
  if (env.AUTOMATION_WORKER_ENABLED) {
    import("./services/automation-worker.runner.js")
      .then((m) => m.startAutomationWorker())
      .catch((e) => console.error("[automation-worker] falha ao iniciar:", e));
  }
});
