import { api } from "./api";

function hooksApiBase(): string {
  if (import.meta.env.VITE_API_URL) {
    const b = import.meta.env.VITE_API_URL.replace(/\/$/, "");
    return b.endsWith("/api") ? b : `${b}/api`;
  }
  if (typeof window !== "undefined" && window.location.hostname === "app.ativadash.com") {
    return "https://api.ativadash.com/api";
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  return "/api";
}

/** URL pública de ingestão (POST com corpo bruto + assinatura HMAC). */
export function buildWebhookIngestUrl(publicSlug: string): string {
  return `${hooksApiBase()}/hooks/w/${encodeURIComponent(publicSlug)}`;
}

export type WebhookEndpointRow = {
  id: string;
  name: string;
  publicSlug: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WebhookEventRow = {
  id: string;
  webhookEndpointId: string | null;
  eventKey: string;
  sourceType: string;
  status: string;
  processedAt: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
};

export async function fetchWebhookEndpoints(): Promise<WebhookEndpointRow[]> {
  const res = await api.get<{ items: WebhookEndpointRow[] }>("/workspace/webhooks/endpoints");
  return res.items;
}

export async function createWebhookEndpoint(body: {
  name: string;
  publicSlug?: string | null;
}): Promise<{ item: WebhookEndpointRow; plainSecret: string }> {
  return api.post("/workspace/webhooks/endpoints", body);
}

export async function patchWebhookEndpoint(
  id: string,
  body: { active?: boolean; name?: string }
): Promise<{ item: WebhookEndpointRow }> {
  return api.patch(`/workspace/webhooks/endpoints/${id}`, body);
}

export async function fetchWebhookEvents(params?: { limit?: number; offset?: number }): Promise<{
  items: WebhookEventRow[];
  total: number;
  limit: number;
  offset: number;
}> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  const qs = q.toString();
  return api.get(`/workspace/webhooks/events${qs ? `?${qs}` : ""}`);
}

export async function replayWebhookEvent(id: string): Promise<{ item: WebhookEventRow }> {
  return api.post(`/workspace/webhooks/events/${id}/replay`);
}
