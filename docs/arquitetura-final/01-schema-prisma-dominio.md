# Schema Prisma alvo — domínio principal (especificação)

**Status:** especificação para implementação futura. **Não** é o `schema.prisma` atual do repositório; é o **alvo** após migrações alinhadas a este documento.

**Princípios:**

- Uma linha `Organization` continua sendo o ancoramento de tenant; tipos claros via **enum** + invariantes de serviço.
- Dados operacionais (métricas, eventos) sempre com `organizationId` = **workspace ativo** (org filha `CLIENT` ou org direta).
- `onDelete`: preferir `Restrict` em entidades referenciadas por auditoria externa; `Cascade` em filhos estritamente donos do registro pai.

---

## 1. Enums

### 1.1 `OrganizationKind` (novo)

| Valor | Significado |
|-------|-------------|
| `MATRIX` | Agência/matriz que pode ter filhos `CLIENT` e opera `/revenda`. `parentOrganizationId = null`. |
| `DIRECT` | Empresa final sem agência acima: um único tenant; `parentOrganizationId = null`; não cria filhos `CLIENT` (ou `maxChildOrganizations = 0` efetivo). |
| `CLIENT_WORKSPACE` | Workspace de cliente da agência; **sempre** `parentOrganizationId` apontando para `MATRIX`. |

**Invariantes (serviço, não só DB):**

- `CLIENT_WORKSPACE` ⇒ `parentOrganizationId != null` e pai é `MATRIX`.
- `MATRIX` ⇒ `parentOrganizationId == null`.
- `DIRECT` ⇒ `parentOrganizationId == null`; filhos `Organization` **proibidos** (ou apenas `ClientAccount` / `Project`).

### 1.2 `ResellerOrgKind` (existente — uso após migração)

| Valor | Uso alvo |
|-------|----------|
| `AGENCY` | Opcional em `MATRIX` (sinônimo legado); pode ser deprecado em favor só de `OrganizationKind`. |
| `CLIENT` | Alinhar com `OrganizationKind.CLIENT_WORKSPACE` (redundância controlada até migração única). |

**Decisão pendente (checklist):** manter ambos campos durante transição ou migrar para só `organizationKind`.

### 1.3 `WorkspaceStatus` (existente)

`ACTIVE` | `PAUSED` | `ARCHIVED` — sem mudança semântica.

### 1.4 `Channel` (novo)

`META` | `GOOGLE` | `WEBHOOKS` | `REVENUE` | `REPORTS` — usado em grants e checagem de módulo.

### 1.5 `GrantAssetType` (novo)

| Valor | `externalId` |
|-------|----------------|
| `META_AD_ACCOUNT` | ID da conta de anúncios Meta (ex.: `act_…`) |
| `META_BUSINESS` | `businessId` Meta |
| `GOOGLE_ADS_CUSTOMER` | Customer ID Google |
| `GOOGLE_MCC` | ID manager |
| `WEBHOOK_ENDPOINT` | `WebhookEndpoint.id` interno (cuidado: não expor em URL pública) |

### 1.6 `WebhookEventStatus` (novo)

`received` | `processing` | `processed` | `failed` | `dead_letter`

### 1.7 `MembershipRole` (novo — string canônica ou enum Prisma)

Valores exatos na matriz de permissões (`02`). Ex.: `workspace_admin`, `media_meta_manager`, …

### 1.8 `PlatformAdminLevel` (opcional — ou só env + flag em User)

Se preferir DB: `NONE` | `OWNER` | `ADMIN` | `SUPPORT` em coluna `User.platformAdminLevel`.

---

## 2. Modelo `User` (evolução)

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | String @id @default(cuid()) | |
| `email` | String @unique | Normalizar lowercase no app |
| `password` | String | Hash |
| `name` | String | |
| `firstName` | String? | |
| `suspendedAt` | DateTime? | |
| `mustChangePassword` | Boolean @default(false) | |
| `lastLoginAt` | DateTime? | |
| `platformAdminLevel` | Enum? ou omitir | Se não usar coluna, manter env `PLATFORM_ADMIN_EMAILS` até migração |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |
| `deletedAt` | DateTime? | Soft delete usuário |

