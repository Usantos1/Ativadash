# Setup local — PostgreSQL + Prisma + API + frontend

**Sem banco no PC — tudo pela API (recomendado para UI contra dados reais):** **[DEV-APENAS-API.md](./DEV-APENAS-API.md)** (`frontend/.env.local` + `VITE_API_URL`).

**Quer dados reais (mesmo banco/login da produção)?** Veja **[DEV-BANCO-OFICIAL.md](./DEV-BANCO-OFICIAL.md)** — `DATABASE_URL` para o Postgres oficial, túnel SSH e o que **não** rodar (`seed`, `migrate dev`).

**Quer um `.env` na raiz com `DB_*` como no Ativafix?** Veja **[SETUP-ESTILO-ATIVAFIX.md](./SETUP-ESTILO-ATIVAFIX.md)** e o arquivo **[.env.example](../.env.example)** na raiz do repositório.

**Windows:** `EPERM` no Prisma, `P1000` (senha/usuário) ou porta **3000** ocupada → **[WINDOWS-DEV.md](./WINDOWS-DEV.md)**.

**Banco só existe na VPS?** `localhost` no seu PC **não** é o banco da VPS → **[BANCO-SO-NA-VPS.md](./BANCO-SO-NA-VPS.md)** (túnel SSH ou Postgres local para dev).

---

## Checklist rápido (ordem)

1. **Ter um PostgreSQL acessível** (igual ao Ativafix: **não precisa** de Docker).  
   - **Estilo Ativafix:** Postgres já rodando em algum host (serviço no Windows, servidor remoto, etc.) — configure `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` no `.env` (raiz ou `backend/.env`).  
   - **Opcional:** na raiz do repo, `docker compose up -d` sobe um Postgres só para quem **quer** container local (mesmos usuário/senha/banco do `docker-compose.yml`).  
   - **Postgres nativo local:** crie usuário/banco (SQL abaixo) e use a mesma `DATABASE_URL` ou `DB_*`.

2. **Criar variáveis de ambiente** — escolha um dos fluxos:
   - **Raiz (estilo Ativafix):** copie [`.env.example`](../.env.example) para `.env` na raiz e preencha `DB_*` (ou `DATABASE_URL`).
   - **Só backend:** copie `backend/.env.example` → `backend/.env` e preencha `DATABASE_URL` (ou `DB_*` no mesmo arquivo).
   - Se existirem os dois, **`backend/.env` sobrescreve** a raiz para chaves repetidas.

3. Na pasta **`backend`**:
   ```bash
   npm ci
   npm run prisma:generate
   npm run prisma:migrate
   npm run prisma:seed
   npm run dev
   ```
   (`prisma:migrate` = `prisma migrate dev` — aplica migrações e atualiza o cliente.)

4. **Conferir o banco** (com a API rodando em `:3000`):
   ```bash
   curl http://localhost:3000/api/health
   curl http://localhost:3000/api/health/db
   ```
   - `/api/health` → sempre `ok` se o processo Node está no ar.  
   - `/api/health/db` → `ok: true` só se o Prisma conectou ao PostgreSQL.

5. Na pasta **`frontend`**: `npm ci` → `npm run dev` (Vite em `http://localhost:5173`, proxy `/api` → `:3000`).

6. **Login local** (após seed):  
   - E-mail: **`demo@ativadash.com`**  
   - Senha: **`demo123`**

---

## Nome do banco (importante)

O repositório **não** usa o nome de banco `ativadash` como padrão. O padrão alinhado ao `docker-compose.yml` e ao seed é:

| Item | Valor padrão |
|------|----------------|
| **Banco (database)** | `ativa_dash` |
| **Usuário** | `ativadash` |
| **Senha** | `ativadash_local_dev` (exemplo) |
| **Host** | `localhost` |
| **Porta** | `5432` |

`DATABASE_URL` exata:

```env
DATABASE_URL="postgresql://ativadash:ativadash_local_dev@localhost:5432/ativa_dash?schema=public"
```

O `schema.prisma` usa `env("DATABASE_URL")` — não é necessário alterar o schema para desenvolvimento local com Postgres.

---

## SQL: usuário e banco (Postgres nativo, sem Docker)

Como superusuário (`postgres`):

```sql
CREATE USER ativadash WITH PASSWORD 'ativadash_local_dev';
CREATE DATABASE ativa_dash OWNER ativadash;
GRANT ALL PRIVILEGES ON DATABASE ativa_dash TO ativadash;
```

PostgreSQL 15+ — após criar o banco, permissões no schema `public`:

```sql
\c ativa_dash
GRANT ALL ON SCHEMA public TO ativadash;
GRANT CREATE ON SCHEMA public TO ativadash;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ativadash;
```

---

## Comandos Prisma (pasta `backend`)

| Objetivo | Comando |
|----------|---------|
| Gerar client | `npx prisma generate` ou `npm run prisma:generate` |
| Aplicar migrações (dev) | `npx prisma migrate dev` ou `npm run prisma:migrate` |
| Seed | `npx prisma db seed` ou `npm run prisma:seed` |

Scripts legados equivalentes: `npm run db:generate`, `db:migrate`, `db:seed`.

---

## Erro 503 no login / “não foi possível conectar ao banco”

1. Confira **`GET /api/health/db`** — se retornar 503, o problema é Postgres ou `DATABASE_URL`.  
2. No **terminal do backend** aparece um bloco `[database] Falha (...)` com código Prisma/motivo e um resumo da URL (sem senha).  
3. A **resposta HTTP** para o frontend continua **genérica** (sem stack nem detalhes sensíveis).

### Docker: volume antigo com senha diferente

```bash
docker compose down -v
docker compose up -d
cd backend
npx prisma migrate deploy
npx prisma db seed
```

### Windows: `localhost` vs `127.0.0.1`

Se falhar com `localhost`, teste na URL: `@127.0.0.1:5432`.

---

## Frontend

```bash
cd frontend
npm ci
npm run dev
```

Proxy Vite: `/api` → `http://localhost:3000` (ver `vite.config.ts`).

---

## Usuário demo (seed)

| Campo | Valor |
|--------|--------|
| E-mail | `demo@ativadash.com` |
| Senha | `demo123` |

Cada execução do seed **atualiza** a senha do demo para `demo123` (útil após reset do banco).

---

Documentação relacionada: [DESENVOLVIMENTO-LOCAL.md](./DESENVOLVIMENTO-LOCAL.md).
