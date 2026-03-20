import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import integrationsRoutes from "./routes/integrations.routes.js";

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Muitas requisições. Tente novamente em alguns minutos." },
});
app.use("/api", limiter);

app.use("/api/auth", authRoutes);
app.use("/api/integrations", integrationsRoutes);

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