**Índices:** `@@index([email])` implícito unique; `@@index([deletedAt])` se filtrar ativos frequentemente.

**Relações:** `Membership[]`, `RefreshToken[]`, `Invitation[]`, `MatrixWorkspaceGrant[]`, `AssetAccessGrant[]`, `AuditLog[]` (como actor), `SavedView[]` (opcional).

---

## 3. Modelo `Organization` (evolução)

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | String @id @default(cuid()) | |
| `organizationKind` | **OrganizationKind** | **Novo** — fonte primária de tipo |
| `name` | String | |
| `slug` | String @unique | |
| `parentOrganizationId` | String? | SetNull on delete pai (avaliar Restrict se quiser impedir delete com filhos) |
| `parentOrganization` | Organization? | self-relation |
| `childOrganizations` | Organization[] | |
| `inheritPlanFromParent` | Boolean @default(true) | Para `CLIENT_WORKSPACE` costuma ser true |
| `planId` | String? | |
| `plan` | Plan? | |
| `workspaceStatus` | WorkspaceStatus | |
| `workspaceNote` | String? @db.Text | |
| `resellerOrgKind` | ResellerOrgKind? | Legado; mirror com `organizationKind` até remoção |
| `legalName` … endereço | como hoje | |
| `featureOverrides` | Json? | |
| `createdAt` / `updatedAt` / `deletedAt` | DateTime | |

**Índices:**

- `@@index([parentOrganizationId])`
- `@@index([organizationKind, deletedAt])`
- `@@index([workspaceStatus])` (opcional, revenda)

**Uniques:** `slug` global (hoje); **decisão:** slug único global vs único entre irmãos — hoje é global; manter até decisão contrária.

**Regras hierárquicas permitidas:**

- `MATRIX` → N filhos `CLIENT_WORKSPACE`.
- `DIRECT` → 0 filhos Organization.
- `CLIENT_WORKSPACE` → 0 filhos Organization (sub-workspace = futuro `ClientAccount`, não nova org).

**Proibido:** `CLIENT_WORKSPACE` com filho `Organization` de qualquer kind que represente novo tenant.

---

## 4. `Membership`

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | String @id @default(cuid()) | |
| `userId` | String | FK User CASCADE |
| `organizationId` | String | FK Organization CASCADE |
| `role` | String ou Enum **MembershipRole** | Valores canônicos obrigatórios |
| `createdAt` / `updatedAt` | DateTime | |

**Unique:** `@@unique([userId, organizationId])`

**Índices:** `@@index([organizationId])`, `@@index([userId])`

**Uso:** papel **dentro daquela org** (matriz ou workspace). Um usuário pode ter várias memberships.

---

## 5. Grants

### 5.1 `MatrixWorkspaceGrant` (novo)

Vincula usuário da **matriz** a um **workspace filho** que pode acessar quando `activeOrganizationId = child.id`.

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | String @id @default(cuid()) | |
| `userId` | String | Quem recebe o acesso |
| `matrixOrganizationId` | String | Org `MATRIX` |
| `workspaceOrganizationId` | String | Org `CLIENT_WORKSPACE` filha da matriz |
| `allowedChannels` | **Channel[]** ou String[] | Vazio = interpretação na política (ver doc 02) |
| `createdAt` / `updatedAt` | DateTime | |
| `createdByUserId` | String? | Auditoria |

**Unique:** `@@unique([userId, workspaceOrganizationId])` — um registro por par usuário×workspace.

**Índices:** `@@index([matrixOrganizationId])`, `@@index([userId])`, `@@index([workspaceOrganizationId])`

**onDelete:** CASCADE em user; Restrict ou CASCADE em org conforme política de exclusão de workspace.

