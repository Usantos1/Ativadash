import type { GoogleAdsCampaignRow, MetaAdsCampaignRow } from "@/lib/integrations-api";
import type { OsCampaignRow } from "@/lib/marketing-campaign-os";

/** Campanhas Meta + Google no formato da central operacional (nível campanha apenas). */
export function buildCombinedCampaignOsRows(
  metaRows: MetaAdsCampaignRow[],
  googleRows: GoogleAdsCampaignRow[],
  manualRevMap?: Map<string, number>
): OsCampaignRow[] {
  const mrv = (id?: string) => (id && manualRevMap ? manualRevMap.get(id) : undefined);
  const m: OsCampaignRow[] = metaRows.map((r, i) => {
    const mr = mrv(r.campaignId);
    return {
      id: `meta-camp-${r.campaignId ?? i}`,
      channel: "Meta" as const,
      level: "campaign" as const,
      name: r.campaignName,
      externalId: r.campaignId,
      spend: r.spend,
      impressions: r.impressions,
      clicks: r.clicks,
      leads: r.leads + (r.messagingConversationsStarted ?? 0),
      sales: r.purchases ?? 0,
      revenue: (r.purchaseValue ?? 0) + (mr ?? 0),
      manualRevenue: mr,
    };
  });
  const g: OsCampaignRow[] = googleRows.map((r, i) => {
    const mr = mrv(r.campaignId);
    return {
      id: `gg-camp-${r.campaignId ?? i}`,
      channel: "Google" as const,
      level: "campaign" as const,
      name: r.campaignName,
      externalId: r.campaignId,
      spend: r.costMicros / 1_000_000,
      impressions: r.impressions,
      clicks: r.clicks,
      leads: r.conversions,
      sales: r.conversions,
      revenue: (r.conversionsValue ?? 0) + (mr ?? 0),
      manualRevenue: mr,
    };
  });
  return [...m, ...g].sort((a, b) => b.spend - a.spend);
}
