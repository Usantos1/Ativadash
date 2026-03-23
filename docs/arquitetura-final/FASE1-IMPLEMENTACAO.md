# Fase 1 — o que foi implementado no backend

Referência de entrega alinhada a [`DECISOES-FECHADAS-FASE1.md`](DECISOES-FECHADAS-FASE1.md).

## Schema e migração

- Enum **`OrganizationKind`** (`MATRIX`, `DIRECT`, `CLIENT_WORKSPACE`) em `Organization.organizationKind`.
- Tabelas **`MatrixWorkspaceGrant`**, **`AssetAccessGrant`**, **`AuditLog`** (enum `GrantAssetType`).
- Migração SQL: backfill de `organizationKind`, migração de **`Membership.role`** para papéis canônicos, remoção de **`Subscription`** em orgs `CLIENT_WORKSPACE`, índices e FKs.

## Hierarquia e assinatura

- Criação de filhos: apenas **`MATRIX`** como pai direto; **`CLIENT_WORKSPACE`** e **`DIRECT`** não criam filhos (`assertCanAddChildOrganization` + `createDescendantByMatrixAdmin`).
- Proibição de **`AGENCY`** filha (API + serviço + validador).
- **`syncSubscriptionFromOrgPlan`** / **`updateSubscriptionForOrganization`**: workspaces cliente não mantêm assinatura própria.

## Contexto ativo e JWT

- **`GET /api/auth/me/context`**: usuário, memberships (com `organizationKind`), `billingOrganizationId`, plano efetivo, `managedOrganizations`.
- **`POST /api/auth/me/active-organization`**: mesmo corpo que **`POST /api/auth/switch-organization`**; troca validada com **`userHasEffectiveAccess`**; reemite tokens; **`AuditLog`** `session.active_organization.changed`.
- Middleware **`requireJwtOrganizationAccess`** em rotas de marketing, workspace, organization, integrations e reseller (não aplica na troca de org para permitir recuperação de sessão).

## Tenancy e grants

- **`userHasEffectiveAccess`** em `tenancy-access.service.ts`: membership direta; na matriz, **`agency_owner`/`agency_admin`** com grants vazios = todos os workspaces; **`agency_ops`** (e legado `member` na matriz) exige **`MatrixWorkspaceGrant`**.
- Endpoints revenda: **`GET/POST /api/reseller/grants/matrix-workspace`**, **`DELETE /api/reseller/grants/matrix-workspace/:grantId`** com auditoria `matrix.workspace_grant.*`.

## Autorização

- **`assertCan(userId, capability, { organizationId })`** em `authorization.service.ts` com strings em **`src/constants/capabilities.ts`**.
- Marketing: **`assertCanReadMarketing`** / **`assertCanMutateAds`** (plano + tenancy + papéis); `marketing-permissions.service.ts` delega a isso.

## Testes

- **`npm test`** (Vitest): papéis (`roles.test.ts`) e tenancy mínimo (`tenancy-access.test.ts`).

## Fora do escopo (Fase 2+)

- **`AssetAccessGrant`**: modelo criado; **CRUD HTTP e checagem por conta** em rotas de mídia ainda não integrados.
- **Webhooks** (`POST /hooks/w/...`), **impersonation** (30 min, read-only, motivo), **tabela `Capability`**, telas novas, funil, escrita avançada de campanhas.
- Frontend: ainda pode usar `switch-organization`; convém passar a preferir **`me/active-organization`** e consumir **`me/context`**.
