-- Preferências de alertas WhatsApp por membership (horário comercial)
ALTER TABLE "Membership" ADD COLUMN "receiveWhatsappAlerts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Membership" ADD COLUMN "alertStartHour" VARCHAR(5);
ALTER TABLE "Membership" ADD COLUMN "alertEndHour" VARCHAR(5);

-- Regra: limiar dinâmico (metas globais por canal) em vez de valor fixo
ALTER TABLE "AlertRule" ADD COLUMN "thresholdRef" VARCHAR(64);