### 5.2 `AssetAccessGrant` (novo)

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | String @id @default(cuid()) | |
| `userId` | String | |
| `organizationId` | String | **Workspace** onde o ativo se aplica |
| `assetType` | GrantAssetType | |
| `externalId` | String | ID na API externa |
| `label` | String? | Nome amigável cacheado |
| `createdAt` | DateTime | |
| `createdByUserId` | String? | |

**Unique:** `@@unique([userId, organizationId, assetType, externalId])`

**Índices:** `@@index([organizationId, assetType])`

### 5.3 `ProjectAccessGrant` / `LaunchAccessGrant` (opcional)

Alternativa: campos `allowedProjectIds Json` / `allowedLaunchIds Json` em `MatrixWorkspaceGrant`.  
**Recomendação:** tabelas N:N se precisar indexar e auditar por linha:

- `ProjectAccessGrant`: `userId`, `organizationId` (workspace), `projectId` — unique composto.
- `LaunchAccessGrant`: idem com `launchId`.

---

## 6. Planos, assinatura, módulos, overrides

### 6.1 `Plan` (evolução)

| Campo | Tipo | Notas |
|-------|------|--------|
| `features` | Json | Chaves estáveis: `marketing`, `webhooks`, `campaign_read`, `campaign_write`, `multi_workspace`, … |
| Demais | como hoje | `maxChildOrganizations` = limite de workspaces cliente |

**Índices:** `@@index([active])`

### 6.2 `Subscription`

Manter 1:1 com `organizationId` **da org billing** (tipicamente `MATRIX` ou `DIRECT`).

**Decisão documentada:** `CLIENT_WORKSPACE` **não** possui `Subscription` própria se o billing for só na matriz; `planId` na filha pode ser espelho ou null com `inheritPlanFromParent`.

### 6.3 `SubscriptionLimitsOverride`

Sem mudança estrutural; aplicar ao org billing efetivo.

### 6.4 `PlanModule` (opcional, fase posterior)

Normalizar módulos se `Json` insuficiente: tabela `Module` + `PlanModule(planId, moduleId, enabled)`.

---

## 7. `Integration` (evolução)

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | String @id | |
| `organizationId` | String | Workspace |
| `clientAccountId` | String? | |
| `platform` | String | ex. `meta`, `google` |
| `slug` | String | único por org |
| `status` | String | `connected` \| `pending` \| `error` \| … |
| `config` | String? ou **Json** | Migrar para Json no Postgres |
| `lastSyncAt` | DateTime? | |
| `lastErrorAt` | DateTime? | opcional |
| `lastErrorMessage` | String? @db.Text | opcional |

**Unique:** `@@unique([organizationId, slug])`

---

## 8. Webhooks

### 8.1 `WebhookEndpoint`

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | String @id | |
| `organizationId` | String | Workspace |
| `name` | String | Label admin |
| `publicSlug` | String | Parte da URL pública; único global ou único por org (**decisão:** `@@unique([organizationId, publicSlug])`) |
| `secretHash` | String | bcrypt/argon do secret |
| `active` | Boolean @default(true) | |
| `createdAt` / `updatedAt` | DateTime | |

**Índices:** `@@index([organizationId])`

### 8.2 `WebhookEvent`

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | String @id | |
| `organizationId` | String | |
| `webhookEndpointId` | String? | |
| `eventKey` | String | Dedupe: hash(workspaceId + source + externalId) ou UUID externo |
| `sourceType` | String | `hotmart`, `custom`, … |
| `processingStatus` | WebhookEventStatus | |
| `occurredAt` | DateTime? | |
| `normalizedPayload` | Json? | Modelo canônico |
| `rawPayload` | Json | |
| `errorMessage` | String? @db.Text | |
| `processedAt` | DateTime? | |
| `retryCount` | Int @default(0) | |

**Unique:** `@@unique([organizationId, eventKey])`

**Índices:** `@@index([organizationId, createdAt])`, `@@index([processingStatus, createdAt])`

