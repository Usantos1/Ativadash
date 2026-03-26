-- Deduplicação por tipo de alerta, modelos de mensagem e agendamento de resumo (JSON)
ALTER TABLE "MarketingSettings" ADD COLUMN "whatsappLastOutboundByCode" JSONB;
ALTER TABLE "MarketingSettings" ADD COLUMN "whatsappMessageTemplates" JSONB;
ALTER TABLE "MarketingSettings" ADD COLUMN "whatsappDigestSchedule" JSONB;

-- Regra customizada: enviar ou não pelo WhatsApp (padrão true para compatibilidade)
ALTER TABLE "AlertRule" ADD COLUMN "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT true;
