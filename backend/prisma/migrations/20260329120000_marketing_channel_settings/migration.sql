-- Metas, automações e preferências de WhatsApp por canal (Meta / Google)
ALTER TABLE "MarketingSettings" ADD COLUMN "goalsByChannel" JSONB;
ALTER TABLE "MarketingSettings" ADD COLUMN "automationsByChannel" JSONB;
ALTER TABLE "MarketingSettings" ADD COLUMN "whatsappAlertsByChannel" JSONB;
ALTER TABLE "MarketingSettings" ADD COLUMN "whatsappAlertCooldownMinutes" INTEGER;

-- Regra customizada: meta | google | all (null tratado como all em código legado)
ALTER TABLE "AlertRule" ADD COLUMN "appliesToChannel" VARCHAR(16);
