import { env } from "../config/env.js";
import { prisma } from "../utils/prisma.js";
import { createState, consumeState } from "../utils/oauth-state.js";
import { assertCanAddIntegration } from "./plan-limits.service.js";
import { parseGoogleAdsConfig, syncAccessibleGoogleAdsCustomers } from "./google-ads-accounts.service.js";
import { parseMetaAdsConfig } from "./meta-ads-accounts.service.js";

const GOOGLE_ADS_SLUG = "google-ads";
const META_ADS_SLUG = "meta";
/** `userinfo` exige openid + email; só `adwords` não devolve perfil no OAuth v2 userinfo. */
const SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];
const META_SCOPES = ["ads_read", "ads_management", "business_management"];
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

  const existingGoogle = await prisma.integration.findUnique({
    where: { organizationId_slug: { organizationId, slug: GOOGLE_ADS_SLUG } },
  });
  if (!existingGoogle) {
    await assertCanAddIntegration(organizationId);
  }

  const prev = existingGoogle?.config ? parseGoogleAdsConfig(existingGoogle.config) : null;
  const refresh_token = data.refresh_token ?? prev?.refresh_token ?? null;
  if (!refresh_token && process.env.NODE_ENV !== "production") {
    console.warn(
      "[Google Ads OAuth] Sem refresh_token na resposta; reautorize com prompt=consent se a sessão não persistir."
    );
  }

  let google_user_email: string | undefined;
  let google_user_sub: string | undefined;
  try {
    const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (ui.ok) {
      const u = (await ui.json()) as { email?: string; id?: string };
      google_user_email = u.email;
      google_user_sub = u.id;
    } else if (process.env.NODE_ENV !== "production") {
      const t = await ui.text().catch(() => "");
      console.warn("[Google Ads OAuth] userinfo falhou:", ui.status, t.slice(0, 200));
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Google Ads OAuth] userinfo exceção:", e instanceof Error ? e.message : e);
    }
  }

  const sameGoogleIdentity =
    Boolean(google_user_sub && prev?.google_user_sub && google_user_sub === prev.google_user_sub);

  const configObj = {
    access_token: data.access_token,
    refresh_token,
    expiry_date: Date.now() + data.expires_in * 1000,
    google_user_email,
    google_user_sub,
    default_google_customer_id: null as string | null,
    default_login_customer_id: null as string | null,
  };

  if (sameGoogleIdentity && prev?.default_google_customer_id) {
    configObj.default_google_customer_id = prev.default_google_customer_id ?? null;
    configObj.default_login_customer_id = prev.default_login_customer_id ?? null;
  }

  const config = JSON.stringify(configObj);

  const row = await prisma.integration.upsert({
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

  const sync = await syncAccessibleGoogleAdsCustomers(row.id, organizationId);
  if (!sync.ok && process.env.NODE_ENV !== "production") {
    console.warn("[Google Ads] sync após OAuth:", sync.message);
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[Google Ads OAuth] org=${organizationId} integration=${row.id} email=${google_user_email ?? "?"} refresh=${refresh_token ? "sim" : "NÃO"} synced=${sync.ok ? sync.count : "fail"}`
    );
  }

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

  const existingMeta = await prisma.integration.findUnique({
    where: { organizationId_slug: { organizationId, slug: META_ADS_SLUG } },
  });
  if (!existingMeta) {
    await assertCanAddIntegration(organizationId);
  }

  const baseConfig: Record<string, unknown> = {
    access_token: tokenToStore,
    expiry_date: Date.now() + 60 * 24 * 60 * 60 * 1000,
  };
  if (existingMeta?.config) {
    const prev = parseMetaAdsConfig(existingMeta.config);
    if (prev?.default_ad_account_id) baseConfig.default_ad_account_id = prev.default_ad_account_id;
    if (prev?.default_business_id) baseConfig.default_business_id = prev.default_business_id;
  }
  const config = JSON.stringify(baseConfig);

  // Mesma constraint composta que o Google Ads (`organizationId` + `slug`).
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
  const googleIds = list.filter((i) => i.slug === GOOGLE_ADS_SLUG && i.status === "connected").map((i) => i.id);
  const metaIds = list.filter((i) => i.slug === META_ADS_SLUG && i.status === "connected").map((i) => i.id);
  const [accCounts, asnCounts, metaAsnCounts] = await Promise.all([
    googleIds.length
      ? prisma.googleAdsAccessibleCustomer.groupBy({
          by: ["integrationId"],
          where: { integrationId: { in: googleIds } },
          _count: { id: true },
        })
      : Promise.resolve([]),
    googleIds.length
      ? prisma.googleAdsCustomerAssignment.groupBy({
          by: ["integrationId"],
          where: { integrationId: { in: googleIds } },
          _count: { id: true },
        })
      : Promise.resolve([]),
    metaIds.length
      ? prisma.metaAdsAssignment.groupBy({
          by: ["integrationId"],
          where: { integrationId: { in: metaIds } },
          _count: { id: true },
        })
      : Promise.resolve([]),
  ]);
  const accMap = new Map(accCounts.map((g) => [g.integrationId, g._count.id]));
  const asnMap = new Map(asnCounts.map((g) => [g.integrationId, g._count.id]));
  const metaAsnMap = new Map(metaAsnCounts.map((g) => [g.integrationId, g._count.id]));

  return list.map((i) => {
    const base = {
      id: i.id,
      platform: i.platform,
      slug: i.slug,
      status: i.status,
      clientAccountId: i.clientAccountId,
      lastSyncAt: i.lastSyncAt?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
    };
    if (i.slug === GOOGLE_ADS_SLUG) {
      const parsed = i.config ? parseGoogleAdsConfig(i.config) : null;
      return {
        ...base,
        googleUserEmail: parsed?.google_user_email ?? null,
        googleAdsAccessibleCount: accMap.get(i.id) ?? 0,
        googleAdsAssignmentCount: asnMap.get(i.id) ?? 0,
        googleAdsDefaultCustomerId: parsed?.default_google_customer_id ?? null,
      };
    }
    if (i.slug === META_ADS_SLUG) {
      const mp = parseMetaAdsConfig(i.config);
      return {
        ...base,
        metaAssignmentCount: metaAsnMap.get(i.id) ?? 0,
        metaDefaultAdAccountId: mp?.default_ad_account_id ?? null,
        metaFacebookUserName: null,
      };
    }
    return base;
  });
}

export async function updateIntegrationClientAccount(
  integrationId: string,
  organizationId: string,
  clientAccountId: string | null
) {
  if (clientAccountId) {
    const client = await prisma.clientAccount.findFirst({
      where: { id: clientAccountId, organizationId, deletedAt: null },
    });
    if (!client) {
      throw new Error("Cliente comercial não encontrado nesta empresa");
    }
  }
  const integ = await prisma.integration.findFirst({
    where: { id: integrationId, organizationId },
  });
  if (!integ) return null;
  return prisma.integration.update({
    where: { id: integrationId },
    data: { clientAccountId },
  });
}

export async function disconnectIntegration(integrationId: string, organizationId: string) {
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, organizationId },
  });
  if (!integration) return false;
  await prisma.$transaction([
    prisma.metaAdsAssignment.deleteMany({ where: { integrationId } }),
    prisma.googleAdsCustomerAssignment.deleteMany({ where: { integrationId } }),
    prisma.googleAdsAccessibleCustomer.deleteMany({ where: { integrationId } }),
    prisma.integration.update({
      where: { id: integrationId },
      data: { status: "disconnected", config: null },
    }),
  ]);
  return true;
}
