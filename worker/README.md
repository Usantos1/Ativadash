# Ativa Dash – API (Cloudflare Worker + D1)

API de autenticação e integrações (Google Ads) rodando em Worker com banco D1.

## Desenvolvimento local

```bash
npm install
# Crie o banco e coloque database_id no wrangler.toml
npx wrangler d1 create ativadash-db
npx wrangler d1 execute ativadash-db --local --file=./schema.sql
# Secrets locais: copie .dev.vars.example para .dev.vars e preencha JWT_SECRET e JWT_REFRESH_SECRET
npm run dev
```

O Worker sobe em `http://localhost:8787`. Use `http://localhost:8787` como `VITE_API_URL` no frontend para testar contra o Worker.

## Deploy

Ver **DEPLOY-CLOUDFLARE-PAGES.md** na raiz do repositório (schema D1 remoto, secrets, variáveis e deploy do Worker).

## Rotas

- `POST /api/auth/register` – cadastro
- `POST /api/auth/login` – login
- `POST /api/auth/refresh` – refresh token
- `GET /api/auth/me` – usuário atual (Bearer)
- `GET /api/integrations` – listar (Bearer)
- `GET /api/integrations/google-ads/auth-url` – URL OAuth (Bearer)
- `GET /api/integrations/google-ads/callback` – callback Google (sem auth)
- `DELETE /api/integrations/:id` – desvincular (Bearer)
