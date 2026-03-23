# Contrato completo de APIs (especificação)

**Legenda:**

- **Auth:** `JWT` padrão + header opcional `X-Organization-Id` ou body de contexto (definir um único padrão na implementação).
- **Permissão:** referência a capabilities do doc `02`; `platform` = platform admin; `matrix` = membership na matriz; `workspace` = membership no `activeOrganizationId`.
- **Auditoria:** `Sim` grava `AuditLog` com `action` indicado.

**Códigos de erro sugeridos:** `401` não autenticado; `403` sem permissão (`code: FORBIDDEN_ROLE | FORBIDDEN_SCOPE | FORBIDDEN_PLAN`); `404` não encontrado no escopo; `422` validação; `409` conflito (slug, unique).

---

## 1. Auth e contexto

| Método | Rota | Finalidade | Payload | Retorno | Validações | Permissão | Modelos | Efeitos colaterais | Auditoria |
|--------|------|------------|---------|---------|------------|-----------|---------|-------------------|-----------|
| POST | `/auth/login` | Login | `{ email, password }` | `{ accessToken, refreshToken, user }` | credenciais | Público | User | refresh token | Não |
| POST | `/auth/refresh` | Renovar token | `{ refreshToken }` | tokens | token válido | Público | RefreshToken | rotação opcional | Não |
| POST | `/auth/logout` | Revogar refresh | `{ refreshToken }` | 204 | | JWT | RefreshToken | delete token | Não |
| GET | `/me` | Perfil + orgs acessíveis | — | `{ user, memberships[], platformAdmin?, suggestedOrganizationId? }` | | JWT | Membership, User | | Não |
| GET | `/me/context` | Contexto operacional | query `?organizationId=` opcional | `{ activeOrganizationId, organizationKind, featuresEffective, grantsSummary }` | org pertence ao usuário | JWT + escopo | Organization, Plan, Grants | | Não |
| POST | `/me/active-organization` | Trocar workspace ativo | `{ organizationId }` | `{ activeOrganizationId }` | membership ou matrix grant válido | JWT | Membership, MatrixWorkspaceGrant | atualiza sessão/cookie | Opcional `context.switch` |

---

## 2. Plataforma (`/platform/*`) — já parcialmente existente

Prefixo: autenticação + **platform admin** obrigatório.

| Método | Rota | Finalidade | Payload | Retorno | Permissão | Modelos | Auditoria |
|--------|------|------------|---------|---------|-----------|---------|-----------|
| GET | `/platform/plans` | Listar planos | — | `{ plans[] }` | platform | Plan | Não |
| POST | `/platform/plans` | Criar plano | body plano | `{ plan }` | platform.owner/admin | Plan | Sim `platform.plan.create` |
| PATCH | `/platform/plans/:id` | Atualizar | partial | `{ plan }` | platform | Plan | Sim |
| DELETE | `/platform/plans/:id` | Excluir | — | 204 | platform | Plan | Sim |
| GET | `/platform/organizations` | Listar empresas | query paginação | `{ organizations[] }` | platform | Organization | Não |
| POST | `/platform/organizations` | Criar raiz | body criação | `{ organization }` | platform | Organization, User?, Membership? | Sim |
| PATCH | `/platform/organizations/:id` | Editar | partial | `{ organization }` | platform | Organization | Sim |
| DELETE | `/platform/organizations/:id` | Soft delete | — | 204 | platform | Organization | Sim |
| PATCH | `/platform/organizations/:id/plan` | Atribuir plano | `{ planId }` | org | platform | Organization, Subscription | Sim |
| PATCH | `/platform/organizations/:id/subscription` | Assinatura | body subscription | `{ subscription }` | platform | Subscription | Sim |
| GET | `/platform/subscriptions` | Listar assinaturas | — | `{ subscriptions[] }` | platform | Subscription | Não |
| POST | `/platform/maintenance/sync-subscriptions` | Sync | — | `{ synced }` | platform.owner? | Subscription | Sim |
| GET | `/platform/audit` | Logs globais | query cursor | `{ items[] }` | platform | AuditLog | Não |
| POST | `/platform/impersonate` | Assumir usuário | `{ userId, reason, readOnly? }` | `{ impersonationToken }` | platform.owner/admin | User | **Sim** `impersonation.start` |
| DELETE | `/platform/impersonate` | Encerrar | — | 204 | platform | — | **Sim** `impersonation.end` |

*Rotas existentes de `limits-override` na plataforma seguem o mesmo padrão.*

---

## 3. Revenda / matriz (`/revenda/*` ou `/api/matrix/*`)

Base: usuário com `Membership` na org **MATRIX** e capabilities `matrix.*`.

