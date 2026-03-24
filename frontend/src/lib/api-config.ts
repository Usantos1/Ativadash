/** Base da API REST (evita import circular entre `api.ts` e `auth-refresh.ts`). */
function getApiBase(): string {
  let base: string;
  if (import.meta.env.VITE_API_URL) {
    base = import.meta.env.VITE_API_URL;
  } else if (typeof window !== "undefined" && window.location.hostname === "app.ativadash.com") {
    base = "https://api.ativadash.com";
  } else {
    return "/api";
  }
  return base.endsWith("/api") ? base : `${base.replace(/\/$/, "")}/api`;
}

export const API_BASE = getApiBase();
