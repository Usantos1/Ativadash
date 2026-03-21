import "dotenv/config";

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
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",
  API_BASE_URL: process.env.API_BASE_URL ?? `http://localhost:${Number(process.env.PORT) || 3000}`,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
  META_APP_ID: process.env.META_APP_ID ?? "",
  META_APP_SECRET: process.env.META_APP_SECRET ?? "",
};
