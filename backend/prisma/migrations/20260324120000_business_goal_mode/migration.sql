-- CreateEnum
CREATE TYPE "BusinessGoalMode" AS ENUM ('LEADS', 'SALES', 'HYBRID');

-- AlterTable
ALTER TABLE "MarketingSettings" ADD COLUMN "businessGoalMode" "BusinessGoalMode" NOT NULL DEFAULT 'HYBRID',
ADD COLUMN "primaryConversionLabel" VARCHAR(120),
ADD COLUMN "showRevenueBlocksInLeadMode" BOOLEAN NOT NULL DEFAULT false;
