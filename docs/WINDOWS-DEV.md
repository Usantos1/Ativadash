# Desenvolvimento no Windows — problemas comuns

**Se o PostgreSQL do Ativa Dash existe só na VPS:** configurar `localhost` no `.env` do **PC** não alcança esse banco. Veja **[BANCO-SO-NA-VPS.md](./BANCO-SO-NA-VPS.md)** (túnel SSH ou banco local de dev).

---

## 0) Login 503 / “não foi possível conectar ao banco”

1. Teste o Postgres **antes** de subir o app:
   ```powershell
   cd backend
   npm run check:db
   ```
2. Se falhar e você usa **Postgres instalado no Windows** (sem Docker), crie `backend/.env.local` a partir de **`backend/.env.local.example`**, coloque a **senha real** do usuário `postgres` e rode `npm run check:db` de novo.
3. Abra o app em **`http://127.0.0.1:5173`** (o Vite está configurado para HMR estável nesse host).

### Ainda dá `P1000` com usuário `postgres`?

Isso **não** é o Prisma “errado”: o servidor Postgres em `127.0.0.1:5432` **rejeitou** usuário/senha.

1. **Você editou o `.env.local`?** A linha não pode continuar com o texto `COLOQUE_SUA_SENHA_AQUI` — tem que ser a **mesma senha** que você usa no pgAdmin / na instalação do Postgres.
2. **Teste a senha fora do Node** (vai pedir senha no prompt):
   ```powershell
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h 127.0.0.1 -d postgres
   ```
   (Troque `16` pela sua versão.) Se nem o `psql` entrar, a senha está errada ou o serviço não é esse.
3. **Serviço rodando?** `services.msc` → procure **postgresql** → **Iniciar**.
4. **Senha com `@`, `#`, etc.?** Na URL ela precisa ser **codificada** (veja comentários no `backend/.env.local.example`).
5. **Banco `ativa_dash` existe?** Se só existir `postgres`, crie:
   ```sql
   CREATE DATABASE ativa_dash OWNER postgres;
   ```

Se você **não lembra** a senha do `postgres`, use o **pgAdmin** (conectou uma vez?) ou redefina a senha pela documentação da sua versão do PostgreSQL no Windows.

---

## 1) `EPERM` no `prisma generate` (rename do `query_engine-windows.dll.node`)

O Windows (Defender, indexação, outro processo) segura o arquivo enquanto o Prisma tenta trocar o binário.

**Tente nesta ordem:**

1. Feche **terminais** que rodem `npm run dev`, **Cursor/VS Code** por um instante (ou pelo menos pare o servidor TS), e rode de novo:
   ```powershell
   cd backend
   Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue
   npm run prisma:generate
   ```
2. Se continuar: **Exclusão no Windows Defender** — adicione a pasta do projeto `Ativadash` em *Exclusões* (pastas).
3. Rode o **PowerShell como administrador** e execute o `prisma:generate` de novo.
4. Alternativa (evita o wrapper):  
   `cd backend` → `npx prisma generate`  
   (o erro costuma ser o mesmo; o bloqueio é no sistema de arquivos.)

---

## 2) `P1000` — credenciais inválidas para `ativadash` em `localhost`

**Sintoma no terminal:** `Authentication failed ... credentials for 'ativadash' are not valid` ao logar ou rodar Prisma.

**Causa:** o Postgres instalado no Windows costuma ter só o usuário **`postgres`**. O `.env` padrão usa **`ativadash`** / **`ativadash_local_dev`**, que **ainda não existem** até você criar ou alinhar a URL.

**Solução rápida (recomendada):** no repo, já existe o script SQL:

```powershell
cd C:\Users\Uander\Documents\GitHub\Ativadash\backend
```

Execute com o `psql` da sua instalação (troque `16` pela versão instalada):

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -f scripts\setup-local-postgres.sql
```

(Senha: a que você definiu na instalação do Postgres para `postgres`.)

Depois:

```powershell
npm run prisma:migrate
npm run prisma:seed
```

**Alternativas:** usar só o usuário `postgres` no `DATABASE_URL` (veja comentários no `backend/.env`); ou `docker compose up -d` na raiz se usar Docker.

---

## 3) `EADDRINUSE` — porta 3000 em uso

Outro processo (outra API, outro `npm run dev`) já está na **3000**.

**Ver o PID no PowerShell:**

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object OwningProcess
```

Ou:

```powershell
netstat -ano | findstr ":3000"
```

Na última coluna aparece o **PID**. Encerre:

```powershell
Stop-Process -Id PID_AQUI -Force
```

**Ou** mude a porta no `backend/.env`:

```env
PORT=3001
```

Se usar `3001` no backend, suba o Vite com a variável (PowerShell):

```powershell
$env:ATIVADASH_API_PORT="3001"; npm run dev
```

(O proxy do Vite lê `ATIVADASH_API_PORT`; o padrão continua **3000**.)

---

## Ordem sugerida depois de corrigir

```powershell
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Em outro terminal: `cd frontend` → `npm run dev`.

Teste: `http://localhost:3000/api/health/db` deve responder com `"ok": true` quando o Postgres e a URL estiverem certos.
