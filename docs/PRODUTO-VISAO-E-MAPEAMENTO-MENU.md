# Ativa Dash — Visão do produto, perfis e mapeamento de menu/rotas

**Objetivo deste documento:** alinhar **propósito**, **quem é quem** no multi-tenant e **o que cada perfil vê** (menu + rotas), com base no código atual (`frontend/src/App.tsx`, `Sidebar.tsx`, serviços de auth) e na arquitetura de permissões em [`arquitetura-final/02-matriz-permissoes.md`](./arquitetura-final/02-matriz-permissoes.md).

**Última revisão:** 2026-03-30.

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

> **Nota de modelo de dados:** o backend já distingue `OrganizationKind` (`MATRIX`, `DIRECT`, `CLIENT_WORKSPACE`) e expõe `organizationKind` em **cada item de `memberships`** no `/auth/me`. O **frontend ainda não tipa nem usa** `organizationKind` no store — ver §6.

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
| `/admin` | Administração (info org + link integrações) | **Hoje sem guard** — qualquer logado abre; **deveria** ser restrito ou fundido em Configurações. |
| `/plataforma` | Admin global do produto | **Só** `platformAdmin` (página já bloqueia). |

---

## 4. Menu lateral — estado **atual** (`Sidebar.tsx`)

| Grupo | Itens | Visibilidade atual |
|-------|--------|---------------------|
| Visão geral | Dashboard | Todos. |
| ADS | Painel ADS, Captação, Conversão, Receita | Todos. |
| Conexões | Integrações, Metas e alertas | Todos. |
| Operação | Clientes, Projetos, Lançamentos, Equipe | Todos. |
| Conta | Matriz e filiais, Configurações | Matriz e filiais: **só** se `platformAdmin` **ou** `rootResellerPartner`. |
| (extra) | Admin global do produto | Só `platformAdmin`. |

**Gap vs. visão “Agência (filial)”:** hoje a agência **ainda vê** todo o bloco ADS, Projetos, Lançamentos, Configurações completas e `/admin` por URL — não há menu “enxuto” só com Visão geral + Clientes + Integrações + Metas/alertas.

---

## 5. Menu lateral — **meta** por perfil (alvo de UX)

### 5.1 Administrador global (`platformAdmin`)

- **Plataforma:** entrada `/plataforma` (planos, empresas, assinaturas, auditoria, limites, parceiro revenda).
- **Opcional:** ao assumir contexto de um tenant, mostrar o menu desse tenant + badge “Modo suporte”.

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
| Menu condicional agência / cliente | — | `navigation-mode.ts` + `Sidebar.tsx` |

---

## 7. Checklist para fechar o alinhamento “ainda hoje”

**P0 — Consistência e segurança**

1. [x] **Agência filial** = `parentOrganizationId != null` na org ativa (JWT); **workspace cliente** = `organizationKind === CLIENT_WORKSPACE` (prioritário no menu).
2. [x] `organizationKind` e `parentOrganizationId` no `User` (`AuthUserDto` + `GET /auth/me`); `organizationKind` opcional em `MembershipSummary`.
3. [x] **Guards** em `MainLayout`: `/admin` só staff global ou papéis admin na org em modo `operational_full`; agência filial e workspace cliente com listas de rotas permitidas (admin global ignora restrição de rotas).
4. [x] Sidebar: variantes `full` | `agency_branch` | `client_workspace` em `navigation-mode.ts` + `Sidebar.tsx`. Matriz no menu só na **raiz** ativa (`parentOrganizationId == null`) e `rootResellerPartner`.

**P1 — UX**

5. [x] Menu agência: “Visão geral” + link “Automações (Marketing)” para `/marketing/configuracoes`.
6. [ ] Unificar rotas de metas (opcional): manter `/ads/metas-alertas` e `/marketing/configuracoes` com labels claros.
7. [x] Hub e **CompanySettingsPage**: filial vê texto de plano pela matriz; raiz mantém detalhe de plano/revenda.

**P2 (futuro):** filtrar itens do menu por `enabledFeatures` do plano (exige sinal no auth ou cache de contexto).

**Referência profunda de RBAC:** [02-matriz-permissoes.md](./arquitetura-final/02-matriz-permissoes.md).

---

## 8. Mapa rápido “rota → implementação”

| Rota | Ficheiro principal |
|------|-------------------|
| `/dashboard` | `pages/Dashboard.tsx` |
| `/marketing/*` | `pages/Marketing*.tsx`, `pages/integrations/*` |
| `/ads/metas-alertas` | `pages/MarketingAdsOperationalPage.tsx` |
| `/clientes` | `pages/ClientsPage.tsx` |
| `/revenda/*` | `pages/revenda/*` |
| `/plataforma` | `pages/PlatformPage.tsx` |
| `/configuracoes` | `pages/SettingsHubPage.tsx` |
| Menu | `components/layout/Sidebar.tsx` |
| Auth | `stores/auth-store.ts`, `MainLayout.tsx` (`GET /auth/me`) |

---

*Este ficheiro é o contrato vivo entre produto, UX e engenharia para a próxima iteração de menus e guards.*
