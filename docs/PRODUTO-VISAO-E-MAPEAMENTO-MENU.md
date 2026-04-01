# Ativa Dash — Visão do produto, perfis e mapeamento de menu/rotas

**Objetivo deste documento:** alinhar **propósito**, **quem é quem** no multi-tenant e **o que cada perfil vê** (menu + rotas), com base no código atual (`frontend/src/App.tsx`, `Sidebar.tsx`, serviços de auth) e na arquitetura de permissões em [`arquitetura-final/02-matriz-permissoes.md`](./arquitetura-final/02-matriz-permissoes.md).

**Última revisão:** 2026-03-31 (hub por perfil, guards workspace cliente, modo suporte).

---

## 1. Propósito do produto (redesenhado em uma frase)

**Ativa Dash é a camada operacional e analítica de performance de mídia paga** (Meta, Google e conexões com CRM/WhatsApp) **para empresas e redes de agências**: cada **workspace** isola dados; **matrizes parceiras** podem revender planos e gerir filiais e clientes; **a equipe Ativa Dash (admin global)** governa planos, assinaturas e o ciclo de vida das empresas no produto.

---

## 2. Quatro camadas de ator (não confundir com “um único admin”)

| Camada | Quem é | Objetivo na UI |
|--------|--------|----------------|
| **A — Administrador global** | E-mail em `PLATFORM_ADMIN_EMAILS` (`platformAdmin`) | Governança do **produto**: todas as empresas, planos, assinaturas, auditoria de plataforma, flags (ex.: parceiro revenda na raiz). |
| **B — Matriz (raiz parceira)** | Org raiz com `resellerPartner` + papel forte na hierarquia | **Revenda / ecossistema**: filiais, agências, clientes, planos **no âmbito da matriz**, módulos, saúde, auditoria operacional da rede. |
| **C — Agência (filial)** | Org filha (`parentOrganizationId` preenchido), tipicamente `organizationKind` coerente com operação de agência | **Só a própria operação e os clientes sob sua pasta**: sem ver outras filiais da matriz nem painel global de produto. |
| **D — Workspace cliente** | `CLIENT_WORKSPACE` (marca/cliente final sob agência/matriz) | **Dados daquele cliente**: marketing, integrações da conta, equipe do workspace (conforme papel). |

> **Nota de modelo de dados:** o backend já distingue `OrganizationKind` (`MATRIX`, `DIRECT`, `CLIENT_WORKSPACE`) e expõe `organizationKind` em **cada item de `memberships`** no `/auth/me`. O **frontend** tipa `organizationKind` no utilizador e em `MembershipSummary` (`auth-store` / `organization-api`) e usa-o em `navigation-mode` + guards — ver §6.

---

## 3. Inventário de rotas (SPA) — `frontend/src/App.tsx`

| Rota | Página / função | Quem deveria ter acesso (alvo) |
|------|-----------------|--------------------------------|
| `/dashboard` | Dashboard | Todos os autenticados (com features de plano). |
| `/marketing` | Painel ADS | Operacional (agência/cliente conforme plano). |
| `/marketing/captacao`, `/conversao`, `/receita` | Funis | Idem. |
| `/marketing/integracoes` + filhas | Hub + Meta, Google, CRM/WhatsApp, Webhook | Idem; **webhook** é integração por workspace. |
| `/marketing/configuracoes` | Metas, automações, alertas (marketing settings) | Operacional; alinhar naming com “Metas e alertas” na UX agência. |
| `/ads/metas-alertas` | Metas e alertas operacionais | Idem. |
| `/clientes` | Clientes (contas/workspace sob gestão) | Matriz, agência com feature; **rever** para workspace cliente puro. |
| `/projetos`, `/lancamentos` | Projetos e lançamentos | Operacional. |
| `/usuarios` | Equipe | Quem pode gerir membros na org ativa. |
| `/configuracoes` | Hub de configurações | Todos; **conteúdo** deve variar por perfil. |
| `/configuracoes/empresa` | Plano / empresa | **Agência filial:** idealmente **sem** gestão de plano da matriz (só leitura ou oculto). |
| `/perfil` | Perfil / senha | Todos. |
| `/revenda`, `/revenda/*` | Matriz e filiais | **Só** `platformAdmin` **ou** raiz com `rootResellerPartner` + regras de plano (já parcialmente aplicado). |
| `/assinatura`, `/planos` | Redirect → `/revenda` | Mesmo critério que revenda. |
| `/admin` | Redireciona para `/configuracoes/admin` | **Guard:** igual ao destino (`canAccessAdminPage`). |
| `/configuracoes/admin` | Admin técnico (ID org, atalhos) | `AdminSettingsPage.tsx` + `AdminOrgPanel`; entrada no hub (“Admin técnico”). |
| `/plataforma` | Admin global do produto | **Só** `platformAdmin` (página já bloqueia). |

---

## 4. Menu lateral — estado **atual** (`Sidebar.tsx` + `resolveSidebarNavVariant`)

A variante vem de `navigation-mode.ts` (`full` | `agency_branch` | `client_workspace` | `agency_client_portal`). Em todos os casos, **itens individuais** podem ser filtrados por plano (`nav-plan-features.ts` + `enabledFeatures`), exceto bypass para `platformAdmin`.

