import { useAuthStore } from "@/stores/auth-store";

// Sem VITE_API_URL em dev: proxy /api → backend local. Com VITE_API_URL: tudo pela API remota (sem banco no PC).
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

/** Erro HTTP da API JSON (`message` + opcional `code`, ex.: FORBIDDEN_PLAN). */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Texto de erro de API para toasts e banners (`ApiClientError` ou `Error` genérico). */
export function getApiErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiClientError) return e.message;
  if (e instanceof Error) return e.message;
  return fallback;
}

/** Quando o backend envia `FORBIDDEN_PLAN` (campanhas, webhooks no plano, etc.). */
export function formatMutationBlockedMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiClientError) {
    if (e.code === "FORBIDDEN_PLAN") {
      return `${e.message} Peça ao administrador da empresa ou da matriz para liberar o recurso no plano.`;
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return fallback;
}

function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (res.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = "/login";
    throw new Error("Não autorizado");
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string; code?: string } | null;
    const message =
      typeof err?.message === "string" && err.message.length > 0 ? err.message : res.statusText || "Erro na requisição";
    const code = typeof err?.code === "string" ? err.code : undefined;
    throw new ApiClientError(message, res.status, code);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: "GET" }),
  post: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: "DELETE" }),
};