| Método | Rota | Finalidade | Payload | Retorno | Permissão | Modelos | Auditoria |
|--------|------|------------|---------|---------|-----------|---------|-----------|
| GET | `/matrix/overview` | KPIs carteira | query período | `{ totals, childrenSummary[] }` | agency_owner/admin/finance | Organization, agregados | Não |
| GET | `/matrix/workspaces` | Listar filhos | query status | `{ workspaces[] }` | matrix read | Organization | Não |
| POST | `/matrix/workspaces` | Criar CLIENT_WORKSPACE | `{ name, slug?, planInherited }` | `{ workspace }` | `matrix.child.create` | Organization | Sim |
| PATCH | `/matrix/workspaces/:id` | Pausar/arquivar/nota | partial | `{ workspace }` | `matrix.child.archive` ou write | Organization | Sim |
| GET | `/matrix/users` | Usuários com acesso à matriz | — | `{ users[] }` | agency_admin | Membership | Não |
| POST | `/matrix/grants/workspace` | Criar/atualizar grant | `{ userId, workspaceOrganizationId, allowedChannels[] }` | `{ grant }` | `org.members.role.assign` ou dedicada | MatrixWorkspaceGrant | Sim |
| DELETE | `/matrix/grants/workspace/:id` | Remover grant | — | 204 | idem | MatrixWorkspaceGrant | Sim |
| POST | `/matrix/grants/asset` | Grant conta ads | `{ userId, organizationId, assetType, externalId }` | `{ grant }` | workspace_admin na org alvo **ou** agency_admin com acesso ao filho | AssetAccessGrant | Sim |
| GET | `/matrix/audit` | Auditoria matriz | query | `{ items[] }` | agency_admin | ResellerAuditLog / AuditLog | Não |

