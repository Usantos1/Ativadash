-- Perfil: WhatsApp do usuário
ALTER TABLE "User" ADD COLUMN "whatsappNumber" TEXT;

-- Metas: orçamento diário esperado
ALTER TABLE "MarketingSettings" ADD COLUMN "dailyBudgetExpectedBrl" DECIMAL(14,2);

-- Regras: ação, mensagem, roteamento, horário local + fuso
ALTER TABLE "AlertRule" ADD COLUMN "actionType" VARCHAR(32) NOT NULL DEFAULT 'whatsapp_alert';
ALTER TABLE "AlertRule" ADD COLUMN "messageTemplate" TEXT;
ALTER TABLE "AlertRule" ADD COLUMN "routing" JSONB;
ALTER TABLE "AlertRule" ADD COLUMN "evaluationTimeLocal" VARCHAR(5);
ALTER TABLE "AlertRule" ADD COLUMN "evaluationTimezone" VARCHAR(80);
