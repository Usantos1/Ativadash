import type { BusinessGoalMode } from "@/lib/business-goal-mode";
import type { MarketingDashboardPerfRow } from "@/lib/marketing-dashboard-api";
import type { GoogleAdsAdGroupRow, GoogleAdsAdRow, GoogleAdsCampaignRow } from "@/lib/integrations-api";

function emptyEngagementRest(): Pick<
  MarketingDashboardPerfRow,
  | "messagingConversations"
  | "landingPageViews"
  | "initiateCheckout"
  | "addToCart"
  | "completeRegistration"
> {
  return {
    messagingConversations: 0,
    landingPageViews: 0,
    initiateCheckout: 0,
    addToCart: 0,
    completeRegistration: 0,
  };
}

function baseFromMetrics(
  spend: number,
  impressions: number,
  clicks: number,
  conversions: number,
  conversionsValue: number,
  mode: BusinessGoalMode
): Pick<
  MarketingDashboardPerfRow,
  | "spend"
  | "impressions"
  | "clicks"
  | "leads"
  | "purchases"
  | "purchaseValue"
  | "ctrPct"
  | "cpc"
  | "cpl"
  | "roas"
> {
  let leads = 0;
  let purchases = 0;
  if (mode === "LEADS") leads = conversions;
  else if (mode === "SALES") purchases = conversions;
  else {
    leads = conversions;
    purchases = conversions;
  }
  const ctrPct = impressions > 0 ? (clicks / impressions) * 100 : null;
  const cpc = clicks > 0 && spend > 0 ? spend / clicks : null;
  const cpl = leads > 0 && spend > 0 ? spend / leads : null;
  const roas = spend > 0 && conversionsValue > 0 ? conversionsValue / spend : null;
  return {
    spend,
    impressions,
    clicks,
    leads,
    purchases,
    purchaseValue: conversionsValue,
    ctrPct,
    cpc,
    cpl,
    roas,
  };
}

function mapEntity(st?: GoogleAdsCampaignRow["entityStatus"]): MarketingDashboardPerfRow["entityStatus"] {
  return st ?? null;
}

export function mapGoogleCampaignToPerfRow(
  row: GoogleAdsCampaignRow,
  mode: BusinessGoalMode
): MarketingDashboardPerfRow {
  const spend = row.costMicros / 1_000_000;
  const base = baseFromMetrics(
    spend,
    row.impressions,
    row.clicks,
    row.conversions,
    row.conversionsValue,
    mode
  );
  const id = row.campaignId ?? `g:c:${row.campaignName}`;
  return {
    id,
    name: row.campaignName,
    parentName: null,
    objective: null,
    reach: null,
    reachReturned: false,
    linkClicks: null,
    entityStatus: mapEntity(row.entityStatus),
    ...base,
    ...emptyEngagementRest(),
  };
}

export function mapGoogleAdGroupToPerfRow(row: GoogleAdsAdGroupRow, mode: BusinessGoalMode): MarketingDashboardPerfRow {
  const spend = row.costMicros / 1_000_000;
  const base = baseFromMetrics(
    spend,
    row.impressions,
    row.clicks,
    row.conversions,
    row.conversionsValue,
    mode
  );
  const id =
    row.campaignId && row.adGroupId
      ? `g:ag:${row.campaignId}|${row.adGroupId}`
      : `g:ag:${row.campaignName}\0${row.adGroupName}`;
  return {
    id,
    name: row.adGroupName,
    parentName: row.campaignName,
    objective: null,
    reach: null,
    reachReturned: false,
    linkClicks: null,
    entityStatus: mapEntity(row.entityStatus),
    ...base,
    ...emptyEngagementRest(),
  };
}

export function mapGoogleAdToPerfRow(row: GoogleAdsAdRow, mode: BusinessGoalMode): MarketingDashboardPerfRow {
  const spend = row.costMicros / 1_000_000;
  const base = baseFromMetrics(
    spend,
    row.impressions,
    row.clicks,
    row.conversions,
    row.conversionsValue,
    mode
  );
  const id = row.adId ? `g:ad:${row.adId}` : `g:ad:${row.campaignName}:${row.adGroupName}:${spend}`;
  const label = row.adId ? `Anúncio ${row.adId}` : "Anúncio";
  return {
    id,
    name: label,
    parentName: `${row.campaignName} · ${row.adGroupName}`,
    objective: null,
    reach: null,
    reachReturned: false,
    linkClicks: null,
    entityStatus: mapEntity(row.entityStatus),
    ...base,
    ...emptyEngagementRest(),
  };
}
