-- AlterTable
ALTER TABLE "AlertRule" ALTER COLUMN "actionType" SET DATA TYPE VARCHAR(40);

-- AlterTable
ALTER TABLE "AlertRule" ADD COLUMN "evaluationLevel" VARCHAR(16);
ALTER TABLE "AlertRule" ADD COLUMN "checkFrequency" VARCHAR(16);
ALTER TABLE "AlertRule" ADD COLUMN "actionWindowStartLocal" VARCHAR(5);
ALTER TABLE "AlertRule" ADD COLUMN "actionWindowEndLocal" VARCHAR(5);
