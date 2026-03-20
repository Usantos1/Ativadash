import { Hono } from "hono";
import { cors } from "hono/cors";
import * as auth from "./auth.js";
import * as integrations from "./integrations.js";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  FRONTEND_URL?: string;
  API_BASE_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

const app = new Hono<{ Bindings: Env }>();

const frontendOrigin = (c: { env: Env }) => c.env.FRONTEND_URL ?? "http://localhost:5173";

app.use(
  "*",
  cors({
    origin: (_, c) => frontendOrigin(c),
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return c.text("", 204);
  await next();
});

// Health
app.get("/api/health", (c) => c.json({ status: "ok", service: "ativadash-api" }));

// ----- Auth -----
app.post("/api/auth/register", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { name, email, password } = body as { name?: string; email?: string; password?: string };
  if (!name || !email || !password) {
    return c.json({ message: "Nome, e-mail e senha são obrigatórios" }, 400);
  }
  if (password.length < 6) return c.json({ message: "Senha deve ter pelo menos 6 caracteres" }, 400);
  if (name.length < 2) return c.json({ message: "Nome deve ter pelo menos 2 caracteres" }, 400);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return c.json({ message: "E-mail inválido" }, 400);

  try {
    const result = await auth.register(c.env.DB, {
      JWT_SECRET: c.env.JWT_SECRET,
      JWT_REFRESH_SECRET: c.env.JWT_REFRESH_SECRET,
    }, { name, email, password });
    return c.json(result, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao cadastrar";
    return c.json({ message: msg }, 400);
  }
});

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { email, password } = body as { email?: string; password?: string };
  if (!email || !password) return c.json({ message: "E-mail e senha são obrigatórios" }, 400);

  try {
    const result = await auth.login(c.env.DB, {
      JWT_SECRET: c.env.JWT_SECRET,
      JWT_REFRESH_SECRET: c.env.JWT_REFRESH_SECRET,
    }, { email, password });
    return c.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao entrar";
    return c.json({ message: msg }, 401);
  }
});

app.post("/api/auth/forgot-password", async (c) => {
  await c.req.json().catch(() => ({}));
  return c.json({
    message: "Se existir uma conta com esse e-mail, você receberá as instruções.",
  });
});

app.post("/api/auth/refresh", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const refreshToken = (body as { refreshToken?: string }).refreshToken;
  if (!refreshToken) return c.json({ message: "Refresh token obrigatório" }, 400);

  try {
    const result = await auth.refreshAccessToken(c.env.DB, {
      JWT_SECRET: c.env.JWT_SECRET,
      JWT_REFRESH_SECRET: c.env.JWT_REFRESH_SECRET,
    }, refreshToken);
    return c.json(result);
  } catch {
    return c.json({ message: "Refresh token inválido ou expirado" }, 401);
  }
});

app.get("/api/auth/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ message: "Token não informado" }, 401);
  const token = authHeader.slice(7);
  const payload = await auth.verifyAccessToken(c.env.JWT_SECRET, token);
  if (!payload) return c.json({ message: "Token inválido ou expirado" }, 401);
  return c.json({
    id: payload.userId,
    email: payload.email,
    organizationId: payload.organizationId,
  });
});

// ----- Integrations -----
app.get("/api/integrations", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ message: "Token não informado" }, 401);
  const payload = await auth.verifyAccessToken(c.env.JWT_SECRET, authHeader.slice(7));
  if (!payload) return c.json({ message: "Token inválido ou expirado" }, 401);

  try {
    const list = await integrations.listIntegrations(c.env.DB, payload.organizationId);
    return c.json({ integrations: list });
  } catch {
    return c.json({ message: "Erro ao listar integrações" }, 500);
  }
});

app.get("/api/integrations/google-ads/auth-url", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ message: "Token não informado" }, 401);
  const payload = await auth.verifyAccessToken(c.env.JWT_SECRET, authHeader.slice(7));
  if (!payload) return c.json({ message: "Token inválido ou expirado" }, 401);

  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.json({
      message: "Google Ads não configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no Worker.",
    }, 503);
  }

  const apiBaseUrl = c.env.API_BASE_URL ?? new URL(c.req.url).origin;
  try {
    const url = await integrations.getGoogleAdsAuthUrl(
      c.env.DB,
      payload.organizationId,
      apiBaseUrl,
      c.env.GOOGLE_CLIENT_ID
    );
    return c.json({ url });
  } catch {
    return c.json({ message: "Erro ao gerar URL de autorização" }, 500);
  }
});

app.get("/api/integrations/google-ads/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  const redirectBase = (c.env.FRONTEND_URL ?? "http://localhost:5173") + "/marketing/integracoes";

  if (error) return c.redirect(`${redirectBase}?error=${encodeURIComponent(error)}`);
  if (!code || !state) return c.redirect(`${redirectBase}?error=missing_code_or_state`);

  const apiBaseUrl = c.env.API_BASE_URL ?? new URL(c.req.url).origin;
  try {
    const organizationId = await integrations.exchangeGoogleAdsCode(
      c.env.DB,
      code,
      state,
      {
        DB: c.env.DB,
        GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
        API_BASE_URL: apiBaseUrl,
        FRONTEND_URL: c.env.FRONTEND_URL,
      }
    );
    if (!organizationId) return c.redirect(`${redirectBase}?error=invalid_state`);
    return c.redirect(`${redirectBase}?connected=google-ads`);
  } catch {
    return c.redirect(`${redirectBase}?error=exchange_failed`);
  }
});

app.delete("/api/integrations/:id", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ message: "Token não informado" }, 401);
  const payload = await auth.verifyAccessToken(c.env.JWT_SECRET, authHeader.slice(7));
  if (!payload) return c.json({ message: "Token inválido ou expirado" }, 401);

  const id = c.req.param("id");
  if (!id) return c.json({ message: "ID da integração obrigatório" }, 400);

  try {
    const ok = await integrations.disconnectIntegration(c.env.DB, id, payload.organizationId);
    if (!ok) return c.json({ message: "Integração não encontrada" }, 404);
    return c.json({ success: true });
  } catch {
    return c.json({ message: "Erro ao desvincular" }, 500);
  }
});

app.all("*", (c) => c.json({ message: "Rota não encontrada" }, 404));

export default app;
