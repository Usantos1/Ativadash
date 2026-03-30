-- A migração 20260330120000 punha resellerPartner = true em todas as raízes.
-- Com organizationKind MATRIX inferido pelo plano (ex.: Profissional com maxChildOrganizations > 0),
-- contas sem nenhum filho na hierarquia ficavam com painel /revenda e catálogo global.
--
-- Nova regra:
-- - Todas as raízes: resellerPartner = false.
-- - true só para MATRIX com pelo menos um filho ativo (ecossistema já existe).
-- Matriz nova (0 filhos) criada na Plataforma: createRootOrganization define resellerPartner = true no código.
-- Matriz vazia legada: ativar em Plataforma → empresa (toggle parceiro de revenda).

UPDATE "Organization" SET "resellerPartner" = false WHERE "parentOrganizationId" IS NULL;

UPDATE "Organization" AS o
SET "resellerPartner" = true
WHERE o."parentOrganizationId" IS NULL
  AND o."deletedAt" IS NULL
  AND o."organizationKind" = 'MATRIX'
  AND EXISTS (
    SELECT 1 FROM "Organization" AS c
    WHERE c."parentOrganizationId" = o.id AND c."deletedAt" IS NULL
  );
