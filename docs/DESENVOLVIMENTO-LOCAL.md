# Desenvolvimento local (API + Postgres)

Passo a passo completo e checklist: **[LOCAL-SETUP.md](./LOCAL-SETUP.md)**.

## Erro: “credentials for `ativadash` are not valid”

O backend usa `DATABASE_URL` no `.env`. Esse erro significa que **não existe** usuário/senha/banco iguais aos da URL no PostgreSQL que está em `localhost:5432`, ou o serviço não está rodando.

### Opção A — Postgres com Docker (recomendado)

Na raiz do repositório:

```bash
docker compose up -d
cd backend
npx prisma migrate deploy
npm run dev
```

No `backend/.env`, use:

```env
DATABASE_URL="postgresql://ativadash:ativadash_local_dev@localhost:5432/ativa_dash?schema=public"
FRONTEND_URL=http://localhost:5173
API_BASE_URL=http://localhost:3000
```

Se a porta **5432** já estiver em uso por outro Postgres, pare o outro serviço ou altere a porta no `docker-compose.yml` (ex.: `"5433:5432"`) e ajuste a URL.

### Opção B — Postgres já instalado (pgAdmin / psql)

Conecte como superusuário (`postgres`) e crie o mesmo usuário e banco da sua `DATABASE_URL`, ou ajuste a URL para o usuário que você já usa.

Caracteres especiais na senha precisam estar **codificados na URL** (ex.: `@` → `%40`).

### Frontend

O Vite já faz proxy para `http://localhost:3000`. Para URLs absolutas, veja `frontend/.env.example`.
