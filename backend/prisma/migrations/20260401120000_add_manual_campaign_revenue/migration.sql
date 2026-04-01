-- CreateTable
CREATE TABLE "ManualCampaignRevenue" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channel" VARCHAR(16) NOT NULL,
    "manualRevenue" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualCampaignRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualCampaignRevenue_workspaceId_idx" ON "ManualCampaignRevenue"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualCampaignRevenue_workspaceId_campaignId_key" ON "ManualCampaignRevenue"("workspaceId", "campaignId");

-- AddForeignKey
ALTER TABLE "ManualCampaignRevenue" ADD CONSTRAINT "ManualCampaignRevenue_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
