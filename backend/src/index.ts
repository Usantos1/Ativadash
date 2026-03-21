import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import integrationsRoutes from "./routes/integrations.routes.js";
import marketingRoutes from "./routes/marketing.routes.js";
import workspaceRoutes from "./routes/workspace.routes.js";
import organizationRoutes from "./routes/organization.routes.js";
import platformRoutes from "./routes/platform.routes.js";

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

app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Muitas requisições. Tente novamente em alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  /** Evita ValidationError se X-Forwarded-For existir sem trust proxy (edge cases) */
  validate: { xForwardedForHeader: false },
});
app.use("/api", limiter);

app.use("/api/auth", authRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/marketing", marketingRoutes);
app.use("/api/workspace", workspaceRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/platform", platformRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "ativa-dash-api" });
});

app.use((_req, res) => {
  res.status(404).json({ message: "Rota não encontrada" });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Erro interno do servidor" });
});

app.listen(env.PORT, () => {
  console.log(`Ativa Dash API rodando em http://localhost:${env.PORT}`);
});
