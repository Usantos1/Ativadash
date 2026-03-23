# Plano de implementação em fases (ordem segura)

**Regra:** nenhuma fase depende de telas “bonitas” para fechar; dependências são **backend-first** onde o risco é segurança ou consistência.

---

## Fase 1 — Tenancy, auth de contexto, papéis e grants (fundação)

| Item | Detalhe |
|------|---------|
| **Objetivo** | Impossibilitar vazamento de dados entre workspaces; base para todo o restante. |
| **Models** | `Organization.organizationKind` (ou backfill lógico), `Membership.role` canônico, `MatrixWorkspaceGrant`, `AssetAccessGrant`, `AuditLog` (mínimo). |
| **Endpoints** | `GET/PATCH /me/context`, `POST /me/active-organization`; CRUD grants sob `/matrix/grants/*`; endurecimento em **todas** as rotas existentes que usam `organizationId`. |
| **Páginas afetadas** | Seletor de workspace (header/layout); `/revenda` lista de filhos; login redirect com org sugerida. |
| **Dependências** | Nenhuma além do schema atual + migrações. |
| **Critérios de aceite** | Testes automatizados: usuário A não lê dados org B; gestor com grant parcial não lista filho não autorizado; troca de contexto gera log opcional. |
| **O que não pode quebrar** | Login, dashboard atual para tenant único (DIRECT), integrações OAuth já conectadas. |

**Não incluir:** webhooks novos, escrita Meta, novas telas de marketing.

---

## Fase 2 — Plataforma + revenda alinhadas ao novo RBAC

| Item | Detalhe |
|------|---------|
| **Objetivo** | Operações de matriz e plataforma respeitam auditoria e papéis; criar workspace filho valida `OrganizationKind` e limites do plano. |
| **Models** | `Subscription` / `Plan` leitura para enforcement; possível `AuditLog` backfill de `ResellerAuditLog`. |
| **Endpoints** | Unificar respostas de `/platform/*` e `/matrix/*` com checagem de capability; criar workspace com validação `maxChildOrganizations`. |
| **Páginas** | `/plataforma`, `/revenda/*` (tabs existentes). |
| **Dependências** | **Fase 1** concluída. |
| **Critérios de aceite** | Criar CLIENT_WORKSPACE bloqueado se plano esgotou limite; arquivar filho impede login no workspace; auditoria em mudanças sensíveis. |
| **O que não pode quebrar** | Fluxo atual de criação de org na plataforma admin. |

---

## Fase 3 — Integrações (consolidação) + Webhooks MVP

| Item | Detalhe |
|------|---------|
| **Objetivo** | Hub técnico confiável: múltiplas integrações por workspace; entrada de eventos com dedupe. |
| **Models** | `WebhookEndpoint`, `WebhookEvent`; evolução `Integration.config` para Json. |
| **Endpoints** | Seção 8 do contrato APIs; ingestão pública com assinatura. |
| **Páginas** | `/marketing/integracoes` (abas Webhooks + status). |
| **Dependências** | **Fase 1** (escopo workspace); **Fase 2** opcional para matriz gerir filhos. |
| **Critérios de aceite** | Replay não duplica negócio; secret nunca retornado em GET; 401/403 em endpoints admin. |
| **O que não pode quebrar** | Meta/Google OAuth existentes. |

---

## Fase 4 — Marketing leitura (performance, summary/detail, materialização opcional)

| Item | Detalhe |
|------|---------|
| **Objetivo** | Latência previsível; separação summary vs detail; filtros por conta conforme `AssetAccessGrant`. |
| **Models** | `MetricsSnapshot` uso padronizado; opcional `CampaignSnapshotDaily` + `AdAccountCache`. |
| **Endpoints** | `GET /marketing/summary`, `GET /marketing/detail/*`, `GET /marketing/timeseries` — alinhados ao doc métricas. |
| **Páginas** | `/dashboard`, `/marketing`, `/marketing/captacao`, `/marketing/conversao`, `/marketing/receita`. |
| **Dependências** | **Fase 1** obrigatória; **Fase 3** para KPIs que misturam webhook. |
| **Critérios de aceite** | Estados vazios/indisponível conforme `06-regras-metricas.md`; sem loader full-page; skeleton por bloco. |
| **O que não pode quebrar** | Agregados atuais do dashboard para usuários sem grants (comportamento DIRECT). |

---

## Fase 5 — Marketing escrita (campanhas Meta, depois Google)

| Item | Detalhe |
|------|---------|
| **Objetivo** | Substituir parte do Ads Manager com segurança. |
| **Models** | Logs em `AuditLog`; opcional fila `OutboundMutation` (futuro). |
| **Endpoints** | `PATCH` status/budget/create conforme contrato; idempotência onde API externa permitir. |
| **Páginas** | `/marketing` tabela com ações; confirmações e toasts. |
| **Dependências** | **Fase 1** (asset grants); **Fase 4** (leitura estável); módulo plano `campaign_write`. |
| **Critérios de aceite** | Usuário sem grant de conta recebe 403; cada mutação auditada; rollback mensagem clara da API Meta. |
| **O que não pode quebrar** | Leitura só. |

---

## Fase 6 — Relatórios, alertas avançados, automações

| Item | Detalhe |
|------|---------|
| **Objetivo** | `AlertRule` / `AlertOccurrence`, relatórios agendados, presets. |
| **Models** | Novas tabelas de regras; possível `ScheduledReport`. |
| **Endpoints** | CRUD regras; histórico de alertas; export agendado. |
| **Páginas** | `/marketing/configuracoes`, evolução metas. |
| **Dependências** | Fases 4–5 estáveis. |
| **Critérios de aceite** | Mute por horário; severidade; entrega WhatsApp existente respeitada. |

---

## Fase 7 — Polimento produto (clientes/projetos/lançamentos/carteira)

| Item | Detalhe |
|------|---------|
| **Objetivo** | Cobrir especificação de telas `05` com KPIs por marca/projeto; cockpit de lançamento. |
| **Models** | Enriquecimento `ClientAccount`, `Project`, `Launch`; `SavedView`. |
| **Endpoints** | Agregados por `clientAccountId`, `projectId`, `launchId`. |
| **Páginas** | `/clientes`, `/projetos`, `/lancamentos`, `/configuracoes`, `/equipe`. |
| **Dependências** | Fase 4 para números; Fase 1 para escopo. |

---

## Ordem visual resumida

1. Tenancy + RBAC + contexto  
2. Plataforma + revenda + limites  
3. Integrações + webhooks  
4. Marketing leitura + métricas  
5. Marketing escrita  
6. Alertas/relatórios/automação  
7. Demais telas operacionais premium  

---

## O que explicitamente fica fora até Fase 1 aprovada

- Novos CRUDs apenas no frontend  
- Conectar terceiros (pagamentos) sem modelo de evento  
- Bulk actions em massa na Meta  

---

*Próximo: [`05-especificacao-telas.md`](05-especificacao-telas.md)*
