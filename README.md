# Ativa Dash

Plataforma de dashboards de marketing, vendas e integrações para agências e gestores de tráfego.

## Stack

- **Frontend:** React, TypeScript, Vite, Tailwind, shadcn/ui, Zustand
- **Backend:** Node.js, Express, Prisma, PostgreSQL (na VPS)
- **Auth:** JWT + refresh token, multi-tenant
- **Integrações:** Google Ads (OAuth + métricas na página Marketing)

## Estrutura

```
Ativadash/
├── frontend/    # App React
├── backend/     # API Express + Prisma (PostgreSQL) — produção
├── worker/      # Legado (Cloudflare Worker); não usado no deploy atual — ver worker/README.md
└── package.json # Scripts raiz
```

## Desenvolvimento local

### Modo recomendado: sem banco no PC (só API)

Consultas e alterações **só pela API** (dados na VPS). Rode **apenas o frontend**:

```bash
cd frontend
copy .env.local.example .env.local
# Edite .env.local se a API não for https://api.ativadash.com
npm install
npm run dev
```

Guia completo: **[`docs/DEV-APENAS-API.md`](./docs/DEV-APENAS-API.md)** — inclui **CORS** (`FRONTEND_URL` na VPS com `http://127.0.0.1:5173`).

### Modo full-stack local (Postgres + API no PC)

1. **PostgreSQL** local ou Docker — veja [`docs/LOCAL-SETUP.md`](./docs/LOCAL-SETUP.md).
2. **Backend:**

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

3. **Frontend** (sem `VITE_API_URL` no `.env.local` — usa proxy para `:3000`):

```bash
cd frontend
npm install
npm run dev
```

Abra **`http://127.0.0.1:5173`**.

**Banco só na VPS no PC:** sem túnel ou Postgres local, use o **modo só API** acima — veja [`docs/BANCO-SO-NA-VPS.md`](./docs/BANCO-SO-NA-VPS.md).

**Dev com SQLite (sem PostgreSQL):** em `backend/prisma/schema.prisma` troque `provider` para `sqlite` e `url` para `env("DATABASE_URL")`; no `.env` use `DATABASE_URL="file:./dev.db"`. Rode `npx prisma migrate dev`.

## Deploy (VPS + PostgreSQL)

- **Backend:** rode na VPS (Node + PM2 ou similar). Banco **PostgreSQL**; variáveis em `backend/.env` (ou ambiente). Ver `DEPLOY-VPS.md`.
- **Frontend:** build estático (`cd frontend && npm run build`); sirva a pasta `frontend/dist` (ex.: Nginx na VPS). Em produção defina `VITE_API_URL` com a URL da API (ex.: `https://api.seudominio.com`).

## Workspace (clientes, projetos, lançamentos)

API autenticada em `/api/workspace/*` (JWT + `organizationId`):

- `GET|POST /workspace/clients`, `PATCH|DELETE /workspace/clients/:id`
- `GET|POST /workspace/projects`, `PATCH|DELETE /workspace/projects/:id`
- `GET|POST /workspace/launches`, `PATCH|DELETE /workspace/launches/:id`
- `GET /workspace/members` — usuários da empresa
- `PATCH /auth/profile` — atualizar nome do usuário

No frontend: rotas `/clientes`, `/projetos`, `/lancamentos`, `/configuracoes`, `/perfil`, `/usuarios`, `/assinatura` (antigo `/planos` redireciona), `/admin`, `/plataforma` (admin de plataforma).

Após puxar o código, rode na VPS: `npx prisma migrate deploy` (inclui FK `Project` → `ClientAccount`).

## Google Ads

1. **Google Cloud Console:** projeto, credenciais OAuth 2.0 (tipo “Aplicativo da Web”).
2. **URIs de redirecionamento:** `http://localhost:3000/api/integrations/google-ads/callback` (dev) e a URL da API em produção (ex.: `https://api.seudominio.com/api/integrations/google-ads/callback`).
3. **Backend `.env`:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `API_BASE_URL` (URL pública da API), `FRONTEND_URL`. Para a página Marketing mostrar métricas: `GOOGLE_ADS_DEVELOPER_TOKEN` (googleads.google.com → Ferramentas → Configurações da API).

---

Licença: Proprietário - Ativa Dash
