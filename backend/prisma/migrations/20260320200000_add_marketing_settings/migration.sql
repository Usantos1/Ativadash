-- CreateTable
CREATE TABLE "MarketingSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetCpaBrl" DECIMAL(14,2),
    "maxCpaBrl" DECIMAL(14,2),
    "targetRoas" DECIMAL(10,4),
    "minResultsForCpa" INTEGER NOT NULL DEFAULT 5,
    "minSpendForAlertsBrl" DECIMAL(14,2),
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alertCpaAboveMax" BOOLEAN NOT NULL DEFAULT true,
    "alertCpaAboveTarget" BOOLEAN NOT NULL DEFAULT true,
    "alertRoasBelowTarget" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingSettings_organizationId_key" ON "MarketingSettings"("organizationId");

ALTER TABLE "MarketingSettings" ADD CONSTRAINT "MarketingSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
