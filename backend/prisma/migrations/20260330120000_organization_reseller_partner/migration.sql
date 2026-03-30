-- Apenas empresas raiz com resellerPartner = true podem usar painel/API de revenda e criar filhos na hierarquia.
ALTER TABLE "Organization" ADD COLUMN "resellerPartner" BOOLEAN NOT NULL DEFAULT false;

-- Compatibilidade: contas raiz existentes continuam podendo revender até desativar manualmente na plataforma.
UPDATE "Organization" SET "resellerPartner" = true WHERE "parentOrganizationId" IS NULL;
