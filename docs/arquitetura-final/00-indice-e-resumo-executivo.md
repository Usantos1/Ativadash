# Pacote técnico executável — Índice e resumo executivo

**Objetivo deste pacote:** definir o que será codificado **depois**, com critérios de aceite e contratos explícitos — **sem implementação neste momento**.

**Documento-mãe:** [`../ARQUITETURA-SAAS-PREMIUM.md`](../ARQUITETURA-SAAS-PREMIUM.md)

| # | Arquivo | Conteúdo |
|---|---------|-----------|
| 00 | `00-indice-e-resumo-executivo.md` | Este arquivo |
| — | [`DECISOES-FECHADAS-FASE1.md`](DECISOES-FECHADAS-FASE1.md) | **Decisões congeladas** para implementação (org, subscription, grants, contexto) |
| — | [`FASE1-IMPLEMENTACAO.md`](FASE1-IMPLEMENTACAO.md) | **Entrega Fase 1** no backend (migrations, APIs, autorização, testes) |
| 01 | [`01-schema-prisma-dominio.md`](01-schema-prisma-dominio.md) | Schema Prisma alvo: modelos, campos, índices, relações, regras |
| 02 | [`02-matriz-permissoes.md`](02-matriz-permissoes.md) | RBAC, capabilities, grants, casos de uso |
| 03 | [`03-contrato-apis.md`](03-contrato-apis.md) | Endpoints: método, payload, resposta, permissão, auditoria |
| 04 | [`04-plano-fases-implementacao.md`](04-plano-fases-implementacao.md) | Roadmap por fase com dependências e aceite |
| 05 | [`05-especificacao-telas.md`](05-especificacao-telas.md) | Critérios por rota de frontend |
| 06 | [`06-regras-metricas.md`](06-regras-metricas.md) | Estados de KPI e fontes de dados |
| 07 | [`07-checklist-pre-coding.md`](07-checklist-pre-coding.md) | Gate antes de abrir PR de implementação |

---

## Resumo executivo

### O que já está maduro para virar código (após aprovação do checklist)

- **Tenancy conceitual:** matriz → workspaces `CLIENT`; empresa direta = org única; proibição de agência dentro de agência (já alinhado ao doc-mãe).
- **Modelo atual no repo** como baseline: `Organization`, `Plan`, `Subscription`, `Membership`, `Integration`, `ClientAccount`, `Project`, `Launch`, `MarketingSettings`, `MetricsSnapshot`, `ResellerAuditLog`.
- **Direção de produto** para telas e métricas (dashboard, marketing, funil, receita) já descrita no doc-mãe e detalhada em `05` e `06`.

### O que ainda está indefinido ou precisa decisão explícita antes de migrar banco

1. **Nomenclatura vs migração:** manter uma única tabela `Organization` com `organizationKind` + `resellerOrgKind` ou renomear conceitualmente só na API (`kind` derivado). Impacta migração de dados existentes e queries.
2. **Onde mora o “billing”:** hoje `Subscription` é 1:1 com `Organization`. Se workspace `CLIENT` **não** tiver assinatura própria (herda matriz), regras de `Subscription` na filha devem ser formalizadas (null vs shadow row).
3. **Grants “sem linhas” = acesso total ou proibido?** Para `agency_owner`/`workspace_owner`, convencionar: ausência de `MatrixWorkspaceGrant` significa **acesso a todos os filhos** da matriz (recomendado no doc 02); para gestores restritos, exigir linhas explícitas.
4. **Capabilities string vs tabela:** usar strings estáveis (`media.meta.campaign.pause`) com enum no código vs tabela `Capability` no banco (versionamento mais fácil).
5. **Webhook assinatura e multi-endpoint:** um slug por workspace vs múltiplos endpoints nomeados (prod/test); rota pública exata.
6. **Materialização:** quais métricas entram em `MetricsSnapshot` vs novas tabelas `*SnapshotDaily` na primeira onda (custo de storage vs latência).
7. **Impersonation:** duração máxima, escopo (só leitura opcional), notificação ao usuário alvo.

### Riscos principais se implementar fora de ordem

| Risco | Consequência | Mitigação |
|-------|--------------|-----------|
| CRUD de telas antes de `activeOrganizationId` + checagem servidor | Vazamento cross-tenant | Fase 1 obrigatória: contexto + middleware |
| Integrações/webhooks antes de RBAC | Endpoints públicos ou excesso de confiança | Webhook com secret + allowlist IP opcional; leitura de integração amarrada a grants |
| Escrita Meta/Google antes de AssetAccessGrant | Qualquer membro altera qualquer conta | Fase de grants antes de Fase escrita |
| Múltiplas fontes de verdade para KPI | Números divergentes entre dashboard e marketing | Doc `06` + uma “fonte primária” por KPI na implementação |

### Primeira fase de implementação recomendada (após checklist verde)

**Fase A — Núcleo de tenancy e autorização (não é “tela bonita”):**

1. Introduzir enum `OrganizationKind` (ou equivalente) + validação de hierarquia no serviço de criação/atualização de org.
2. Contexto de requisição: `activeOrganizationId` validado contra `Membership` + grants de matriz.
3. Canonizar `Membership.role` (migração de dados + default).
4. Tabelas mínimas: `MatrixWorkspaceGrant` (ou nome definido no schema 01) + `AssetAccessGrant` + `AuditLog` genérico (ou extensão de `ResellerAuditLog`).
5. Endpoint `GET /me/context` e `POST /me/active-organization` (nomes finais no doc 03).

Até aqui, **nenhuma** feature nova de marketing é obrigatória; apenas endurecer o que já existe.

---

## Leitura recomendada na ordem

1. `07-checklist-pre-coding.md` — o que aprovar  
2. `01-schema-prisma-dominio.md` — o que migrar  
3. `02-matriz-permissoes.md` — como autorizar  
4. `03-contrato-apis.md` — o que expor  
5. `04-plano-fases-implementacao.md` — em que ordem  
6. `05` + `06` — produto e dados nas telas  

---

*Este pacote não substitui ADRs pontuais para decisões fechadas acima (billing na filha, capabilities em tabela, etc.).*
