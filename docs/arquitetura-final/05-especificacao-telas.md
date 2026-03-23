# Especificação funcional — telas (critérios de aceite)

Cada seção segue o mesmo template: **objetivo**, **audiência**, **dados**, **ações**, **plano**, **papel**, **loading**, **empty**, **erro**, **filtros**, **paginação**, **auditoria**, **APIs**, **relações**.

---

## `/dashboard`

| Campo | Especificação |
|-------|----------------|
| **Objetivo** | Em ≤15s: investimento, resultado, gargalo, ação necessária, destaque positivo. |
| **Audiência** | Usuário com `marketing.summary.read` no workspace ativo; matriz com contexto em filho. |
| **Dados** | KPIs (investimento, impr., alcance, cliques, leads, CPL, CTR, CPC, CPM, frequência, LPV, compras, receita, ROAS), delta período anterior, insights, metas/alertas, funil + widget taxas, gráfico diário, top campanhas (ou link), status integrações, CTA Marketing. |
| **Ações** | Cards clicáveis → deep link Marketing com filtro; período; atualizar; CTA Marketing/Integrações. |
| **Restrição plano** | Sem módulo marketing: empty dirigido a upgrade/configuração. |
| **Restrição papel** | `report_viewer`: só blocos de leitura agregada; ocultar ações de integração sensíveis. |
| **Loading** | Skeleton **por bloco**; manter snapshot anterior (stale-while-revalidate). |
| **Empty** | Sem Meta/Google: mensagem única + CTA integrações; sem dados no período: “Sem gasto no período”. |
| **Erro** | Banner por bloco ou toast; não full-page branco; retry por seção. |
| **Filtros** | Período global (dialog existente); comparativo opcional. |
| **Paginação** | N/A no dashboard principal; tabela top N fixo ou “ver tudo” → Marketing. |
| **Auditoria** | Não para leitura; troca período não audita. |
| **APIs** | `GET /marketing/summary`, `GET /marketing-dashboard` (legado até consolidar), `GET /me/context`, integrações status. |
| **Relações** | Marketing (detalhe), Integrações, Config metas. |

---

## `/marketing`

| Campo | Especificação |
|-------|----------------|
| **Objetivo** | Cockpit operacional principal; substitui uso fragmentado do Ads Manager ao longo das fases. |
| **Audiência** | Gestores com leitura/escrita conforme papel e grants. |
| **Dados** | Barra contexto (workspace se matriz, projeto, lançamento, período, canal, temperatura, status), KPIs executivos, blocos ação/oportunidade/risco/alerta, tabela campanhas, tabs (resumo, campanhas, conjuntos, anúncios, criativos, relatórios, alterações — conforme fase). |
| **Ações** | Filtrar; exportar; salvar view; Fase 5: pausar/ativar, orçamento, duplicar, renomear. |
| **Plano** | `campaign_write` para ações mutáveis; `marketing` base para leitura. |
| **Papel** | Meta manager: só Meta; Google manager: só Google; analista: leitura. |
| **Loading** | Barra contexto estável; skeleton tabela; não resetar filtros. |
| **Empty** | Sem integração canal: CTA conectar; sem campanhas: copy operacional. |
| **Erro** | API Meta/Google: mensagem com código; partial render das partes OK. |
| **Filtros** | Nome, status, objetivo, conta (quando múltiplas), projeto/lançamento. |
| **Paginação** | Server-side campanhas > 50. |
| **Auditoria** | Sim para mutações Fase 5. |
| **APIs** | summary, detail, timeseries, futuro write. |
| **Relações** | Captação, conversão, receita, integrações, projetos/lançamentos. |

---

## `/marketing/captacao`

| Campo | Especificação |
|-------|----------------|
| **Objetivo** | Eficiência de aquisição; comparar Meta vs Google e rankings. |
| **Audiência** | Analistas e gestores com canal liberado. |
| **Dados** | Investimento, impr., alcance, cliques, CTR, CPC, CPM, freq., CPL, placements, criativos, públicos (quando API permitir), rankings. |
| **Ações** | Ordenar tabelas; exportar; drill-down para Marketing com filtro. |
| **Plano** | Módulo captação ou marketing agregado. |
| **Papel** | Leitura mínima `marketing.detail.read`; escrita N/A nesta rota inicialmente. |
| **Loading** | Por card/tabela. |
| **Empty** | Canal sem dados ou sem integração. |
| **Erro** | Por fonte (Meta vs Google). |
| **Filtros** | Período, canal, conta, naming contains. |
| **Paginação** | Tabelas grandes. |
| **Auditoria** | Não. |
| **APIs** | detail breakdown endpoints por dimensão. |
| **Relações** | Marketing, conversão. |

---

## `/marketing/conversao`

