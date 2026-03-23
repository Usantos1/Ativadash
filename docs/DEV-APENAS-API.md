# Desenvolvimento sem banco local — só API

Fluxo recomendado quando **não** há PostgreSQL no PC: **todo dado** (leitura e gravação) passa pela **API em produção/staging** (ex.: `https://api.ativadash.com`). O Prisma e o banco rodam **só na VPS**.

## O que você roda no computador

- **Só o frontend** (Vite), por exemplo:
  ```bash
  cd frontend
  npm install
  npm run dev
  ```

- **Não** precisa: Postgres local, Docker do banco, `npm run dev` no `backend`, `prisma migrate` no PC.

## Configuração

1. Na pasta **`frontend`**, crie **`frontend/.env.local`** (não vai para o Git) copiando o exemplo:
   ```bash
   copy .env.local.example .env.local
   ```
   (Linux/macOS: `cp .env.local.example .env.local`)

2. Ajuste a URL da API se for diferente:
   ```env
   VITE_API_URL=https://api.ativadash.com
   ```
   (Sem `/api` no final — o app acrescenta.)

3. **Reinicie o Vite** depois de salvar o `.env.local`.

4. Abra **`http://127.0.0.1:5173`** (ou a URL que o Vite mostrar).

## CORS na API (VPS)

O `FRONTEND_URL` do **backend na VPS** precisa incluir as origens do seu dev local, por exemplo:

```env
FRONTEND_URL=https://app.ativadash.com,http://localhost:5173,http://127.0.0.1:5173
```

Sem isso, o navegador bloqueia as requisições do front local para a API.

## Autenticação e integrações

- Login usa **usuários reais** do banco da VPS (mesma conta que no app online).
- **OAuth (Google/Meta)** no dev local: é preciso ter **redirect URI** autorizado para `http://localhost:5173` / `http://127.0.0.1:5173` nos consoles Google/Meta, se for testar conexão a partir do PC.

## Quando ainda usar backend + Postgres no PC

- Desenvolver **rotas novas** na API, **migrações** ou **seed** — aí sim faz sentido ambiente local com banco (Docker ou túnel). Para **só UI e fluxos** contra dados reais, **apenas API** costuma bastar.

---

Veja também: [BANCO-SO-NA-VPS.md](./BANCO-SO-NA-VPS.md) · [LOCAL-SETUP.md](./LOCAL-SETUP.md)
