# Decisões fechadas — consolidadas para implementação (Fase 1)

Este documento **congela** as decisões abertas do pacote técnico. Toda implementação e migração de dados deve seguir isto.

## 1. Organization

- Tabela única `Organization`.
- Campo **`organizationKind`** (`OrganizationKind`) é a **fonte primária** de tipo.
- **`resellerOrgKind`** permanece só como legado; novos fluxos usam `organizationKind` (espelho opcional até remoção futura).

## 2. OrganizationKind

- `MATRIX` — matriz/agência pagante; pode ter filhos `CLIENT_WORKSPACE`.
- `DIRECT` — empresa final sem agência acima; **não** cria filhos `Organization`.
- `CLIENT_WORKSPACE` — workspace de cliente; **não** cria filhos `Organization`.

## 3. Hierarquia

- `MATRIX` → pode criar apenas filhos com `organizationKind = CLIENT_WORKSPACE`.
- `DIRECT` → não cria filhos.
- `CLIENT_WORKSPACE` → não cria filhos.
- **Proibido** “agência dentro de agência” (validação no backend).

## 4. Subscription

- `Subscription` existe **somente** na organização **pagante**: `MATRIX` ou `DIRECT`.
- `CLIENT_WORKSPACE` **não** possui linha de `Subscription`; herda plano efetivo da matriz via `inheritPlanFromParent` + `resolveBillingOrganizationId` (já recursivo).

## 5. Grants de workspace (MatrixWorkspaceGrant)

- `agency_owner` e `agency_admin` na matriz **sem** linhas explícitas = acesso a **todos** os workspaces filhos.
- `agency_ops` na matriz **sem** linhas = acesso a **nenhum** workspace filho (até criar grant).

## 6. AssetAccessGrant

- `agency_owner`, `agency_admin`, `workspace_owner`, `workspace_admin`: sem grants de conta = acesso **total** às contas daquele workspace (para o canal operado).
- `media_meta_manager`, `media_google_manager`, `performance_analyst`: sem grants explícitos = **zero** contas naquele canal (bloqueio até configurar grants).

## 7. Capabilities

- Strings estáveis no código (ex.: `marketing.summary.read`).
- **Sem** tabela `Capability` nesta fase.

## 8. activeOrganizationId

- Mecanismo principal: **`POST /api/auth/me/active-organization`** (alias de **`POST /api/auth/switch-organization`**).
- Contexto resumido: **`GET /api/auth/me/context`** (plano efetivo, `billingOrganizationId`, `organizationKind`, memberships).
- Backend valida membership + grants e **reemite JWT** (access + refresh) com `organizationId` atualizado.
- **Não** confiar apenas em header `X-Organization-Id` enviado pelo cliente para autorização.

## 9. Webhooks (decisão de produto; **não implementado na Fase 1**)

- Múltiplos endpoints por workspace.
- Rota pública futura: `POST /hooks/w/:publicSlug`.

## 10. Impersonation (decisão de produto; **implementação mínima na Fase 1**)

- Apenas `platform_owner` e `platform_admin` (lista/env existente).
- Duração máxima **30 minutos**; padrão **read-only**; **auditoria obrigatória** com motivo.
- **Entrega Fase 1:** modelo `AuditLog` + helper; endpoint de impersonation **pode** ser Fase 1b ou início Fase 2 — ver nota no resumo de implementação.

---

*Última atualização: alinhado à implementação Fase 1 do backend.*
