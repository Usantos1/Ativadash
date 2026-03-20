# Deploy no Cloudflare (tudo no Worker + Pages)

A API roda em um **Cloudflare Worker** com **D1**. O frontend roda em **Cloudflare Pages**. Não é necessário VPS.

**Importante:** são **dois projetos diferentes** na Cloudflare (um Pages para o frontend e um Worker para a API). **Não use** o build da raiz do repo (`npm run build`): ele compila backend Node + frontend e não é o que a Cloudflare deve rodar.

## 1. API no Worker (D1 + secrets)

### 1.1 Criar o banco D1

No diretório do Worker:

```bash
cd worker
npm install
npx wrangler d1 create ativadash-db
```

Anote o **database_id** e coloque no `wrangler.toml` em `[[d1_databases]]` → `database_id = "..."`.

### 1.2 Aplicar o schema no D1

```bash
npx wrangler d1 execute ativadash-db --remote --file=./schema.sql
```

### 1.3 Variáveis e secrets

No dashboard: **Workers & Pages** → seu Worker → **Settings** → **Variables and Secrets**:

- **Variables (plain):**
  - `FRONTEND_URL`: URL do frontend (ex: `https://seu-projeto.pages.dev`)
  - `API_BASE_URL`: URL do próprio Worker (ex: `https://ativadash-api.xxx.workers.dev`) — usada no callback do Google Ads

- **Secrets** (Encrypted):
  - `JWT_SECRET`: string aleatória forte (ex: `openssl rand -base64 32`)
  - `JWT_REFRESH_SECRET`: outra string aleatória forte
  - `GOOGLE_CLIENT_ID`: Client ID do OAuth Google (Google Ads)
  - `GOOGLE_CLIENT_SECRET`: Client secret do OAuth Google

Ou via CLI:

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put JWT_REFRESH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

### 1.4 Deploy do Worker

**Opção A – Deploy pelo seu PC (recomendado):**

```bash
cd worker
npm run deploy
```

**Opção B – Worker conectado ao Git (CI):**  
No dashboard do Worker, em **Settings** → **Build** (ou Build configuration):

- **Root directory:** `worker` (se a interface tiver esse campo).
- **Build command:** `npm ci && npm run deploy` (para rodar a partir da pasta `worker`).

Se não houver “Root directory”, use Build command: `cd worker && npm ci && npx wrangler deploy`.

Anote a URL do Worker (ex: `https://ativadash-api.xxx.workers.dev`). Ela será a base da API (`/api/...`).

---

## 2. Frontend no Pages

1. **Workers e Pages** → **Create** → **Pages** → **Connect to Git**.
2. Repositório: **Ativadash** (ou o que você usar).
3. **Build configuration** (obrigatório alterar):
   - **Build command:** `cd frontend && npm ci && npm run build`  
     (não use `npm run build` da raiz)
   - **Build output directory:** `frontend/dist`
4. **Root directory:** deixe em branco (raiz do repo).
5. Em **Settings** → **Environment variables** (Production):
   - `VITE_API_URL` = URL do Worker, ex: `https://ativadash-api.xxx.workers.dev`

Assim o frontend passa a chamar a API no Worker em produção. Em desenvolvimento, sem `VITE_API_URL`, continua usando o proxy para `http://localhost:3000` (backend Node) ou você pode apontar para o Worker em dev.

**Se o build atual está falhando ou rodando backend:** no projeto **Pages**, em **Settings** → **Builds & deployments** → **Build configurations**, troque o comando de build para exatamente `cd frontend && npm ci && npm run build` e o diretório de saída para `frontend/dist`.

---

## 3. Resumo

| Parte        | Onde roda   | Observação                          |
|-------------|-------------|-------------------------------------|
| API (auth, integrações) | Worker + D1 | Deploy com `wrangler deploy` em `worker/` |
| Frontend    | Pages       | Build `frontend/`, variável `VITE_API_URL` |
| Banco       | D1          | Schema em `worker/schema.sql`       |

Não é necessário VPS: tudo fica na Cloudflare (Worker + D1 + Pages).
