# Matriz de permissões completa (RBAC + grants)

**Convenções:**

- **Papel** (`Membership.role`): define o **teto** de capabilities naquela organização.
- **Grant de matriz** (`MatrixWorkspaceGrant`): para usuários cuja membership é na **MATRIX**, restringe **quais workspaces filhos** podem ser selecionados como `activeOrganizationId`.
- **Grant de ativo** (`AssetAccessGrant`): restringe contas Meta/Google **dentro do workspace ativo**.
- **Grant de projeto/lançamento** (opcional): refinamento adicional para dados filtrados no marketing.
- **Módulo do plano** (`Plan.features`): se desligado, capability é negada mesmo com papel.
- **Platform admin:** bypass **somente** para rotas `/platform/*` e ações explicitamente listadas; sempre com `AuditLog`.

**Política para grants vazios (decisão fechada para implementação):**

| Contexto | Sem linhas em `MatrixWorkspaceGrant` | Com uma ou mais linhas |
|----------|--------------------------------------|-------------------------|
| Usuário com role `agency_owner` ou `agency_admin` na MATRIX | Acesso a **todos** os workspaces filhos ativos | **Interseção:** só workspaces listados (útil para delegação restrita) |
| Usuário com role `agency_ops` na MATRIX | **Nenhum** workspace até criar grant | Só os listados |
| `workspace_owner` em um CLIENT_WORKSPACE | N/A (opera só na org da membership) | N/A |

*Ajuste fino:* se `agency_ops` com zero grants deve significar “nenhum acesso”, documentar no onboarding de equipe.

---

## 1. Papéis da plataforma

Não são `Membership` em `Organization`; são flag em `User` ou lista env.

| Papel | Onde atua | Visão | Criação/edição |
|-------|-----------|-------|----------------|
| `platform_owner` | `/plataforma` | Tudo | Planos, empresas raiz, assinaturas, módulos, impersonation |
| `platform_admin` | `/plataforma` | Idem owner exceto gestão de outros platform owners (opcional) | Idem |
| `platform_support` | `/plataforma` limitado | Leitura + ações de suporte (reset senha?, ver logs) sem alterar billing sensível | Definir lista fechada |

**Auditoria:** toda ação mutável em `/plataforma` → `AuditLog` com `action` prefixado `platform.`.

---

## 2. Papéis da matriz (agência) — `Membership` na org `MATRIX`

| Papel | Workspaces filhos | Billing/planos na matriz | Usuários da matriz | Revenda |
|-------|-------------------|----------------------------|---------------------|---------|
| `agency_owner` | Todos (se grants vazios) ou interseção com grants | Ver + solicitar mudança via plataforma (se aplicável) | CRUD completo + papéis | Full |
| `agency_admin` | Idem owner (exceto transferência de posse se existir) | Leitura | CRUD usuários/grants | Full operacional |
| `agency_finance` | Leitura agregada (KPIs carteira) sem operar mídia | Leitura | Leitura | Relatórios |
| `agency_ops` | **Apenas** workspaces com `MatrixWorkspaceGrant` | Sem | Sem | Operação nos filhos permitidos |

---

## 3. Papéis do workspace — `Membership` na org `CLIENT_WORKSPACE` ou `DIRECT`

| Papel | Dados marketing | Integrações | Webhooks | Usuários do workspace | Clientes (marcas) | Projetos/Lançamentos |
|-------|-----------------|-------------|----------|----------------------|-------------------|----------------------|
| `workspace_owner` | Tudo | Tudo | Tudo | CRUD | CRUD | CRUD |
| `workspace_admin` | Tudo | Tudo | Tudo | CRUD exceto remover owner | CRUD | CRUD |
| `media_meta_manager` | Meta: leitura+escrita (se módulo) | Meta: configurar | Ver se canal WEBHOOKS | — | Leitura opcional | Filtrar por grant |
| `media_google_manager` | Google: idem | Google | Ver | — | Leitura opcional | Filtrar |
| `performance_analyst` | Leitura todos canais permitidos por grant | Leitura | Leitura | — | Leitura | Leitura |
| `report_viewer` | Só relatórios/dashboards agregados | Sem tokens | Sem | — | Sem | Sem |
| `sales_viewer` | Leitura receita/leads agregados (definir escopo) | Sem | Sem | — | Leitura | Leitura |

**Nota:** escrita em campanha exige capability explícita + módulo `campaign_write` + `AssetAccessGrant` para a conta alvo (Meta/Google).

---

## 4. Capabilities atômicas (lista mínima v1)

Formato estável `domínio.recurso.ação`.

### 4.1 Organização e equipe

| Capability | Descrição |
|------------|-----------|
| `org.workspace.read` | Ver dados do workspace ativo |
| `org.workspace.write` | Editar nome, branding, timezone |
| `org.members.invite` | Convidar usuário |
| `org.members.remove` | Remover membro |
| `org.members.role.assign` | Alterar papel |
| `matrix.child.create` | Criar workspace cliente (só MATRIX) |
| `matrix.child.archive` | Arquivar workspace filho |

### 4.2 Integrações

| Capability | Descrição |
|------------|-----------|
| `integration.read` | Listar integrações |
| `integration.connect` | OAuth / conectar |
| `integration.disconnect` | Revogar |
| `integration.sync` | Forçar sync |

