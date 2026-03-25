import type { GoogleAdsCampaignRow, MetaAdsCampaignRow } from "@/lib/integrations-api";
import type { OsCampaignRow } from "@/lib/marketing-campaign-os";

/** Campanhas Meta + Google no formato da central operacional (nível campanha apenas). */
export function buildCombinedCampaignOsRows(
  metaRows: MetaAdsCampaignRow[],
  googleRows: GoogleAdsCampaignRow[]
): OsCampaignRow[] {
  const m: OsCampaignRow[] = metaRows.map((r, i) => ({
    id: `meta-camp-${r.campaignId ?? i}`,
    channel: "Meta",
    level: "campaign",
    name: r.campaignName,
    externalId: r.campaignId,
    spend: r.spend,
    impressions: r.impressions,
    clicks: r.clicks,
    leads: r.leads + (r.messagingConversationsStarted ?? 0),
    sales: r.purchases ?? 0,
    revenue: r.purchaseValue ?? 0,
  }));
  const g: OsCampaignRow[] = googleRows.map((r, i) => ({
    id: `gg-camp-${r.campaignId ?? i}`,
    channel: "Google",
    level: "campaign",
    name: r.campaignName,
    externalId: r.campaignId,
    spend: r.costMicros / 1_000_000,
    impressions: r.impressions,
    clicks: r.clicks,
    leads: r.conversions,
    sales: r.conversions,
    revenue: r.conversionsValue ?? 0,
  }));
  return [...m, ...g].sort((a, b) => b.spend - a.spend);
}
