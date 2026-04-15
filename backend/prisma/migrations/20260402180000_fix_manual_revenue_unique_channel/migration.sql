-- DropIndex
DROP INDEX IF EXISTS "ManualCampaignRevenue_workspaceId_campaignId_key";

-- CreateIndex
CREATE UNIQUE INDEX "ManualCampaignRevenue_workspaceId_campaignId_channel_key" ON "ManualCampaignRevenue"("workspaceId", "campaignId", "channel");
