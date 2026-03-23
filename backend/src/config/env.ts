import { loadAtivadashEnv } from "./dotenv-load.js";

loadAtivadashEnv();

/**
 * Por padrão confia em 1 hop de proxy (Nginx, Cloudflare, Vite proxy, túneis).
 * Se false: sem trust proxy — qualquer X-Forwarded-For quebrava o express-rate-limit v7.
 * Desligue só se o Node estiver exposto direto à internet sem proxy: TRUST_PROXY=false
 */
function parseTrustProxy(): boolean {
  const v = process.env.TRUST_PROXY?.toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}

/** FRONTEND_URL pode listar várias origens separadas por vírgula: CORS aceita todas; a primeira entra em redirects OAuth. */
function parseFrontendOrigins(): { primary: string; cors: string | string[] } {
  const raw = process.env.FRONTEND_URL ?? "http://localhost:5173";
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const primary = parts[0] ?? "http://localhost:5173";
  if (parts.length <= 1) {
    return { primary, cors: primary };
  }
  return { primary, cors: parts };
}

const { primary: frontendPrimary, cors: corsOrigin } = parseFrontendOrigins();

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    "[ativadash] Nenhuma conexão PostgreSQL configurada.\n" +
      "  Opção A — URL completa: defina DATABASE_URL no .env (raiz do repo ou backend/.env).\n" +
      "  Opção B — estilo Ativafix: na raiz, .env com DB_HOST, DB_NAME, DB_USER, DB_PASSWORD (e opcional DB_PORT, DB_SSL).\n" +
      "  → Exemplos: .env.example (raiz) e backend/.env.example\n" +
      "  → Postgres: configure DB_* ou DATABASE_URL (como no Ativafix) ou use docker compose na raiz (opcional)"
  );
  process.exit(1);
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT) || 3000,
  /** Express trust proxy — necessário para express-rate-limit com reverse proxy */
  TRUST_PROXY: parseTrustProxy(),
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-secret",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  /** Primeira origem da lista — redirects pós-OAuth (integrações). */
  FRONTEND_URL: frontendPrimary,
  /** Origem(ns) permitida(s) no CORS (uma string ou várias). */
  CORS_ORIGIN: corsOrigin,
  API_BASE_URL: process.env.API_BASE_URL ?? `http://localhost:${Number(process.env.PORT) || 3000}`,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
  META_APP_ID: process.env.META_APP_ID ?? "",
  META_APP_SECRET: process.env.META_APP_SECRET ?? "",
  /** E-mails (separados por vírgula) com acesso a /api/platform/* */
  PLATFORM_ADMIN_EMAILS: process.env.PLATFORM_ADMIN_EMAILS ?? "",
};
