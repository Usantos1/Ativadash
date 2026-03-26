-- CreateTable
CREATE TABLE "MetaAdsAssignment" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAdsAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdsAssignment_integrationId_clientAccountId_key" ON "MetaAdsAssignment"("integrationId", "clientAccountId");

-- CreateIndex
CREATE INDEX "MetaAdsAssignment_organizationId_idx" ON "MetaAdsAssignment"("organizationId");

-- AddForeignKey
ALTER TABLE "MetaAdsAssignment" ADD CONSTRAINT "MetaAdsAssignment_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAdsAssignment" ADD CONSTRAINT "MetaAdsAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAdsAssignment" ADD CONSTRAINT "MetaAdsAssignment_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
