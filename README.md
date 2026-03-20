# Ativa Dash

Plataforma de dashboards de marketing, vendas, funis e integrações para agências, gestores de tráfego, lançadores e negócios com vendas por WhatsApp.

## Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Recharts, TanStack Table, Zustand
- **Backend:** Node.js, Express, Prisma (SQLite local / PostgreSQL na VPS)
- **Auth:** JWT + refresh token, multi-tenant

## Estrutura

```
Ativadash/
├── frontend/     # App React
├── backend/      # API Express + Prisma
└── package.json  # Scripts raiz
```

## Testar em localhost (sem PostgreSQL / sem VPS)

O projeto usa **Prisma** como ORM. Para rodar local está configurado com **SQLite**: o banco é um arquivo (`backend/prisma/dev.db`), não precisa instalar PostgreSQL.

```bash
# 1. Instalar dependências
npm install
cd frontend && npm install
cd ../backend && npm install

# 2. Criar o banco e popular (na pasta backend)
cd backend
npx prisma migrate dev --name init
npm run db:seed

# 3. Subir API e front (em terminais separados, ou na raiz: npm run dev)
npm run dev:backend    # http://localhost:3000
npm run dev:frontend  # http://localhost:5173
```

Acesse **http://localhost:5173**. Use **Cadastro** ou **Login demo:** `demo@ativadash.com` / `demo123`.

Quando tiver PostgreSQL na VPS: em `backend/prisma/schema.prisma` troque `provider` para `postgresql` e `url` para `env("DATABASE_URL")`; no `.env` configure `DATABASE_URL` do Postgres.

## Integração Google Ads

1. **Google Cloud Console:** crie um projeto, ative a API do Google Ads (ou use escopo apenas OAuth).
2. **Credenciais:** APIs e Serviços > Credenciais > Criar credenciais > ID do cliente OAuth 2.0 (tipo "Aplicativo da Web").
3. **URIs de redirecionamento:** adicione `http://localhost:3000/api/integrations/google-ads/callback` (desenvolvimento) ou a URL da sua API em produção.
4. **Variáveis no backend:** no `backend/.env` defina:
   - `GOOGLE_CLIENT_ID=` (ID do cliente)
   - `GOOGLE_CLIENT_SECRET=` (Chave secreta do cliente)
   - `API_BASE_URL=http://localhost:3000` (URL pública da API; em produção use https://sua-api.com)
5. No app, vá em **Marketing > Integrações** e clique em **Conectar** no card Google Ads. Conclua o fluxo OAuth no Google; ao voltar, a integração aparecerá como conectada.

## Deploy (VPS + PM2)

```bash
npm run build
# Configurar PM2 com ecosystem.config.js
```

## Licença

Proprietário - Ativa Dash