*Nota:* prefixo exato (`/revenda` no frontend pode mapear para `/matrix` no backend — alinhar no gateway.*

---

## 4. Workspace — empresas no sentido “marca” (`ClientAccount`)

Base: `activeOrganizationId` = workspace; capability `org.workspace.read` mínimo.

| Método | Rota | Finalidade | Payload | Retorno | Permissão | Modelos | Auditoria |
|--------|------|------------|---------|---------|-----------|---------|-----------|
| GET | `/organizations/:orgId/client-accounts` | Listar marcas | query | `{ items[] }` | workspace | ClientAccount | Não |
| POST | `/organizations/:orgId/client-accounts` | Criar | `{ name }` | `{ item }` | workspace_admin | ClientAccount | Sim |
| PATCH | `/organizations/:orgId/client-accounts/:id` | Editar | partial | `{ item }` | workspace_admin | ClientAccount | Sim |
| DELETE | `/organizations/:orgId/client-accounts/:id` | Soft delete | — | 204 | workspace_admin | ClientAccount | Sim |

`orgId` deve coincidir com `activeOrganizationId` ou ser filho acessível via matriz.

---

## 5. Projetos e lançamentos

| Método | Rota | Finalidade | Payload | Retorno | Permissão | Modelos | Auditoria |
|--------|------|------------|---------|---------|-----------|---------|-----------|
| GET | `/organizations/:orgId/projects` | Listar | query | `{ items[] }` | marketing.read | Project | Não |
| POST | `/organizations/:orgId/projects` | Criar | `{ name, clientAccountId? }` | `{ item }` | workspace_admin | Project | Sim |
| PATCH | `/organizations/:orgId/projects/:id` | Editar | partial | `{ item }` | workspace_admin | Project | Sim |
| DELETE | `/organizations/:orgId/projects/:id` | Soft delete | — | 204 | workspace_admin | Project | Sim |
| GET | `/organizations/:orgId/projects/:projectId/launches` | Listar lançamentos | — | `{ items[] }` | marketing.read | Launch | Não |
| POST | `.../launches` | Criar | `{ name, startDate?, endDate? }` | `{ item }` | workspace_admin | Launch | Sim |
| PATCH | `.../launches/:id` | Editar | partial | `{ item }` | workspace_admin | Launch | Sim |
| DELETE | `.../launches/:id` | Soft delete | — | 204 | workspace_admin | Launch | Sim |

---

## 6. Usuários e convites (workspace)

| Método | Rota | Finalidade | Payload | Retorno | Permissão | Modelos | Auditoria |
|--------|------|------------|---------|---------|-----------|---------|-----------|
| GET | `/organizations/:orgId/members` | Listar | — | `{ members[] }` | org.members.read | Membership, User | Não |
| POST | `/organizations/:orgId/invitations` | Convidar | `{ email, role }` | `{ invitation }` | `org.members.invite` | Invitation | Sim |
| DELETE | `/organizations/:orgId/members/:userId` | Remover | — | 204 | `org.members.remove` | Membership | Sim |
| PATCH | `/organizations/:orgId/members/:userId` | Papel | `{ role }` | `{ member }` | `org.members.role.assign` | Membership | Sim |
| POST | `/organizations/:orgId/members/:userId/suspend` | Suspender | — | 204 | agency_admin ou workspace_admin | User | Sim |
| POST | `/auth/forgot-password` | Reset fluxo | `{ email }` | genérico | público | User | Sim se admin reset |

---

## 7. Integrações

| Método | Rota | Finalidade | Payload | Retorno | Permissão | Modelos | Auditoria |
|--------|------|------------|---------|---------|-----------|---------|-----------|
| GET | `/organizations/:orgId/integrations` | Listar | — | `{ items[] }` mask secrets | `integration.read` | Integration | Não |
| GET | `/integrations/:slug/auth-url` | OAuth Meta/Google | — | `{ url }` | `integration.connect` | — | Não |
| POST | `/organizations/:orgId/integrations/:slug/disconnect` | Desconectar | — | 204 | `integration.disconnect` | Integration | Sim |
| POST | `/organizations/:orgId/integrations/:slug/sync` | Sync manual | — | `{ jobId? }` | `integration.sync` | Integration | Opcional |

*Alinhar com rotas existentes em `/integrations` e `/marketing`.*

---

## 8. Webhooks

| Método | Rota | Finalidade | Payload | Retorno | Permissão | Modelos | Auditoria |
|--------|------|------------|---------|---------|-----------|---------|-----------|
| POST | `/hooks/w/:publicSlug` | Ingestão pública | body + header signature | `202` + `{ eventId }` | HMAC válido | WebhookEvent | Não (interno) |
| GET | `/organizations/:orgId/webhooks/endpoints` | Listar endpoints | — | `{ items[] }` sem secret | `webhook.endpoint.manage` | WebhookEndpoint | Não |
| POST | `/organizations/:orgId/webhooks/endpoints` | Criar | `{ name, publicSlug }` | `{ item, plainSecret? }` once | idem | WebhookEndpoint | Sim |
| PATCH | `.../endpoints/:id` | Ativar/desativar | `{ active }` | `{ item }` | idem | WebhookEndpoint | Sim |
| GET | `/organizations/:orgId/webhooks/events` | Logs | query cursor, status | `{ items[] }` | `webhook.event.read` | WebhookEvent | Não |
| POST | `/organizations/:orgId/webhooks/events/:id/replay` | Reprocessar | — | `{ item }` | `webhook.event.replay` | WebhookEvent | Sim |

---

## 9. Marketing (leitura / agregados)

Todas exigem `activeOrganizationId` e capabilities `marketing.*` + canal conforme grant.

| Método | Rota | Finalidade | Payload | Retorno | Permissão | Modelos | Auditoria |
|--------|------|------------|---------|---------|-----------|---------|-----------|
| GET | `/marketing/summary` | KPIs rápidos | query `startDate,endDate,compare?` | `{ summary, derived }` | `marketing.summary.read` | APIs Meta/Google + cache | Não |
| GET | `/marketing/detail/campaigns` | Tabela campanhas | query filtros + page | `{ rows[], page }` | `marketing.detail.read` | Snapshot/API | Não |
| GET | `/marketing/timeseries` | Série diária | query | `{ points[] }` | idem | Timeseries | Não |
| GET | `/marketing/funnel` | Funil agregado | query | `{ steps[], transitions[] }` | idem | Summary | Não |

*Rotas atuais do dashboard agregado (`/marketing-dashboard` ou similar) devem ser consolidadas ou documentadas como legado com mapeamento 1:1.*

---

## 10. Marketing escrita (fase posterior)

| Método | Rota | Finalidade | Payload | Retorno | Permissão | Modelos | Auditoria |
|--------|------|------------|---------|---------|-----------|---------|-----------|
| PATCH | `/marketing/meta/campaigns/:externalId/status` | Ativar/pausar | `{ status }` | `{ ok }` | `media.meta.campaign.status` + asset grant | API Meta | **Sim** |
| PATCH | `/marketing/meta/campaigns/:externalId/budget` | Orçamento | `{ dailyBudget? }` | `{ ok }` | `media.meta.campaign.budget` | API Meta | **Sim** |

Paralelo `/marketing/google/...`.

---

## 11. Metas e alertas

| Método | Rota | Finalidade | Payload | Retorno | Permissão | Modelos | Auditoria |
|--------|------|------------|---------|---------|-----------|---------|-----------|
| GET | `/organizations/:orgId/marketing-settings` | Ler metas | — | `{ settings }` | marketing.read | MarketingSettings | Não |
| PATCH | `/organizations/:orgId/marketing-settings` | Atualizar | partial thresholds | `{ settings }` | workspace_admin | MarketingSettings | Sim |
| GET | `/organizations/:orgId/alerts/insight` | Insight atual | query período | `{ alerts[] }` | marketing.read | compute | Não |

---

## 12. Validações transversais

1. **Escopo:** `organizationId` na URL == `activeOrganizationId` **ou** usuário é matriz com grant ao filho.
2. **Plano:** antes da handler, `assertModule(feature)` usando plano efetivo (matriz + override).
3. **Rate limit:** webhooks e login separados.
4. **PII:** não retornar `ativaCrmApiToken` em GET; usar máscara.

---

*Próximo: [`04-plano-fases-implementacao.md`](04-plano-fases-implementacao.md)*
