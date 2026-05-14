# Ativa Dash · Landing Page

Mini-app **React + Vite + Tailwind** que serve a página institucional em `https://ativadash.com`.

Build estático (`dist/`) é copiado pelo `deploy.sh` para a pasta servida pelo Nginx (substitui o `landing/index.html` antigo). O painel autenticado continua separado em `app.ativadash.com` (sem inflar bundle).

## Desenvolvimento

```bash
cd landing-app
cp .env.example .env.local   # opcional — defaults já apontam pra produção
npm install
npm run dev                  # http://localhost:5174
```

Por padrão o formulário POSTa em `https://api.ativadash.com/api/leads`. Para apontar para uma API local:

```env
VITE_API_URL=http://localhost:3000
```

> Lembre de adicionar `http://localhost:5174` em `FRONTEND_URL` no backend (CORS).

## Build de produção

```bash
npm run build:prod   # cria landing-app/dist/
```

## Deploy

O `deploy.sh` da raiz instala dependências, builda e copia `landing-app/dist/*` para a pasta servida pelo Nginx em `ativadash.com` (ver `landing/nginx-root.example.conf`).

## Estrutura

- `src/components/` — Header, Hero, Features, HowItWorks, ForWhom, Differentials, FAQ, ContactSection, LeadFormModal, Footer.
- `src/lib/api.ts` — submissão do form (`POST /api/leads`) com honeypot e UTMs.
- `src/lib/utm.ts` — leitura de UTMs e referrer.
- `public/` — `favicon.svg`, `robots.txt`, `sitemap.xml`.

## Painel admin

Os leads capturados aparecem em `app.ativadash.com/plataforma/leads` (apenas para staff Ativa Dash, definidos em `PLATFORM_ADMIN_EMAILS`).
