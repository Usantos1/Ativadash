-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadProfile" AS ENUM ('AGENCY', 'CLIENT', 'FREELANCER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LeadAdsBudget" AS ENUM ('UNDER_5K', 'FROM_5K_TO_25K', 'FROM_25K_TO_100K', 'OVER_100K', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "companyName" TEXT,
    "websiteUrl" TEXT,
    "profile" "LeadProfile" NOT NULL DEFAULT 'UNKNOWN',
    "monthlyAdsBudget" "LeadAdsBudget" NOT NULL DEFAULT 'UNKNOWN',
    "monthlyRevenueBrl" DECIMAL(14,2),
    "managedAccountsCount" INTEGER,
    "teamSize" INTEGER,
    "primaryChannel" TEXT,
    "goal" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "referrer" TEXT,
    "pageUrl" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "assignedToUserId" TEXT,
    "notes" TEXT,
    "contactedAt" TIMESTAMP(3),
    "qualifiedAt" TIMESTAMP(3),
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_assignedToUserId_idx" ON "Lead"("assignedToUserId");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_whatsapp_idx" ON "Lead"("whatsapp");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
