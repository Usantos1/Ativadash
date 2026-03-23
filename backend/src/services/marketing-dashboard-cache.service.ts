import { prisma } from "../utils/prisma.js";
import { env } from "../config/env.js";
import {
  fetchMarketingDashboardPayload,
  type MarketingDashboardPayload,
} from "./marketing-dashboard.service.js";

const META_SLUG = "meta";
const GOOGLE_SLUG = "google-ads";

const DASHBOARD_TTL_MS = 60_000;
const INTEGRATION_STATUS_TTL_MS = 30_000;

type CacheEntry = { expires: number; value: MarketingDashboardPayload };
const dashboardCache = new Map<string, CacheEntry>();
const dashboardInflight = new Map<string, Promise<MarketingDashboardPayload>>();

export function dashboardCacheKey(organizationId: string, range: { start: string; end: string }): string {
  return `${organizationId}:${range.start}:${range.end}`;
}

/**
 * Cache em memória + deduplicação de requisições concorrentes (vários blocos do front em paralelo).
 * `bypassCache` força novo fetch à Meta e renova o TTL.
 */
export async function getMarketingDashboardCached(
  organizationId: string,
  range: { start: string; end: string },
  options?: { bypassCache?: boolean }
): Promise<MarketingDashboardPayload> {
  const key = dashboardCacheKey(organizationId, range);

  if (options?.bypassCache) {
    dashboardInflight.delete(key);
    dashboardCache.delete(key);
    const value = await fetchMarketingDashboardPayload(organizationId, range);
    dashboardCache.set(key, { value, expires: Date.now() + DASHBOARD_TTL_MS });
    return value;
  }

  const hit = dashboardCache.get(key);
  if (hit && Date.now() < hit.expires) {
    return hit.value;
  }

  let p = dashboardInflight.get(key);
  if (!p) {
    p = fetchMarketingDashboardPayload(organizationId, range)
      .then((value) => {
        dashboardCache.set(key, { value, expires: Date.now() + DASHBOARD_TTL_MS });
        dashboardInflight.delete(key);
        return value;
      })
      .catch((e) => {
        dashboardInflight.delete(key);
        throw e;
      });
    dashboardInflight.set(key, p);
  }

  return p;
}

export type DashboardIntegrationPayload = {
  ok: true;
  range: { start: string; end: string };
  integrationStatus: Extract<MarketingDashboardPayload, { ok: true }>["integrationStatus"];
};

type IntegrationCacheEntry = { expires: number; value: DashboardIntegrationPayload };
const integrationCache = new Map<string, IntegrationCacheEntry>();

export async function getDashboardIntegrationStatusCached(
  organizationId: string,
  range: { start: string; end: string },
  options?: { bypassCache?: boolean }
): Promise<DashboardIntegrationPayload> {
  const key = `${organizationId}:${range.start}:${range.end}`;

  if (!options?.bypassCache) {
    const hit = integrationCache.get(key);
    if (hit && Date.now() < hit.expires) return hit.value;
  } else {
    integrationCache.delete(key);
  }

  const integrations = await prisma.integration.findMany({
    where: { organizationId },
    select: { slug: true, status: true },
  });
  const metaInt = integrations.find((i) => i.slug === META_SLUG);
  const googleInt = integrations.find((i) => i.slug === GOOGLE_SLUG);
  const googleConnected = googleInt?.status === "connected";
  let googleStatus: "pending_approval" | "connected" | "not_connected" = googleConnected
    ? "connected"
    : "not_connected";
  if (env.GOOGLE_ADS_UX_PENDING) googleStatus = "pending_approval";

  const value: DashboardIntegrationPayload = {
    ok: true,
    range,
    integrationStatus: {
      metaAds: { connected: metaInt?.status === "connected", healthy: metaInt?.status === "connected" },
      googleAds: { connected: googleConnected, status: googleStatus },
    },
  };

  integrationCache.set(key, { value, expires: Date.now() + INTEGRATION_STATUS_TTL_MS });
  return value;
}
