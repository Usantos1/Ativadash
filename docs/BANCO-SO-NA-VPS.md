# O banco está só na VPS — por que `localhost` no PC não funciona

No seu **Windows**, `127.0.0.1` / `localhost` é **só a sua máquina**.  
O PostgreSQL que alimenta o Ativa Dash em **produção** roda **dentro da VPS** (e lá sim o `DATABASE_URL` usa `localhost`).

Ou seja:

| Onde roda o Node (Prisma) | `localhost` na URL significa |
|---------------------------|------------------------------|
| **Na VPS** | O Postgres na mesma VPS — **correto** em produção. |
| **No seu PC** | Um Postgres **no seu PC** — se você **não** instalou/Docker, **não existe** → `P1000` / conexão recusada. |

Não é bug do projeto: é **rede**. O PC não “enxerga” o banco da VPS só porque você colocou `localhost` no `.env` local.

---

## O que você pode fazer

### Opção A — Túnel SSH (recomendado para dev com dados reais)

1. No PC, deixe um terminal aberto:

   ```bash
   ssh -N -L 5433:127.0.0.1:5432 usuario@IP_OU_DOMINIO_DA_VPS
   ```

2. No **`backend/.env.local`** (não commite), use **usuário, senha e banco iguais aos da VPS**, mas host/porta do túnel:

   ```env
   DATABASE_URL="postgresql://ativadash:SENHA@127.0.0.1:5433/ativa_dash?schema=public"
   ```

   (Codifique caracteres especiais na senha na URL: `@` → `%40`, etc.)

3. `npm run check:db` → `npm run dev` no backend.

Guia mais completo: **[DEV-BANCO-OFICIAL.md](./DEV-BANCO-OFICIAL.md)**.

### Opção B — Postgres só no PC (dev isolado)

Use **Docker** (`docker compose up -d` na raiz) **ou** Postgres instalado no Windows + `setup-local-postgres.sql`. Aí `localhost` no `.env` faz sentido, mas é **outro banco** (não o da VPS), até você rodar `migrate`/`seed`.

### Opção C — Abrir porta 5432 na VPS para o seu IP

Possível, porém **arriscado** se mal configurado. Prefira túnel SSH.

### Opção D — Só frontend local, API na nuvem (**recomendado**)

Rodar **só o Vite** com `VITE_API_URL` apontando para a API — **nenhum** acesso a banco no PC. Passo a passo: **[DEV-APENAS-API.md](./DEV-APENAS-API.md)**. Na VPS, `FRONTEND_URL` deve incluir `http://127.0.0.1:5173` e `http://localhost:5173`.

---

## Resumo

- **Banco só na VPS** + **`.env` local com `localhost`** → **não vai funcionar** até você criar um **túnel**, **expor** a porta com cuidado, ou **subir um Postgres local** só para desenvolvimento.
