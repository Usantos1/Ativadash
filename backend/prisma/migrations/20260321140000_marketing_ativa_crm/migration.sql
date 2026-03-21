-- AlterTable
ALTER TABLE "MarketingSettings" ADD COLUMN "ativaCrmApiToken" TEXT,
ADD COLUMN "ativaCrmNotifyPhone" TEXT,
ADD COLUMN "ativaCrmAlertsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastAtivaCrmAlertSentAt" TIMESTAMP(3);
