import { prisma } from "../utils/prisma.js";
import { fetchMetaAdsMetrics } from "./meta-ads-metrics.service.js";
import { fetchGoogleAdsMetrics } from "./google-ads-metrics.service.js";

function rangeLast30d(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 864e5);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export type ChildMarketingRollup30d = {
  spend: number;
  leads: number;
  cpl: number | null;
};

/**
 * Gasto + leads (últimos 30 dias) para um workspace filho — mesma composição Meta + Google do painel ADS.
 */
export async function rollupMarketingLast30DaysForChild(
  organizationId: string
): Promise<ChildMarketingRollup30d | null> {
  const range = rangeLast30d();
  const [metaInt, googleInt] = await Promise.all([
    prisma.integration.findUnique({
      where: { organizationId_slug: { organizationId, slug: "meta" } },
      select: { status: true },
    }),
    prisma.integration.findUnique({
      where: { organizationId_slug: { organizationId, slug: "google-ads" } },
      select: { status: true },
    }),
  ]);
  const hasMeta = metaInt?.status === "connected";
  const hasGoogle = googleInt?.status === "connected";
  if (!hasMeta && !hasGoogle) return null;

  let spend = 0;
  let leads = 0;
  let ok = false;

  if (hasMeta) {
    try {
      const m = await fetchMetaAdsMetrics(organizationId, range);
      if (m.ok) {
        ok = true;
        spend += m.summary.spend;
        leads += m.summary.leads + (m.summary.messagingConversationsStarted ?? 0);
      }
    } catch {
      /* silencioso — painel matriz não deve falhar por um filho */
    }
  }
  if (hasGoogle) {
    try {
      const g = await fetchGoogleAdsMetrics(organizationId, range);
      if (g.ok) {
        ok = true;
        spend += g.summary.costMicros / 1_000_000;
        leads += g.summary.conversions;
      }
    } catch {
      /* ignore */
    }
  }

  if (!ok) return null;
  return {
    spend,
    leads,
    cpl: leads > 0 ? spend / leads : null,
  };
}

type RollupInput = {
  id: string;
  workspaceStatus: string;
  metaAdsConnected: boolean;
  googleAdsConnected: boolean;
};

/** Chamadas em lotes para não saturar APIs Meta/Google. */
export async function rollupMarketing30dForChildren(
  rows: RollupInput[],
  batchSize = 4
): Promise<Map<string, ChildMarketingRollup30d | null>> {
  const map = new Map<string, ChildMarketingRollup30d | null>();
  const eligible = rows.filter(
    (r) => r.workspaceStatus === "ACTIVE" && (r.metaAdsConnected || r.googleAdsConnected)
  );
  for (let i = 0; i < eligible.length; i += batchSize) {
    const chunk = eligible.slice(i, i + batchSize);
    const results = await Promise.all(
      chunk.map(async (r) => {
        try {
          const rollup = await rollupMarketingLast30DaysForChild(r.id);
          return [r.id, rollup] as const;
        } catch {
          return [r.id, null] as const;
        }
      })
    );
    for (const [id, rollup] of results) {
      map.set(id, rollup);
    }
  }
  for (const r of rows) {
    if (!map.has(r.id)) map.set(r.id, null);
  }
  return map;
}