| Campo | Especificação |
|-------|----------------|
| **Objetivo** | Qualidade de funil e desperdício por campanha/criativo/origem. |
| **Audiência** | Analistas, gestores; cliente final read-only se permitido. |
| **Dados** | Funil, taxas entre etapas, leads quentes/frios, score, tabelas campanha/criativo/origem, cruzamento webhook quando existir. |
| **Ações** | Drill-down; exportar. |
| **Plano** | Marketing + webhooks opcional enriquece. |
| **Papel** | `report_viewer` pode ver só agregados. |
| **Loading** | Funil + tabelas independentes. |
| **Empty** | Sem leads no período; explicar diferença de “sem dado” vs “integração off”. |
| **Erro** | Híbrido Meta (taxa >100%) com copy já definida no produto. |
| **Filtros** | Período, projeto, lançamento, canal. |
| **Paginação** | Sim nas tabelas. |
| **Auditoria** | Não. |
| **APIs** | funnel + detail por dimensão. |
| **Relações** | Receita, integrações. |

---

## `/marketing/receita`

| Campo | Especificação |
|-------|----------------|
| **Objetivo** | Fechar conta: ROAS, ticket, receita por dimensão. |
| **Audiência** | Gestores, financeiro read-only. |
| **Dados** | Valor atribuído, ROAS, CPA compra, compras por canal, série gasto × receita, top campanhas receita. |
| **Ações** | Exportar; alertas tracking. |
| **Plano** | Receita pode exigir módulo ou feature flag. |
| **Papel** | `sales_viewer` / finance. |
| **Loading** | Blocos independentes. |
| **Empty** | Estados explícitos: zero real, indisponível, tracking incompleto (ver doc 06). |
| **Erro** | API pixel/checkout. |
| **Filtros** | Período, canal, produto (futuro). |
| **Paginação** | Tabelas. |
| **Auditoria** | Não leitura. |
| **APIs** | summary receita + detail. |
| **Relações** | Conversão, dashboard. |

---

## `/marketing/integracoes`

| Campo | Especificação |
|-------|----------------|
| **Objetivo** | Hub único: anúncios, CRM, webhooks, pagamentos (fases). |
| **Audiência** | `workspace_admin` ou integração capability. |
| **Dados** | Status, saúde, última sync, conta, erros, testar, logs webhook. |
| **Ações** | Conectar, reconectar, desconectar, testar, ver logs, criar endpoint webhook. |
| **Plano** | `maxIntegrations`; módulos por tipo. |
| **Papel** | `integration.*` capabilities. |
| **Loading** | Por card integração. |
| **Empty** | Nenhuma integração: onboarding. |
| **Erro** | OAuth falhou; token expirado. |
| **Filtros** | Por categoria (mídia, CRM, webhook, pagamento). |
| **Paginação** | Lista de eventos webhook. |
| **Auditoria** | Conectar/desconectar/replay. |
| **APIs** | Seções 7–8 contrato. |
| **Relações** | Todas rotas marketing. |

---

## `/marketing/configuracoes` (metas e alertas)

| Campo | Especificação |
|-------|----------------|
| **Objetivo** | Limiares CPA/CPL/CTR/CPC/CPM/ROAS, amostra mínima, canais de alerta. |
| **Audiência** | Admin workspace. |
| **Dados** | `MarketingSettings` + futuro `AlertRule`. |
| **Ações** | Salvar; preview impacto; mutar horários (fase 6). |
| **Plano** | Alertas podem exigir módulo. |
| **Papel** | `workspace_admin`. |
| **Loading** | Form com valores. |
| **Empty** | N/A. |
| **Erro** | Validação numérica. |
| **Filtros** | N/A. |
| **Paginação** | Histórico alertas fase 6. |
| **Auditoria** | Sim em salvar. |
| **APIs** | PATCH marketing-settings. |
| **Relações** | Dashboard alertas, WhatsApp CRM. |

---

## `/clientes` (marcas / unidades)

| Campo | Especificação |
|-------|----------------|
| **Objetivo** | Gestão de marcas/unidades **dentro** do workspace; não confundir com cliente da agência. |
| **Audiência** | Time do workspace; leitura para analistas. |
| **Dados** | Nome, status, responsável, segmento, projetos/ lançamentos ativos, KPIs agregados (fase 7). |
| **Ações** | CRUD marca; vincular integração (futuro). |
| **Plano** | `maxClientAccounts`. |
| **Papel** | `workspace_admin` escrita; outros leitura. |
| **Loading** | Lista skeleton. |
| **Empty** | “Nenhuma marca cadastrada”. |
| **Erro** | Limite plano ao criar. |
| **Filtros** | Busca nome. |
| **Paginação** | Se > 50. |
| **Auditoria** | CRUD. |
| **APIs** | client-accounts. |
| **Relações** | Projetos, Marketing (filtro). |

---

## `/projetos`

