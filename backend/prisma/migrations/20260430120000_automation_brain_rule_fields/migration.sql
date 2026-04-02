-- AlterEnum
ALTER TYPE "AutomationActionType" ADD VALUE 'ACTIVATE_ASSET';

-- AlterTable
ALTER TABLE "AlertRule" ADD COLUMN "lastExecutedAt" TIMESTAMP(3),
ADD COLUMN "lastEvaluationAt" TIMESTAMP(3),
ADD COLUMN "actionValue" DECIMAL(10,4),
ADD COLUMN "cooldownMinutes" INTEGER NOT NULL DEFAULT 1440,
ADD COLUMN "checkFrequencyMinutes" INTEGER;
