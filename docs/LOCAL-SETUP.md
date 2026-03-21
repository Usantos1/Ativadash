# Setup local — PostgreSQL + Prisma + API + frontend

Checklist rápido:

- [ ] PostgreSQL em execução (porta **5432** ou a que você configurou)
- [ ] Usuário, senha e banco criados (**iguais** à `DATABASE_URL` do `backend/.env`)
- [ ] Arquivo `backend/.env` criado a partir de `backend/.env.example`
- [ ] `npx prisma generate`
- [ ] `npx prisma migrate dev` (ou `migrate deploy` se preferir só aplicar migrações)
- [ ] `npx prisma db seed`
- [ ] Backend: `npm run dev` (pasta `backend`)
- [ ] Frontend: `npm run dev` (pasta `frontend`)

Documentação relacionada: [DESENVOLVIMENTO-LOCAL.md](./DESENVOLVIMENTO-LOCAL.md) (Docker na raiz).

---

## Valores esperados (padrão do repositório)

| Item | Valor padrão |
|------|----------------|
| **Host** | `localhost` |
| **Porta** | `5432` |
| **Usuário PostgreSQL** | `ativadash` |
| **Senha** | `ativadash_local_dev` (exemplo; defina a sua e use a mesma na URL) |
| **Nome do banco** | `ativa_dash` |

`DATABASE_URL` correspondente:

```env
DATABASE_URL="postgresql://ativadash:ativadash_local_dev@localhost:5432/ativa_dash?schema=public"
```

O `schema.prisma` usa `env("DATABASE_URL")` — não é necessário mudar o schema para desenvolvimento com Postgres.

---

## Erro: “Authentication failed… credentials for `ativadash` are not valid”

O PostgreSQL em `localhost:5432` **não aceitou** o usuário `ativadash` com a senha que está na sua `DATABASE_URL`.

### 1) Docker Compose — volume antigo (causa muito comum)

Se você já rodou o Postgres com **outra** senha ou outro `docker-compose.yml`, o **volume** guarda o cluster antigo: mudar `POSTGRES_PASSWORD` no arquivo **não** altera o usuário já criado.

**Recriar do zero** (apaga dados locais do container):

```bash
# Na raiz do repositório
docker compose down -v
docker compose up -d
```

Depois, no `backend`:

```bash
npx prisma migrate deploy
npx prisma db seed
```

### 2) Postgres instalado no Windows (sem Docker)

O servidor padrão costuma ter só o usuário **`postgres`**. Ou você **cria** o usuário `ativadash` (seção SQL abaixo) ou altera a `DATABASE_URL` para o usuário/senha que você já usa, por exemplo:

```env
DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/ativa_dash?schema=public"
```

(Crie o banco `ativa_dash` antes, se não existir.)

### 3) Ajustar só a senha do usuário `ativadash`

Conectado como superusuário no `psql`:

```sql
ALTER USER ativadash WITH PASSWORD 'ativadash_local_dev';
```

Use **exatamente** a mesma senha na `DATABASE_URL`.

### 4) Outros checks

1. Serviço Postgres (ou Docker) **rodando** na porta **5432**.
2. Nada de aspas **duplicadas** dentro da URL no `.env` (uma linha: `DATABASE_URL="postgresql://..."`).
3. Se `localhost` falhar no Windows, teste `127.0.0.1` no lugar de `localhost` na URL.

---

## Criar usuário e banco (SQL)

Conecte como superusuário (`postgres`) no `psql` ou pgAdmin e execute (ajuste a senha se quiser):

```sql
CREATE USER ativadash WITH PASSWORD 'ativadash_local_dev';
CREATE DATABASE ativa_dash OWNER ativadash;
GRANT ALL PRIVILEGES ON DATABASE ativa_dash TO ativadash;
```

No PostgreSQL 15+, após criar o banco, conceda uso do schema `public`:

```sql
\c ativa_dash
GRANT ALL ON SCHEMA public TO ativadash;
GRANT CREATE ON SCHEMA public TO ativadash;
```

---

## Opção Docker (Postgres só para dev)

Na **raiz** do repositório:

```bash
docker compose up -d
```

Use no `backend/.env` a mesma `DATABASE_URL` do exemplo acima (alinhada ao `docker-compose.yml`). Depois:

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Para iterar em migrações novas durante o desenvolvimento, prefira:

```bash
npx prisma migrate dev
```

---

## Comandos backend (pasta `backend`)

```bash
cd backend
npm ci
cp .env.example .env    # ou copie manualmente no Windows
# Edite .env — principalmente DATABASE_URL e JWT_*

npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Scripts equivalentes no `package.json`:

- `npm run db:generate` → `prisma generate`
- `npm run db:migrate` → `prisma migrate dev`
- `npm run db:seed` → seed via `tsx prisma/seed.ts`

---

## Usuário demo (após seed)

| Campo | Valor |
|--------|--------|
| **E-mail** | `demo@ativadash.com` |
| **Senha** | `demo123` |

---

## Login e erros de banco

Se o Prisma não conseguir conectar (credenciais, Postgres parado, banco inexistente), a API responde com **503** e mensagem genérica, **sem** expor stack trace nem detalhes do Prisma na rota de login/cadastro.

---

## Frontend (pasta `frontend`)

```bash
cd frontend
npm ci
npm run dev
```

O Vite costuma usar proxy para a API em `http://localhost:3000`; se usar URLs absolutas, veja `frontend/.env.example`.