### 4.1 Variante `full` (matriz, conta directa, operação completa)

| Grupo | Itens |
|-------|--------|
| Visão geral | Dashboard |
| ADS | Painel ADS, Captação, Conversão, Receita |
| Conexões | Integrações, Alertas e regras, Metas por canal |
| Operação | Clientes, Projetos, Lançamentos, Equipe |
| Conta | Revenda (se `platformAdmin` ou `rootResellerPartner` na raiz ativa), Configurações |
| (extra) | Admin global do produto — só `platformAdmin` |

### 4.2 Variante `agency_branch` (agência filial — `parentOrganizationId != null`)

Menu **enxuto**, alinhado ao §5.3:

| Grupo | Itens |
|-------|--------|
| Visão geral | `/dashboard` (label “Visão geral”) |
| Operação | Clientes |
| Conexões | Integrações, Alertas e regras, Metas por canal |
| Conta | Revenda (mesmas regras que em `full`), Configurações |

Não aparecem no menu: bloco ADS completo, Projetos, Lançamentos, Equipe. **Deep links:** `MainLayout` redireciona URLs fora de `isPathAllowedForAgencyBranch` (ex.: `/marketing`, `/projetos`, `/usuarios`) para `/dashboard`.

### 4.3 Variante `client_workspace` (`organizationKind === CLIENT_WORKSPACE`)

ADS + Conexões como em `full`; grupo **Operação** só com **Equipe** (`/usuarios`) — sem Clientes / Projetos / Lançamentos no menu. **Deep links:** `/clientes`, `/projetos`, `/lancamentos` redirecionam para `/dashboard` (`isPathBlockedForClientWorkspaceClients`).

### 4.4 Variante `agency_client_portal`

Perfil **report_viewer** / **client_viewer** na org ativa (`isAgencyClientPortalUser`): menu **Visão geral** + **ADS** completo + **Conta → Configurações**. Rotas permitidas incluem `/perfil` e **`/configuracoes` (+ sub-rotas)**; hub e **Empresa** em modo consulta (`CompanySettingsPage` só leitura para nome). Integrações e blocos de marketing no hub estão ocultos (acesso não faz parte do escopo deste perfil).

**Melhorias opcionais futuras:** fundir `/admin` no hub; fundir as duas rotas de “metas” num único fluxo (§5.3).

---

## 5. Menu lateral — **meta** por perfil (alvo de UX)

### 5.1 Administrador global (`platformAdmin`)

- **Plataforma:** entrada `/plataforma` (planos, empresas, assinaturas, auditoria, limites, parceiro revenda).
- **Implementado:** ao assumir contexto de um tenant (modo ≠ `platform_full`), badge **Modo suporte** na topbar (`AppTopbar`).

### 5.2 Matriz parceira (não platform; raiz `resellerPartner`)

- Todo o menu **operacional** da conta (ADS, integrações, etc.) **se a matriz também opera mídia**.
- **Matriz e filiais** (`/revenda/*`): visão geral, empresas, agências, usuários rede, planos, módulos, saúde, auditoria **da rede**.

### 5.3 Agência filial (restrita — o que pediram para “terminar”)

**Mostrar apenas:**

1. **Visão geral** — `/dashboard` (KPIs da agência / carteira sob seu nó; copy pode mudar para “Visão da agência”).
2. **Clientes** — `/clientes` (cadastro e gestão dos workspaces cliente **permitidos**).
3. **Integrações** — `/marketing/integracoes` (+ sub-rotas Meta, Google, CRM, **Webhook** se o plano permitir).
4. **Metas e alertas** — `/ads/metas-alertas` e, se fizer sentido no mesmo bucket, `/marketing/configuracoes` **ou** fundir fluxos para não duplicar “metas” em dois sítios.

**Ocultar para este perfil:**

- Matriz e filiais, planos/assinaturas da rede, auditoria global, outras empresas da matriz.
- **Projetos / Lançamentos / Equipe** — **decisão de produto:** ou entram no MVP agência (muitas agências precisam) ou ficam em “Fase 2”; a spec estrita que você descreveu os remove — alinhar com stakeholders antes de esconder.

**Conta mínima:** `/perfil` + eventual `/configuracoes` só com subset (sem plano matriz).

### 5.4 Workspace cliente final

- Foco em **Painel ADS**, **Integrações**, **Metas/alertas**; **Clientes** pode ser oculto ou renomeado conforme modelo (às vezes “marcas” internas).

---

## 6. Sinais técnicos já disponíveis vs. lacunas