### 4.3 Webhooks

| Capability | Descrição |
|------------|-----------|
| `webhook.endpoint.manage` | CRUD endpoint |
| `webhook.event.read` | Ver logs |
| `webhook.event.replay` | Reprocessar |

### 4.4 Marketing leitura

| Capability | Descrição |
|------------|-----------|
| `marketing.summary.read` | KPIs resumidos |
| `marketing.detail.read` | Tabelas/breakdown |
| `marketing.export` | Exportar CSV/PDF |

### 4.5 Marketing escrita (Meta/Google)

| Capability | Descrição |
|------------|-----------|
| `media.meta.campaign.read` | Listar/detalhe |
| `media.meta.campaign.status` | Ativar/pausar |
| `media.meta.campaign.budget` | Editar orçamento |
| `media.meta.campaign.duplicate` | Duplicar |
| `media.meta.campaign.create` | Criar |
| `media.google.campaign.*` | Paralelo Google |

**Mapeamento papel → capabilities default** (implementação em código ou tabela `RoleDefaultCapability`):

- `report_viewer` → só `marketing.summary.read` + subset receita
- `media_meta_manager` → todas `media.meta.*` permitidas pelo plano + `marketing.*.read` em Meta
- `workspace_admin` → todas exceto `platform.*`

---

## 5. Quem vê o quê (matriz de visão)

| Ator | Dashboard workspace A | Marketing workspace A | Revenda | Plataforma |
|------|------------------------|----------------------|---------|------------|
| Gestor com grant só workspace A + canal META | Sim (só KPIs Meta ou agregado mascarado?) | Sim Meta; Google oculto ou “sem permissão” | Não | Não |
| Gestor grant workspace A + META + conta act_1 | Sim; tabelas filtradas à conta | Idem | Não | Não |
| agency_owner | Qualquer filho | Qualquer filho | Sim | Não |
| workspace_owner em A | Só A | Só A | Não | Não |
| platform_admin | Via impersonation auditada | Idem | Leitura global | Sim |

**Regra “sem permissão” na UI:** componente desabilitado + tooltip; **na API:** 403 com código estável `FORBIDDEN_SCOPE`.

---

## 6. Quem edita / pausa / cria campanha

| Ação | Requisitos |
|------|------------|
| Ver campanha | `marketing.detail.read` + canal META na `MatrixWorkspaceGrant` ou papel workspace com Meta + `AssetAccessGrant` se houver restrição por conta |
| Pausar campanha | `media.meta.campaign.status` + grant conta + módulo `campaign_write` |
| Editar orçamento | `media.meta.campaign.budget` + idem |
| Criar campanha | `media.meta.campaign.create` + idem |
| Google | Paralelo com capabilities `media.google.*` |

---

## 7. Grants por cliente/workspace (matriz)

- Tabela `MatrixWorkspaceGrant(userId, matrixOrganizationId, workspaceOrganizationId, allowedChannels[])`.
- Ao resolver `activeOrganizationId`, verificar: usuário tem `Membership` na matriz **e** (é owner/admin **ou** existe grant para aquele workspace).
- `allowedChannels` vazio pode significar “todos os canais” **apenas** para owner/admin; para `agency_ops` exigir canais explícitos.

---

## 8. Grants Meta e Google

- `AssetAccessGrant(userId, organizationId=workspace, assetType, externalId)`.
- Se **não existir nenhuma linha** para aquele user+workspace+tipo de ativo:
  - **Política A (restritiva):** negar qualquer dado dessa conta até admin configurar.
  - **Política B (permissiva):** permitir todas as contas retornadas pela integração conectada no workspace.

**Decisão recomendada:** Política B para `workspace_owner` / `workspace_admin`; Política A para `media_*_manager` e `performance_analyst` quando o produto exigir segregação forte.

Documentar escolha no checklist.

---

## 9. Admin da agência “vê tudo”

- `agency_owner` e `agency_admin` na matriz: sem necessidade de `MatrixWorkspaceGrant` para enumerar filhos; grants opcionais para **restringir** abaixo do teto do papel.
- Dados sempre filtrados por `activeOrganizationId` escolhido (nunca misturar A+B na mesma resposta sem endpoint agregado explícito).

---

## 10. Superadmin vê tudo

- Rotas `/platform/*` apenas.
- Impersonation: gera `AuditLog` `impersonation.start` / `end`, tempo limite, opcionalmente somente leitura.
- Não usar platform admin para rotas de workspace sem impersonation (reduz superfície de erro).

---

## 11. Casos de teste obrigatórios (aceite RBAC)

1. Gestor X: membership matriz + grants workspace A + META + conta C1 → vê Meta A/C1; não vê Google; não vê workspace B.
2. Gestor Y: grants workspace A + GOOGLE → inverso.
3. Gestor Z: grants workspace B + META + GOOGLE → vê B completo (mídia).
4. Dono agência: sem grants → vê lista de todos filhos e opera qualquer um.
5. Cliente `report_viewer` no workspace A: vê dashboards; 403 em `PATCH campaign`.
6. Platform admin: sem membership em A não acessa `/marketing` de A exceto via impersonation.

---

*Próximo: [`03-contrato-apis.md`](03-contrato-apis.md)*
