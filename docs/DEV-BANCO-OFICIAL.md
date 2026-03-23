# Desenvolvimento local contra o banco oficial (dados reais)

Use este fluxo quando quiser rodar **API + frontend no seu PC**, mas com o **mesmo PostgreSQL** (e portanto os **mesmos usuários e senhas**) do ambiente oficial.

> **Segurança:** a `DATABASE_URL` de produção é segredo. Guarde em gerenciador de senhas ou na VPS; **não** commite no Git (o `.env` já está no `.gitignore`).

---

## O que você precisa

1. A **connection string** do Postgres oficial — a mesma que está no `DATABASE_URL` do backend em produção (formato abaixo).
2. **Rede:** o Postgres precisa ser alcançável da sua máquina:
   - **Recomendado:** túnel SSH (Postgres continua fechado na internet pública), **ou**
   - Firewall liberando **só o seu IP** para a porta do Postgres (não deixe `0.0.0.0/0` aberto).

Formato esperado:

```text
postgresql://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO?schema=public
```

No `DEPLOY-VPS.md` o banco costuma ser `ativa_dash`; host em produção costuma ser `localhost` **dentro da VPS** — do seu PC você usa o **IP/domínio da VPS** ou um túnel.

---

## Passo a passo (backend local + banco oficial)

### 1) `backend/.env`

Copie de `.env.example` e defina:

```env
DATABASE_URL="postgresql://...sua_url_oficial..."
FRONTEND_URL=http://localhost:5173
API_BASE_URL=http://localhost:3000
```

- **`JWT_SECRET` e `JWT_REFRESH_SECRET`** podem ser **diferentes** dos de produção: o login compara a senha com o hash no banco; ao entrar, a API local emite **novos** tokens assinados com o seu segredo local.
- Preencha **Google/Meta** como na produção **só se** for testar OAuth/integrações; para só navegar e logar com e-mail/senha, muitas vezes não é obrigatório.

### 2) Túnel SSH (exemplo)

Se o Postgres na VPS só escuta `127.0.0.1:5432`:

```bash
ssh -N -L 5433:127.0.0.1:5432 usuario@SEU_IP_OU_DOMINIO
```

Deixe esse terminal aberto. No `.env` local use porta **5433**:

```env
DATABASE_URL="postgresql://USUARIO:SENHA@127.0.0.1:5433/ativa_dash?schema=public"
```

(Ajuste usuário, senha e nome do banco ao que a produção realmente usa.)

### 3) Prisma **sem** seed e **sem** `migrate dev` no oficial

| Comando | Ambiente oficial |
|--------|-------------------|
| `npx prisma generate` | ✅ OK (só gera cliente) |
| `npx prisma migrate deploy` | ⚠️ Só se você **sabe** que precisa aplicar migrações pendentes no servidor — impacto em dados/schema |
| `npx prisma migrate dev` | ❌ **Evite** — cria/altera migrações e pode destoar do repo |
| `npx prisma db seed` | ❌ **Não rode** — altera planos e recria/atualiza usuário demo, etc. |

Fluxo típico **só leitura + uso normal da API**:

```bash
cd backend
npm ci
npx prisma generate
npm run dev
```

Confirme:

```bash
curl http://localhost:3000/api/health/db
```

### 4) Frontend

```bash
cd frontend
npm ci
npm run dev
```

O Vite continua enviando `/api` para `http://localhost:3000` — sua API local fala com o **banco oficial**.

### 5) Login

Use o **mesmo e-mail e senha** que você usa em **app.ativadash.com** (ou o domínio oficial). Não há usuário “fake”: tudo vem do banco que você conectou.

---

## Alternativa: apontar o frontend direto para a API oficial

Se a ideia é **não** rodar backend no PC e sim consumir **https://api.ativadash.com**:

- Ajuste a base da API no frontend (variável de ambiente / proxy) para a URL pública.
- CORS no servidor precisa permitir `http://localhost:5173` (já costuma estar em `FRONTEND_URL` em produção se configurado).

Isso usa **dados reais** via API remota, **sem** `DATABASE_URL` local. Útil para só testar UI; para debug de queries/Prisma, use o fluxo com `DATABASE_URL` acima.

---

## Riscos (leia uma vez)

- Qualquer bug ou script local pode **escrever** no banco oficial.
- `migrate` / `seed` / testes destrutivos podem **corromper ou apagar** dados reais.
- Conexão direta Postgres na internet sem túnel/IP fixo aumenta risco de vazamento e brute force.

Para trabalho diário muitas equipes preferem **réplica read-only** ou **dump sanitizado**; para “só eu, ciente do risco”, o túnel + cuidado com comandos costuma ser o mínimo aceitável.

---

## Resumo

| Objetivo | O que fazer |
|----------|-------------|
| Mesmos logins que produção | `DATABASE_URL` → Postgres oficial + `npm run dev` no backend |
| Não usar demo/seed | **Não** rode `prisma db seed` nesse banco |
| Conectar com segurança | Preferir **SSH -L** em vez de expor 5432 ao mundo |

Veja também: [LOCAL-SETUP.md](./LOCAL-SETUP.md) (ambiente 100% local com Docker).
