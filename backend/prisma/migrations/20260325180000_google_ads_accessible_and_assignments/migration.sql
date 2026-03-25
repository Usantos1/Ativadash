-- CreateTable
CREATE TABLE "GoogleAdsAccessibleCustomer" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "descriptiveName" TEXT,
    "currencyCode" TEXT,
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "managerCustomerId" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAdsAccessibleCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleAdsCustomerAssignment" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientAccountId" TEXT NOT NULL,
    "googleCustomerId" TEXT NOT NULL,
    "loginCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAdsCustomerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAdsAccessibleCustomer_integrationId_customerId_key" ON "GoogleAdsAccessibleCustomer"("integrationId", "customerId");

-- CreateIndex
CREATE INDEX "GoogleAdsAccessibleCustomer_integrationId_idx" ON "GoogleAdsAccessibleCustomer"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAdsCustomerAssignment_integrationId_clientAccountId_key" ON "GoogleAdsCustomerAssignment"("integrationId", "clientAccountId");

-- CreateIndex
CREATE INDEX "GoogleAdsCustomerAssignment_organizationId_idx" ON "GoogleAdsCustomerAssignment"("organizationId");

-- AddForeignKey
ALTER TABLE "GoogleAdsAccessibleCustomer" ADD CONSTRAINT "GoogleAdsAccessibleCustomer_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleAdsCustomerAssignment" ADD CONSTRAINT "GoogleAdsCustomerAssignment_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleAdsCustomerAssignment" ADD CONSTRAINT "GoogleAdsCustomerAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleAdsCustomerAssignment" ADD CONSTRAINT "GoogleAdsCustomerAssignment_clientAccountId_fkey" FOREIGN KEY ("clientAccountId") REFERENCES "ClientAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
