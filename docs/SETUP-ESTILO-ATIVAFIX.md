# Setup no estilo Ativafix (Primecamp)

No **Ativafix**, o backend carrega um único `.env` na **raiz do repositório** e usa variáveis **`DB_HOST`**, **`DB_NAME`**, **`DB_USER`**, **`DB_PASSWORD`**, etc., em vez de uma única `DATABASE_URL`. Lá **não** é obrigatório `docker compose`: o Postgres costuma ser um serviço/servidor que você já aponta no `.env`.

O **Ativa Dash** aceita **o mesmo modelo**, além da forma com `DATABASE_URL` só no `backend/.env`. O `docker-compose.yml` deste repo é **opcional** (atalho para Postgres local em container).

## O que foi espelhado

| Ativafix (Primecamp) | Ativa Dash |
|----------------------|------------|
| `.env` na raiz do projeto | `.env` na raiz do repo **ou** `backend/.env` |
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`, `DB_SSL` | Mesmos nomes; a API monta `DATABASE_URL` para o Prisma |
| Backend lê `../.env` em relação a `server/` | `loadAtivadashEnv()` lê raiz + `backend/.env` (este **sobrescreve** a raiz) |
| `npm run dev` no `server/` | `npm run dev` no `backend/` |

## Arquivos de exemplo

- **Raiz:** [`.env.example`](../.env.example) — modelo completo com `DB_*` + JWT + URLs.
- **Backend:** [`backend/.env.example`](../backend/.env.example) — continua válido; pode ser só ajustes locais.

## Comandos Prisma a partir de `DB_*` na raiz

Os scripts `npm run db:*` e `npm run prisma:*` no `backend` passam pelo [`backend/scripts/run-prisma.mjs`](../backend/scripts/run-prisma.mjs), que carrega o `.env` da **raiz** e o `backend/.env` antes de chamar o CLI do Prisma.

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## Ordem de carregamento

1. `Ativadash/.env` (raiz)  
2. `Ativadash/backend/.env` — **override** (ganha em caso de mesma chave)

Depois, se `DATABASE_URL` ainda estiver vazia, ela é montada a partir de `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (e opcionais `DB_PORT`, `DB_SCHEMA`, `DB_SSL`).

## Migração a partir do fluxo antigo (só `backend/.env`)

Nada quebra: quem já usa só `DATABASE_URL` em `backend/.env` continua igual. Quem quiser “igual Ativafix” pode mover as variáveis para o `.env` da raiz e usar `DB_*`.

---

Veja também: [LOCAL-SETUP.md](./LOCAL-SETUP.md).