| Campo | Especificação |
|-------|----------------|
| **Objetivo** | Agrupar operação por iniciativa; cockpit futuro. |
| **Audiência** | Gestores, admins. |
| **Dados** | Nome, descrição, marca, owner, status, tags, orçamento, realizado, KPIs, lançamentos. |
| **Ações** | CRUD; duplicar; arquivar; abrir cockpit. |
| **Plano** | Feature `projects`. |
| **Papel** | Admin escrita; analista leitura com grant opcional por projeto. |
| **Loading** | Lista + detalhe. |
| **Empty** | CTA criar primeiro projeto. |
| **Erro** | Conflito nome. |
| **Filtros** | Status, marca, tag. |
| **Paginação** | Sim. |
| **Auditoria** | CRUD. |
| **APIs** | projects. |
| **Relações** | Lançamentos, Marketing. |

---

## `/lancamentos`

| Campo | Especificação |
|-------|----------------|
| **Objetivo** | Janela temporal e metas operacionais. |
| **Audiência** | Gestores. |
| **Dados** | Nome, projeto, marca, tipo, estágio, datas, metas leads/vendas, investimento, pacing, saúde. |
| **Ações** | Wizard criar; duplicar; vínculo campanhas (futuro). |
| **Plano** | Feature launches. |
| **Papel** | Admin; grant por lançamento reduz visibilidade. |
| **Loading** | Wizard steps. |
| **Empty** | Sem lançamentos. |
| **Erro** | Datas inválidas. |
| **Filtros** | Projeto, estágio. |
| **Paginação** | Lista. |
| **Auditoria** | CRUD. |
| **APIs** | launches. |
| **Relações** | Marketing filtros, projetos. |

---

## `/usuarios` ou `/equipe`

| Campo | Especificação |
|-------|----------------|
| **Objetivo** | Membros, convites, papéis, escopos (grants). |
| **Audiência** | `workspace_admin`; matriz: `agency_admin`. |
| **Dados** | Lista membros, último acesso, papel, grants resumidos. |
| **Ações** | Convidar, remover, suspender, papel, configurar grants, reset senha (política). |
| **Plano** | `maxUsers`. |
| **Papel** | Capabilities `org.members.*`. |
| **Loading** | Tabela skeleton. |
| **Empty** | Só owner. |
| **Erro** | Limite usuários; e-mail duplicado. |
| **Filtros** | Papel, busca. |
| **Paginação** | Sim. |
| **Auditoria** | Todas mutações. |
| **APIs** | members, invitations, matrix grants. |
| **Relações** | Revenda, configurações. |

---

## `/configuracoes`

| Campo | Especificação |
|-------|----------------|
| **Objetivo** | Hub empresa: branding, timezone, moeda, segurança, UTM, preferências. |
| **Audiência** | Admin workspace. |
| **Dados** | Campos org + preferências usuário (sub-aba). |
| **Ações** | Salvar por aba. |
| **Plano** | branding pode ser premium. |
| **Papel** | `org.workspace.write`. |
| **Loading** | Por aba. |
| **Empty** | N/A. |
| **Erro** | Upload logo; validação slug. |
| **Filtros** | N/A. |
| **Paginação** | N/A. |
| **Auditoria** | Mudanças sensíveis. |
| **APIs** | PATCH organization profile. |
| **Relações** | Integrações, login. |

---

## `/revenda` (carteira da agência)

| Campo | Especificação |
|-------|----------------|
| **Objetivo** | Painel master multi-cliente conforme doc produto. |
| **Audiência** | `agency_*` na matriz. |
| **Dados** | Visão geral, workspaces, usuários agência, grants, planos/limites, saúde, auditoria. |
| **Ações** | Criar/pausar workspace, impersonation (se política), gerir grants. |
| **Plano** | Limites matriz. |
| **Papel** | Ver matriz permissões. |
| **Loading** | Por tab. |
| **Empty** | Sem filhos. |
| **Erro** | Limite workspaces. |
| **Filtros** | Status workspace, busca. |
| **Paginação** | Listas grandes. |
| **Auditoria** | Sim. |
| **APIs** | matrix/* + legado revenda-api. |
| **Relações** | Plataforma, workspace filho. |

---

## `/plataforma`

| Campo | Especificação |
|-------|----------------|
| **Objetivo** | Admin global SaaS. |
| **Audiência** | platform_* apenas. |
| **Dados** | Empresas, planos, assinaturas, módulos, auditoria. |
| **Ações** | CRUD completo conforme política owner/admin. |
| **Plano** | N/A (acima de tenant). |
| **Papel** | platform. |
| **Loading** | Tabelas. |
| **Empty** | Listas vazias. |
| **Erro** | Plano em uso. |
| **Filtros** | Busca, status. |
| **Paginação** | Sim. |
| **Auditoria** | Obrigatória mutações. |
| **APIs** | `/platform/*`. |
| **Relações** | Nenhuma com tenant user comum. |

---

*Próximo: [`06-regras-metricas.md`](06-regras-metricas.md)*
