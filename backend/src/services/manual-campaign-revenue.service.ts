import { prisma } from "../utils/prisma.js";

export type ManualRevenueRow = {
  campaignId: string;
  channel: string;
  manualRevenue: number;
};

export async function upsertManualCampaignRevenue(
  workspaceId: string,
  campaignId: string,
  channel: string,
  manualRevenue: number
) {
  return prisma.manualCampaignRevenue.upsert({
    where: { workspaceId_campaignId: { workspaceId, campaignId } },
    update: { manualRevenue, channel },
    create: { workspaceId, campaignId, channel, manualRevenue },
  });
}

export async function deleteManualCampaignRevenue(workspaceId: string, campaignId: string) {
  return prisma.manualCampaignRevenue.deleteMany({
    where: { workspaceId, campaignId },
  });
}

export async function getManualRevenuesForWorkspace(workspaceId: string): Promise<ManualRevenueRow[]> {
  const rows = await prisma.manualCampaignRevenue.findMany({
    where: { workspaceId },
    select: { campaignId: true, channel: true, manualRevenue: true },
  });
  return rows;
}

export async function getManualRevenueMap(workspaceId: string): Promise<Map<string, number>> {
  const rows = await getManualRevenuesForWorkspace(workspaceId);
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.campaignId, r.manualRevenue);
  return map;
}
