import type { D1Database } from "@cloudflare/workers-types";
import { createState, saveState, consumeState } from "./oauth-state.js";

const GOOGLE_ADS_SLUG = "google-ads";
const SCOPES = ["https://www.googleapis.com/auth/adwords"];

export interface IntegrationsEnv {
  DB: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  API_BASE_URL: string;
  FRONTEND_URL?: string;
}

export async function getGoogleAdsAuthUrl(
  db: D1Database,
  organizationId: string,
  apiBaseUrl: string,
  clientId: string
): Promise<string> {
  const state = createState(organizationId);
  await saveState(db, state, organizationId);
  const redirectUri = `${apiBaseUrl}/api/integrations/google-ads/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleAdsCode(
  db: D1Database,
  code: string,
  state: string,
  env: IntegrationsEnv
): Promise<string | null> {
  const organizationId = await consumeState(db, state);
  if (!organizationId) return null;

  const redirectUri = `${env.API_BASE_URL}/api/integrations/google-ads/callback`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const config = JSON.stringify({
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? null,
    expiry_date: Date.now() + data.expires_in * 1000,
  });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO Integration (id, organizationId, platform, slug, status, config, lastSyncAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(organizationId, slug) DO UPDATE SET status = 'connected', config = excluded.config, lastSyncAt = excluded.lastSyncAt, updatedAt = excluded.updatedAt`
  )
    .bind(id, organizationId, "Google Ads", GOOGLE_ADS_SLUG, "connected", config, now, now, now)
    .run();

  return organizationId;
}

export async function listIntegrations(db: D1Database, organizationId: string) {
  const { results } = await db.prepare(
    "SELECT id, platform, slug, status, lastSyncAt, createdAt FROM Integration WHERE organizationId = ? ORDER BY createdAt ASC"
  )
    .bind(organizationId)
    .all<{ id: string; platform: string; slug: string; status: string; lastSyncAt: string | null; createdAt: string }>();

  return (results ?? []).map((i) => ({
    id: i.id,
    platform: i.platform,
    slug: i.slug,
    status: i.status,
    lastSyncAt: i.lastSyncAt ?? null,
    createdAt: i.createdAt,
  }));
}

export async function disconnectIntegration(
  db: D1Database,
  integrationId: string,
  organizationId: string
): Promise<boolean> {
  const r = await db.prepare(
    "UPDATE Integration SET status = 'disconnected', config = NULL, updatedAt = ? WHERE id = ? AND organizationId = ?"
  )
    .bind(new Date().toISOString(), integrationId, organizationId)
    .run();
  return (r.meta.changes ?? 0) > 0;
}