| Sinal | Backend | Frontend |
|-------|---------|----------|
| `platformAdmin` | Sim (`getAuthProfileExtended`) | Sim (`user.platformAdmin`, `MainLayout`) |
| `rootResellerPartner` (raiz do ecossistema) | Sim | Sim (`user.rootResellerPartner`) |
| `parentOrganization` no contexto da org | Sim (`GET /organization`) | Sim (`OrganizationContext`) |
| `organizationKind` por membership | Sim (`memberships[].organizationKind`) | Opcional em `MembershipSummary`; **org ativa** também em `User` |
| Guard de `/revenda` | API + redirect layout | `RevendaLayout` (filial redireciona; matriz só na raiz ativa) |
| Guard de `/plataforma` | API | `PlatformPage` |
| Guard de `/admin` | — | `MainLayout` + `canAccessAdminPage` |
| Guard agência filial (deep links) | — | `isPathAllowedForAgencyBranch` + `shouldEnforceAgencyBranchRouteGuard(user, memberships)` |
| Guard workspace cliente | — | `isPathBlockedForClientWorkspaceClients` (`/clientes`, `/projetos`, `/lancamentos`) |
| Badge modo suporte (`platformAdmin` em tenant) | — | `AppTopbar` + `resolveAppNavMode` |
| Hub `/configuracoes` por perfil | — | `SettingsHubPage` (subconjuntos para filial, workspace cliente, portal cliente) |
| Menu condicional agência / cliente | — | `navigation-mode.ts` + `Sidebar.tsx` |
| Menu por features do plano | `enabledFeatures` em `GET /organization` | `nav-plan-features.ts` + `organization-plan-features-context.tsx` (um pedido partilhado; evento `ativadash:organization-plan-features-refresh` + `refreshPlanFeatures` após alterações de plano) + `Sidebar` + `MainLayoutInner` |
| Filial operação alargada (opt-in build) | — | `VITE_AGENCY_BRANCH_EXPANDED_OPS` + `isAgencyBranchExpandedOpsEnabled()` (`navigation-mode`, `Sidebar`, hub) |

---

## 7. Checklist para fechar o alinhamento “ainda hoje”

**P0 — Consistência e segurança**

1. [x] **Agência filial** = `parentOrganizationId != null` na org ativa (JWT); **workspace cliente** = `organizationKind === CLIENT_WORKSPACE` (prioritário no menu).
2. [x] `organizationKind` e `parentOrganizationId` no `User` (`AuthUserDto` + `GET /auth/me`); `organizationKind` opcional em `MembershipSummary`.
3. [x] **Guards** em `MainLayout`: `/admin` só staff global ou papéis admin na org em modo `operational_full`; agência filial e workspace cliente com listas de rotas permitidas (admin global ignora restrição de rotas).
4. [x] Sidebar: variantes `full` | `agency_branch` | `client_workspace` em `navigation-mode.ts` + `Sidebar.tsx`. Matriz no menu só na **raiz** ativa (`parentOrganizationId == null`) e `rootResellerPartner`.

**P1 — UX**

5. [x] Menu agência: “Visão geral” + link “Automações (Marketing)” para `/marketing/configuracoes`.
6. [x] Unificar rotas de metas (opcional): manter `/ads/metas-alertas` e `/marketing/configuracoes` com labels claros (sidebar + hub de configurações).
7. [x] Hub e **CompanySettingsPage**: filial vê plano pela matriz no hub; **nome da empresa** na filial só leitura (exceto `platformAdmin` em suporte); raiz mantém edição e revenda.

**P2:** [x] Sidebar filtra itens por `enabledFeatures` de `GET /organization` (com bypass para `platformAdmin`); até ao carregar o contexto o menu mostra o conjunto completo da variante. [x] `MainLayout` redireciona URLs que o plano não cobre para a primeira rota permitida (`firstAllowedPathForPlanAndNav`), respeitando filial / portal cliente / workspace.

**Referência profunda de RBAC:** [02-matriz-permissoes.md](./arquitetura-final/02-matriz-permissoes.md).

---

## 8. Mapa rápido “rota → implementação”

| Rota | Ficheiro principal |
|------|-------------------|
| `/dashboard` | `pages/Dashboard.tsx` |
| `/marketing/*` | `pages/Marketing*.tsx`, `pages/integrations/*` |
| `/ads/metas-alertas` | `pages/MetasAlertasPage.tsx` |
| `/clientes` | `pages/ClientsPage.tsx` |
| `/revenda/*` | `pages/revenda/*` |
| `/plataforma` | `pages/PlatformPage.tsx` |
| `/configuracoes` | `pages/SettingsHubPage.tsx` |
| `/configuracoes/admin` | `pages/AdminSettingsPage.tsx`, `components/settings/AdminOrgPanel.tsx` |
| Menu | `components/layout/Sidebar.tsx` |
| Auth | `stores/auth-store.ts`, `MainLayout.tsx` (`GET /auth/me`) |

---

## 9. Backlog residual (baixa prioridade)

1. **Agência filial — operação alargada:** com `VITE_AGENCY_BRANCH_EXPANDED_OPS=1` no build, o menu, o guard de rotas e o hub de configurações alinham-se à operação completa (ADS, Projetos, Lançamentos, Equipe). Default permanece **enxuto**.
2. **Duas rotas de metas** — ligações cruzadas no topo de `/marketing/configuracoes` e `/ads/metas-alertas`; fundir numa única rota com tabs seria refactor maior, se produto unificar.

---

*Este ficheiro é o contrato vivo entre produto, UX e engenharia para a próxima iteração de menus e guards.*