### 8.3 `NormalizedInboundEvent` (opcional — segunda tabela)

Se quiser separar ingestão bruta de evento de negócio: `WebhookEvent` = fila; `NormalizedInboundEvent` = domínio (`type`: lead, purchase, …). Fase 2.

---

## 9. Auditoria

### 9.1 `AuditLog` (novo — genérico)

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | String @id | |
| `actorUserId` | String | |
| `organizationId` | String? | Contexto workspace ou matriz |
| `action` | String | `impersonation.start`, `membership.role.change`, … |
| `entityType` | String | |
| `entityId` | String? | |
| `metadata` | Json? | Antes/depois redigido |
| `ip` | String? | |
| `userAgent` | String? | |
| `createdAt` | DateTime @default(now()) | |

**Índices:** `@@index([organizationId, createdAt])`, `@@index([actorUserId, createdAt])`, `@@index([action, createdAt])`

**Migração:** backfill conceitual de `ResellerAuditLog` → `AuditLog` com `entityType` específico; deprecar gradualmente.

---

## 10. Snapshots e materialização

### 10.1 `MetricsSnapshot` (existente)

Manter para cache opaco por `source` + `rangeKey`.

### 10.2 `CampaignSnapshotDaily` (novo — fase operacional leitura)

| Campo | Tipo |
|-------|------|
| `id` | String @id |
| `organizationId` | String |
| `date` | DateTime @db.Date (ou String yyyy-MM-dd) |
| `channel` | String `meta` \| `google` |
| `externalCampaignId` | String |
| `name` | String? |
| `impressions` | BigInt ou Int |
| `clicks` | Int |
| `spendMicros` ou `spendBrl` | conforme padrão monetário |
| `leads` | Int? |
| `purchases` | Int? |
| `purchaseValue` | Decimal? |
| `rawJson` | Json? opcional |
| `updatedAt` | DateTime |

**Unique:** `@@unique([organizationId, date, channel, externalCampaignId])`

**Índices:** `@@index([organizationId, date])`

### 10.3 `AdAccountCache` (novo — catálogo RBAC)

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | String @id | |
| `organizationId` | String | |
| `channel` | String | |
| `externalAccountId` | String | |
| `name` | String? | |
| `status` | String? | |
| `integrationId` | String? | FK Integration |
| `updatedAt` | DateTime | |

**Unique:** `@@unique([organizationId, channel, externalAccountId])`

---

## 11. Demais modelos existentes (sem redefinição completa aqui)

- `ClientAccount`, `Project`, `Launch`, `Goal`, `Dashboard`, `DashboardWidget`, `Invitation`, `RefreshToken`, `MarketingSettings` — manter; evoluir campos em ADR quando necessário.
- `SavedView` (novo): `userId`, `organizationId`, `routeKey`, `name`, `filters Json`.

---

## 12. Diagrama de relações (resumo textual)

```
User ──< Membership >── Organization (MATRIX | DIRECT | CLIENT_WORKSPACE)
User ──< MatrixWorkspaceGrant >── Organization (workspace)
User ──< AssetAccessGrant ──> scoped por organizationId (workspace)

Organization (billing) ── Subscription ── Plan
Organization (workspace) ── Integration, WebhookEndpoint, WebhookEvent, MetricsSnapshot, ...

Organization (MATRIX) ──< Organization (CLIENT_WORKSPACE)
```

---

## 13. Ordem sugerida de migrações Prisma

1. Adicionar `OrganizationKind` com default temporário + script de backfill a partir de `parentOrganizationId` + `resellerOrgKind`.
2. Tornar `Membership.role` enum ou constraint check no Postgres.
3. Criar `MatrixWorkspaceGrant`, `AssetAccessGrant`, `AuditLog`.
4. Webhooks.
5. Snapshots diários + `AdAccountCache`.

---

*Próximo documento: [`02-matriz-permissoes.md`](02-matriz-permissoes.md)*
