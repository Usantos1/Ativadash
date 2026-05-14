/** Endpoints e URLs configuráveis no build (cross-env via npm run build:prod). */
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || "https://api.ativadash.com";

export const APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined) || "https://app.ativadash.com";

export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined) || "https://ativadash.com";
