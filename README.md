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

1. **PostgreSQL:** crie um banco (ex.: `ativa_dash`) ou use SQLite para testar (veja abaixo).
2. **Backend:**

```bash
cd backend
cp .env.example .env   # Ajuste DATABASE_URL, JWT_*, GOOGLE_*
npm install
npx prisma migrate dev --name init
npm run dev
```

3. **Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Acesse **http://localhost:5173**. O proxy aponta `/api` para `http://localhost:3000`.

**Dev com SQLite (sem PostgreSQL):** em `backend/prisma/schema.prisma` troque `provider` para `sqlite` e `url` para `env("DATABASE_URL")`; no `.env` use `DATABASE_URL="file:./dev.db"`. Rode `npx prisma migrate dev`.

## Deploy (VPS + PostgreSQL)

- **Backend:** rode na VPS (Node + PM2 ou similar). Banco **PostgreSQL**; variáveis em `backend/.env` (ou ambiente). Ver `DEPLOY-VPS.md`.
- **Frontend:** build estático (`cd frontend && npm run build`); sirva a pasta `frontend/dist` (ex.: Nginx na VPS). Em produção defina `VITE_API_URL` com a URL da API (ex.: `https://api.seudominio.com`).

## Google Ads

1. **Google Cloud Console:** projeto, credenciais OAuth 2.0 (tipo “Aplicativo da Web”).
2. **URIs de redirecionamento:** `http://localhost:3000/api/integrations/google-ads/callback` (dev) e a URL da API em produção (ex.: `https://api.seudominio.com/api/integrations/google-ads/callback`).
3. **Backend `.env`:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `API_BASE_URL` (URL pública da API), `FRONTEND_URL`. Para a página Marketing mostrar métricas: `GOOGLE_ADS_DEVELOPER_TOKEN` (googleads.google.com → Ferramentas → Configurações da API).

---

Licença: Proprietário - Ativa Dash
