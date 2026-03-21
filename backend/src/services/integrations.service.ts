import { env } from "../config/env.js";
import { prisma } from "../utils/prisma.js";
import { createState, consumeState } from "../utils/oauth-state.js";
import { assertCanAddIntegration } from "./plan-limits.service.js";

const GOOGLE_ADS_SLUG = "google-ads";
const META_ADS_SLUG = "meta";
const SCOPES = ["https://www.googleapis.com/auth/adwords"];
const META_SCOPES = ["ads_read", "ads_management"]; // ads_read = read-only; ads_management for account list
const BASE = env.FRONTEND_URL;

export function getGoogleAdsAuthUrl(organizationId: string): string {
  const state = createState(organizationId);
  const redirectUri = getGoogleAdsCallbackUrl();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getGoogleAdsCallbackUrl(): string {
  return `${env.API_BASE_URL}/api/integrations/google-ads/callback`;
}

export async function exchangeGoogleAdsCode(code: string, state: string): Promise<string | null> {
  const organizationId = consumeState(state);
  if (!organizationId) return null;

  const redirectUri = getGoogleAdsCallbackUrl();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Google token exchange failed:", err);
    return null;
  }

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

  const existingGoogle = await prisma.integration.findUnique({
    where: { organizationId_slug: { organizationId, slug: GOOGLE_ADS_SLUG } },
  });
  if (!existingGoogle) {
    await assertCanAddIntegration(organizationId);
  }

  await prisma.integration.upsert({
    where: {
      organizationId_slug: { organizationId, slug: GOOGLE_ADS_SLUG },
    },
    create: {
      organizationId,
      platform: "Google Ads",
      slug: GOOGLE_ADS_SLUG,
      status: "connected",
      config,
      lastSyncAt: new Date(),
    },
    update: {
      status: "connected",
      config,
      lastSyncAt: new Date(),
    },
  });

  return organizationId;
}

// --- Meta Ads ---

export function getMetaAdsCallbackUrl(): string {
  return `${env.API_BASE_URL}/api/integrations/meta-ads/callback`;
}

export function getMetaAdsAuthUrl(organizationId: string): string {
  const state = createState(organizationId);
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: getMetaAdsCallbackUrl(),
    state,
    scope: META_SCOPES.join(","),
    response_type: "code",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeMetaAdsCode(code: string, state: string): Promise<string | null> {
  const organizationId = consumeState(state);
  if (!organizationId) return null;

  const redirectUri = getMetaAdsCallbackUrl();
  const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    redirect_uri: redirectUri,
    code,
  })}`;

  const res = await fetch(tokenUrl);
  if (!res.ok) {
    const err = await res.text();
    console.error("Meta token exchange failed:", err);
    return null;
  }

  const data = (await res.json()) as { access_token: string; token_type?: string };
  const accessToken = data.access_token;
  if (!accessToken) return null;

  // Exchange for long-lived token (optional; short-lived ~1h, long-lived ~60d)
  const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    fb_exchange_token: accessToken,
  })}`;
  const longRes = await fetch(longLivedUrl);
  const tokenToStore = longRes.ok
    ? ((await longRes.json()) as { access_token?: string }).access_token ?? accessToken
    : accessToken;

  const config = JSON.stringify({
    access_token: tokenToStore,
    expiry_date: Date.now() + 60 * 24 * 60 * 60 * 1000, // ~60 days
  });

  const existingMeta = await prisma.integration.findUnique({
    where: { organizationId_slug: { organizationId, slug: META_ADS_SLUG } },
  });
  if (!existingMeta) {
    await assertCanAddIntegration(organizationId);
  }

  await prisma.integration.upsert({
    where: {
      organizationId_slug: { organizationId, slug: META_ADS_SLUG },
    },
    create: {
      organizationId,
      platform: "Meta Ads",
      slug: META_ADS_SLUG,
      status: "connected",
      config,
      lastSyncAt: new Date(),
    },
    update: {
      status: "connected",
      config,
      lastSyncAt: new Date(),
    },
  });

  return organizationId;
}

export async function listIntegrations(organizationId: string) {
  const list = await prisma.integration.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
  return list.map((i) => ({
    id: i.id,
    platform: i.platform,
    slug: i.slug,
    status: i.status,
    lastSyncAt: i.lastSyncAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  }));
}

export async function disconnectIntegration(integrationId: string, organizationId: string) {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, organizationId },
  });
  if (!integration) return false;
  await prisma.integration.update({
    where: { id: integrationId },
    data: { status: "disconnected", config: null },
  });
  return true;
}
