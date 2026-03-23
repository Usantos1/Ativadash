# Checklist final — antes de começar a codar a fundação

Marque explicitamente (time + responsável + data). Itens **bloqueantes** impedem início da Fase 1 de implementação.

---

## B — Bloqueante | R — Recomendado

### Schema e dados

| ID | Item | B/R |
|----|------|-----|
| S1 | `OrganizationKind` (ou equivalente) definido e regra de backfill para orgs existentes aprovada | B |
| S2 | Política de `Subscription` na filha `CLIENT_WORKSPACE` (herda vs linha própria) fechada | B |
| S3 | Lista final de enums Prisma novos vs strings temporárias | B |
| S4 | Estratégia migração `Membership.role` (mapa legado → canônico) | B |
| S5 | `MatrixWorkspaceGrant` semântica “vazio = todos” apenas para owner/admin documentada e aceita | B |
| S6 | `AssetAccessGrant` política A/B (restritiva vs permissiva por papel) escolhida | B |
| S7 | Webhook: formato URL pública, assinatura HMAC, rotação de secret | B |
| S8 | Tabelas snapshot diário: quais KPIs na v1 | R |

### RBAC e segurança

| ID | Item | B/R |
|----|------|-----|
| R1 | Lista fechada de `Capability` v1 (strings) | B |
| R2 | Matriz papel → capabilities default aprovada | B |
| R3 | Comportamento platform admin fora de `/platform` (proibido vs impersonation only) | B |
| R4 | Auditoria: ações mínimas obrigatórias e retenção | B |
| R5 | Impersonation: duração, read-only opcional, notificação | R |

### Rotas e API

| ID | Item | B/R |
|----|------|-----|
| A1 | Padrão único: `X-Organization-Id` vs body vs cookie para `activeOrganizationId` | B |
| A2 | Prefixo backend `/matrix` vs `/revenda` alinhado ao frontend | B |
| A3 | Mapeamento rotas legadas → rotas alvo (deprecação) documentado | R |
| A4 | Códigos de erro estáveis (`FORBIDDEN_SCOPE`, …) | R |

### Fases e escopo

| ID | Item | B/R |
|----|------|-----|
| F1 | Ordem das fases aceita pelo time (`04-plano-fases-implementacao.md`) | B |
| F2 | O que fica explicitamente **fora** do Q1/Q2 | R |

### Telas e produto

| ID | Item | B/R |
|----|------|-----|
| T1 | Glossário “cliente da agência” vs “marca no workspace” publicado na equipe | B |
| T2 | Aceite por tela priorizado (MVP vs fase 7) | R |

### Métricas

| ID | Item | B/R |
|----|------|-----|
| M1 | Doc `06-regras-metricas.md` assinado por produto + eng | B |
| M2 | Lista KPI com fonte primária exportada (planilha ou tabela no repo) | R |

### Plano e limites

| ID | Item | B/R |
|----|------|-----|
| P1 | Chaves `Plan.features` oficiais para módulos v1 | B |
| P2 | Comportamento ao exceder `maxUsers` / `maxChildOrganizations` (hard block vs soft) | B |

### Hierarquia de orgs

| ID | Item | B/R |
|----|------|-----|
| H1 | Validação servidor: tipos de filhos permitidos por `organizationKind` | B |
| H2 | Testes automatizados mínimos para hierarquia proibida | R |

---

## Aprovação formal

- [ ] Product owner — data: ____  
- [ ] Tech lead backend — data: ____  
- [ ] Tech lead frontend — data: ____  
- [ ] Segurança/revisão — data: ____ (se aplicável)  

---

## Após checklist verde

1. Criar branch `feat/tenancy-phase-1` (ou nome acordado).  
2. Primeiro PR: migrações Prisma + middleware contexto + testes — **sem** novas telas cosméticas.  
3. Segundo PR: grants API + ajuste `/me/context`.  

---

*Índice: [`00-indice-e-resumo-executivo.md`](00-indice-e-resumo-executivo.md)*
