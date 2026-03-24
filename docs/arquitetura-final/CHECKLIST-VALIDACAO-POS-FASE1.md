# Checklist de validação pós–Fase 1

Use após `prisma migrate deploy` e deploy da API. Objetivo: confirmar tenancy, grants, contexto e tabelas novas.

---

## 1. Endpoints HTTP (com Bearer do usuário de teste)

| Objetivo | Método e rota | Esperado |
|----------|----------------|----------|
| Saúde | `GET /api/health` | `200`, `status: ok` |
| Contexto ativo | `GET /api/auth/me/context` | `200`, `activeOrganizationId`, `organizationKind`, `billingOrganizationId`, `plan`, `memberships[].organizationKind` |
| Perfil | `GET /api/auth/me` | `200` se JWT + membership válidos; `403` se contexto inválido |
| Troca de contexto | `POST /api/auth/me/active-organization` body `{ "organizationId": "<id>" }` | `200`, novos `accessToken`/`refreshToken`, `user.organizationId` atualizado |
| Alias troca | `POST /api/auth/switch-organization` (mesmo body) | Igual ao anterior |
| Grants matriz | `GET /api/reseller/grants/matrix-workspace` (usuário admin da matriz) | `200`, `{ grants: [...] }` |
| Marketing (tenancy) | `GET /api/marketing/google-ads/metrics?startDate=...&endDate=...` | Sem developer token: `200` com `ok: false`, `code: pending_configuration` ou `api_not_ready` (sem tempestade de logs no servidor) |

**cURL (troca de contexto):**

```bash
curl -s -X POST "https://api.SEU_DOMINIO/api/auth/me/active-organization" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"ID_DA_ORG_DESTINO"}'
```

---

## 2. SQL no PostgreSQL (tabelas e invariantes)

Ajuste `ativa_dash` / usuário conforme o seu `.env`.

```sql
-- Tabelas Fase 1 existem
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('MatrixWorkspaceGrant', 'AssetAccessGrant', 'AuditLog');

-- organizationKind preenchido
SELECT "organizationKind", COUNT(*) FROM "Organization" GROUP BY 1;

-- Workspaces cliente sem assinatura própria
SELECT o.id, o.slug, s.id AS subscription_id
FROM "Organization" o
LEFT JOIN "Subscription" s ON s."organizationId" = o.id
WHERE o."organizationKind" = 'CLIENT_WORKSPACE';

-- Constraint única de Integration (upsert Prisma)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'Integration';

-- Duplicatas que quebrariam o upsert (deve retornar 0 linhas)
SELECT "organizationId", slug, COUNT(*)
FROM "Integration"
GROUP BY 1, 2
HAVING COUNT(*) > 1;

-- Papéis canônicos (amostra)
SELECT role, COUNT(*) FROM "Membership" GROUP BY 1 ORDER BY 2 DESC;
```

---

## 3. Comportamento esperado da troca de contexto

1. O JWT passa a carregar o `organizationId` escolhido (payload + novo access token).
2. `GET /api/auth/me/context` reflete o mesmo `activeOrganizationId` e recalcula `billingOrganizationId` (herança da matriz para `CLIENT_WORKSPACE`).
3. `AuditLog` deve registrar `action = session.active_organization.changed` com `metadata.fromOrganizationId` / `toOrganizationId` (troca real, não no-op).
4. Rotas com `requireJwtOrganizationAccess` retornam `403` se o usuário perder acesso ao tenant do JWT (ex.: remoção de membership), forçando novo login ou nova troca válida.

---

## 4. Tenancy e grants

| Cenário | Como testar | Esperado |
|---------|-------------|----------|
| Membro direto do workspace | Login com usuário com `Membership` na org ativa | Acesso a rotas do workspace. |
| `agency_owner` / `agency_admin` na matriz, sem linhas em `MatrixWorkspaceGrant` | JWT no workspace filho | Acesso a qualquer filho da matriz. |
| `agency_ops` na matriz, sem grants | JWT tentando org filha | `403` em rotas protegidas; após `POST .../grants/matrix-workspace` com grant para aquele workspace, troca de contexto permitida. |
| Hierarquia inválida | API de criação de filho com pai não-MATRIX | Erro claro do serviço (não cria org). |

**SQL (grants):**

```sql
SELECT * FROM "MatrixWorkspaceGrant" ORDER BY "createdAt" DESC LIMIT 20;
```

---

## 5. Google Ads sem Developer Token

- Respostas JSON com `ok: false` e `code` ∈ `pending_configuration` | `api_not_ready`.
- Painel: `integrationStatus.googleAds.status` alinhado (`pending_configuration` se OAuth conectado mas sem token no servidor; `api_not_ready` se `GOOGLE_ADS_UX_PENDING`).
- Logs: sem `console.error` repetitivo para esses estados; falhas classificadas da API com throttle de aviso.

---

## 6. Erro `public.User does not exist` (PostgreSQL)

- **Causa típica:** `search_path` ou `schema` da URL não é `public`, ou migrações não rodaram nesse banco.
- **No código deste repositório:** não há `queryRaw` contra `"User"`; o Prisma Client usa o modelo `User` → tabela `"User"` no schema do `DATABASE_URL`.
- **Verificação:**

```sql
SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'User';
SHOW search_path;
```

Se a tabela existir em `public` e o erro persistir, confira se algum cliente externo (BI, DBeaver, outro serviço) usa SQL sem aspas (`User` é palavra reservada → use `"User"`).

---

## 7. Alertas customizados e ocorrências (pós-integração motor de insights)

| Objetivo | Método e rota | Esperado |
|----------|----------------|----------|
| Histórico de disparos | `GET /api/marketing/alert-occurrences?limit=30` | `200`, `{ items: [...] }` por tenant; cada item com `ruleName`, `createdAt`, `message` |
| Plano sem edição de mídia | `PATCH` status/orçamento Meta ou Google com `campaignWrite: false` no plano efetivo | `403`, mensagem sobre plano |

**SQL (tabelas):**

```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('AlertRule', 'AlertOccurrence');
```

---

*Última revisão: estabilização pós-Fase 1 (Google Ads readiness + integração + checklist).*
