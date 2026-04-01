-- CreateEnum
CREATE TYPE "AutomationActionType" AS ENUM ('NOTIFY_ONLY', 'PAUSE_ASSET', 'INCREASE_BUDGET_20', 'DECREASE_BUDGET_20');

-- AlterTable AlertRule: migrate VARCHAR actionType -> enum
ALTER TABLE "AlertRule" ADD COLUMN "actionType_new" "AutomationActionType";

UPDATE "AlertRule" SET "actionType_new" = CASE
  WHEN "actionType" = 'whatsapp_alert' THEN 'NOTIFY_ONLY'::"AutomationActionType"
  WHEN "actionType" IN ('pause_campaign', 'pause_entity_whatsapp') THEN 'PAUSE_ASSET'::"AutomationActionType"
  WHEN "actionType" = 'reduce_budget_20_whatsapp' THEN 'DECREASE_BUDGET_20'::"AutomationActionType"
  WHEN "actionType" = 'INCREASE_BUDGET_20' THEN 'INCREASE_BUDGET_20'::"AutomationActionType"
  WHEN "actionType" = 'NOTIFY_ONLY' THEN 'NOTIFY_ONLY'::"AutomationActionType"
  WHEN "actionType" = 'PAUSE_ASSET' THEN 'PAUSE_ASSET'::"AutomationActionType"
  WHEN "actionType" = 'DECREASE_BUDGET_20' THEN 'DECREASE_BUDGET_20'::"AutomationActionType"
  ELSE 'NOTIFY_ONLY'::"AutomationActionType"
END;

ALTER TABLE "AlertRule" DROP COLUMN "actionType";
ALTER TABLE "AlertRule" RENAME COLUMN "actionType_new" TO "actionType";
ALTER TABLE "AlertRule" ALTER COLUMN "actionType" SET NOT NULL;
ALTER TABLE "AlertRule" ALTER COLUMN "actionType" SET DEFAULT 'NOTIFY_ONLY'::"AutomationActionType";

-- CreateTable
CREATE TABLE "AutomationExecutionLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "assetId" VARCHAR(128) NOT NULL,
    "assetLabel" VARCHAR(200),
    "actionTaken" VARCHAR(80) NOT NULL,
    "previousValue" VARCHAR(512),
    "newValue" VARCHAR(512),
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationExecutionLog_organizationId_executedAt_idx" ON "AutomationExecutionLog"("organizationId", "executedAt");

-- CreateIndex
CREATE INDEX "AutomationExecutionLog_ruleId_executedAt_idx" ON "AutomationExecutionLog"("ruleId", "executedAt");

-- AddForeignKey
ALTER TABLE "AutomationExecutionLog" ADD CONSTRAINT "AutomationExecutionLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecutionLog" ADD CONSTRAINT "AutomationExecutionLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
