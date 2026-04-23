-- Adiciona referenceDate (granularidade diária) em ManualCampaignRevenue
-- Rows existentes herdam o dia de createdAt. Trocamos o unique para incluir a data,
-- permitindo múltiplas entradas por (campanha, canal) em dias distintos.

-- 1. Adiciona a coluna (nullable pra backfill)
ALTER TABLE "ManualCampaignRevenue"
  ADD COLUMN "referenceDate" DATE;

-- 2. Popula rows existentes a partir de createdAt (backfill)
UPDATE "ManualCampaignRevenue"
SET "referenceDate" = DATE("createdAt")
WHERE "referenceDate" IS NULL;

-- 3. Torna a coluna NOT NULL
ALTER TABLE "ManualCampaignRevenue"
  ALTER COLUMN "referenceDate" SET NOT NULL;

-- 4. Troca o unique: inclui referenceDate
DROP INDEX IF EXISTS "ManualCampaignRevenue_workspaceId_campaignId_channel_key";

CREATE UNIQUE INDEX "ManualCampaignRevenue_workspaceId_campaignId_channel_referenceDate_key"
  ON "ManualCampaignRevenue" ("workspaceId", "campaignId", "channel", "referenceDate");

-- 5. Índice auxiliar para range queries por período
CREATE INDEX "ManualCampaignRevenue_workspaceId_referenceDate_idx"
  ON "ManualCampaignRevenue" ("workspaceId", "referenceDate");
