-- CreateTable
CREATE TABLE "CheckoutEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT,
    "offerId" TEXT,
    "buyerEmail" TEXT,
    "buyerName" TEXT,
    "amountBrl" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "mappedCampaignId" TEXT,
    "mappedChannel" TEXT,
    "subscriptionId" TEXT,
    "recurrenceNumber" INTEGER,
    "rawPayload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutProductMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT,
    "campaignId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutProductMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutEvent_organizationId_source_externalEventId_key" ON "CheckoutEvent"("organizationId", "source", "externalEventId");

-- CreateIndex
CREATE INDEX "CheckoutEvent_organizationId_occurredAt_idx" ON "CheckoutEvent"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "CheckoutEvent_organizationId_eventType_idx" ON "CheckoutEvent"("organizationId", "eventType");

-- CreateIndex
CREATE INDEX "CheckoutEvent_transactionId_idx" ON "CheckoutEvent"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutProductMapping_organizationId_source_productId_key" ON "CheckoutProductMapping"("organizationId", "source", "productId");

-- CreateIndex
CREATE INDEX "CheckoutProductMapping_organizationId_idx" ON "CheckoutProductMapping"("organizationId");

-- AddForeignKey
ALTER TABLE "CheckoutEvent" ADD CONSTRAINT "CheckoutEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutProductMapping" ADD CONSTRAINT "CheckoutProductMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
