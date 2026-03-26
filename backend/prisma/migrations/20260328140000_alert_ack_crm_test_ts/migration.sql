-- Reconhecer ocorrências de alerta na UI; último teste WhatsApp Ativa CRM
ALTER TABLE "AlertOccurrence" ADD COLUMN "acknowledgedAt" TIMESTAMP(3);

ALTER TABLE "MarketingSettings" ADD COLUMN "lastAtivaCrmTestSentAt" TIMESTAMP(3);
