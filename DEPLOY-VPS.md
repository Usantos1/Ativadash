# Passo a passo completo: deploy na VPS (do zero)

**VPS:** IP `76.13.175.233`  
**Domínios:** `app.ativadash.com` (frontend) e `api.ativadash.com` (API) — já apontando para esse IP.

Requisito: VPS com Ubuntu 22.04 ou 24.04 (ou Debian equivalente). Nada precisa estar instalado.

---

## 1. Conectar na VPS

No seu PC:

```bash
ssh root@76.13.175.233
```

(Se usar outro usuário, troque `root`. Se usar chave, o comando é o mesmo.)

---

## 2. Atualizar o sistema e instalar dependências básicas

```bash
apt update && apt upgrade -y
apt install -y curl git build-essential
```

(Opcional) Firewall — liberar SSH, HTTP e HTTPS:

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

---

## 3. Instalar Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # deve mostrar v20.x
npm -v
```

---

## 4. Instalar PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
```

Criar usuário e banco para o Ativa Dash (troque `SUA_SENHA_SEGURA` por uma senha forte):

```bash
sudo -u postgres psql -c "CREATE USER ativadash WITH PASSWORD 'SUA_SENHA_SEGURA';"
sudo -u postgres psql -c "CREATE DATABASE ativa_dash OWNER ativadash;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ativa_dash TO ativadash;"
```

Anote a connection string (use a mesma senha que colocou acima):

```
postgresql://ativadash:SUA_SENHA_SEGURA@localhost:5432/ativa_dash?schema=public
```

---

## 5. Instalar PM2 e Nginx

```bash
npm install -g pm2
apt install -y nginx
systemctl enable nginx
```

---

## 6. Clonar o repositório na VPS

Se o projeto está no GitHub (público ou com deploy key):

```bash
cd /var
mkdir -p www
cd www
git clone https://github.com/Usantos1/Ativadash.git ativadash
cd ativadash
```

(Se o repo for privado, configure SSH key ou token antes.)

Se **não** usar Git: no seu PC, empacote o projeto (ex.: `zip -r ativadash.zip .` na pasta do projeto) e envie para a VPS com `scp`; na VPS, descompacte em `/ativadash`.

---

## 7. Configurar e subir o backend

```bash
cd /ativadash/backend
```

Criar o arquivo `.env` (substitua os valores pelos seus):

```bash
nano .env
```

Cole (e ajuste):

```env
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://ativadash:SUA_SENHA_SEGURA@localhost:5432/ativa_dash?schema=public"
JWT_SECRET=gere-uma-string-aleatoria-longa-aqui
JWT_REFRESH_SECRET=outra-string-aleatoria-longa
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://app.ativadash.com
API_BASE_URL=https://api.ativadash.com
GOOGLE_CLIENT_ID=seu_client_id_google
GOOGLE_CLIENT_SECRET=seu_client_secret_google
GOOGLE_ADS_DEVELOPER_TOKEN=seu_developer_token_google_ads
```

Salve (Ctrl+O, Enter, Ctrl+X no nano).

Instalar dependências, aplicar migrações do Prisma, buildar e iniciar com PM2:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 start dist/index.js --name ativadash-api
pm2 save
pm2 startup
```

(Siga a instrução que o `pm2 startup` mostrar, se aparecer um comando para copiar/colar.)

Verificar se a API está rodando:

```bash
curl http://127.0.0.1:3000/api/health
```

Deve retornar algo como `{"status":"ok","service":"ativa-dash-api"}`.

---

## 8. Configurar o Nginx (API e app)

Criar config da API:

```bash
nano /etc/nginx/sites-available/ativadash-api
```

Cole:

```nginx
server {
    listen 80;
    server_name api.ativadash.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Salve. Criar config do app (frontend):

```bash
nano /etc/nginx/sites-available/ativadash-app
```

Cole:

```nginx
server {
    listen 80;
    server_name app.ativadash.com;
    root /ativadash/frontend/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Salve. Ativar os sites e testar o Nginx:

```bash
ln -sf /etc/nginx/sites-available/ativadash-api /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/ativadash-app /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

(A pasta `frontend/dist` ainda não existe na VPS; vamos criar no próximo passo.)

---

## 9. Instalar SSL (HTTPS) com Certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.ativadash.com -d app.ativadash.com
```

Siga as perguntas (e-mail, aceitar termos). O Certbot vai alterar os configs do Nginx para usar HTTPS.

Testar renovação automática:

```bash
certbot renew --dry-run
```

**Landing ativadash.com:** Para exibir a página institucional em `https://ativadash.com`, crie o site e inclua no Certbot:

```bash
nano /etc/nginx/sites-available/ativadash-landing
```

Cole (ajuste o caminho se o projeto estiver em outro lugar):

```nginx
server {
    listen 80;
    server_name ativadash.com www.ativadash.com;
    root /ativadash/landing;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Ativar e obter SSL:

```bash
ln -sf /etc/nginx/sites-available/ativadash-landing /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d ativadash.com -d www.ativadash.com
```

A pasta `landing` fica no repositório; após `git pull` em `/ativadash`, o Nginx já servirá o `index.html` da landing.

---

## 10. Build do frontend e enviar para a VPS

**No seu PC** (na pasta do projeto Ativadash), com Node e npm instalados:

```bash
cd frontend
npm ci
VITE_API_URL=https://api.ativadash.com npm run build
```

Isso gera a pasta `frontend/dist`. Enviar só essa pasta para a VPS:

**Opção A — usando rsync (no PC):**

```bash
rsync -avz --delete ./dist/ root@76.13.175.233:/ativadash/frontend/dist/
```

**Opção B — usando scp (no PC):**

```bash
scp -r ./dist root@76.13.175.233:/ativadash/frontend/
```

Na VPS, conferir:

```bash
ls /ativadash/frontend/dist
```

Deve ter `index.html` e pasta `assets/`.

---

## 11. Ajustar permissões (se precisar)

Se o Nginx reclamar de permissão ao servir os arquivos:

```bash
chown -R www-data:www-data /ativadash/frontend/dist
chmod -R 755 /ativadash/frontend/dist
```

---

## 12. Google Cloud Console (OAuth)

1. Acesse [Google Cloud Console](https://console.cloud.google.com/) → seu projeto.
2. **APIs e serviços** → **Credenciais** → clique no cliente OAuth 2.0 (tipo “Aplicativo da Web”).
3. Em **URIs de redirecionamento autorizados**, adicione:
   - `https://api.ativadash.com/api/integrations/google-ads/callback`
4. Salve.

---

## 13. Testar

- **Frontend:** abra no navegador: `https://app.ativadash.com`
- **API:** `https://api.ativadash.com/api/health` (deve retornar JSON com status ok)
- Criar conta ou fazer login em `https://app.ativadash.com` e testar a conexão com Google Ads em Marketing → Integrações.

---

## Resumo dos comandos (referência rápida)

| Onde   | O quê |
|--------|--------|
| VPS    | `apt update && apt upgrade -y` |
| VPS    | Instalar Node 20, PostgreSQL, PM2, Nginx, Git |
| VPS    | Criar usuário e banco Postgres `ativa_dash` |
| VPS    | Clonar repo em `/ativadash` |
| VPS    | `backend/.env` com DATABASE_URL, JWT_*, FRONTEND_URL, API_BASE_URL, Google Ads |
| VPS    | `cd backend && npm ci && npx prisma migrate deploy && npm run build && pm2 start dist/index.js --name ativadash-api` |
| VPS    | Nginx: sites para `api.ativadash.com` (proxy 3000) e `app.ativadash.com` (root frontend/dist) |
| VPS    | `certbot --nginx -d api.ativadash.com -d app.ativadash.com` |
| PC     | `cd frontend && VITE_API_URL=https://api.ativadash.com npm run build` |
| PC     | Enviar `frontend/dist` para `/ativadash/frontend/dist` (rsync ou scp) |
| Google | Callback: `https://api.ativadash.com/api/integrations/google-ads/callback` |
| Meta Ads | Callback: `https://api.ativadash.com/api/integrations/meta-ads/callback` (configurar em developers.facebook.com no app) |

---

## Se algo deu errado (correções na VPS)

**Prisma deu erro “URL must start with file:”**  
O `schema.prisma` no servidor estava com `sqlite`. Atualize o repo e use Postgres:

```bash
cd /ativadash
git pull origin main
```

Confira se `backend/prisma/schema.prisma` tem `provider = "postgresql"`. Depois:

```bash
cd /ativadash/backend
npx prisma generate
npx prisma migrate deploy
npm run build
```

**PM2: “Script not found dist/index.js”**  
O build gera `dist/index.js` (e `dist/routes/`). Use esse entry point:

```bash
cd /ativadash/backend
npm run build
pm2 delete ativadash-api 2>/dev/null; pm2 start dist/index.js --name ativadash-api
pm2 save
curl http://127.0.0.1:3000/api/health
```

**Frontend: “cd frontend: No such file or directory”**  
O build do frontend é feito **no seu PC**, não na VPS. Na VPS a pasta pode ser `../frontend` em relação ao backend:

```bash
ls /ativadash/frontend   # existe?
```

Se não existir, crie e envie o build do PC:

```bash
# Na VPS:
mkdir -p /ativadash/frontend/dist

# No seu PC (na pasta do projeto):
cd frontend
npm ci
VITE_API_URL=https://api.ativadash.com npm run build
scp -r ./dist/* root@76.13.175.233:/ativadash/frontend/dist/
# Ou: rsync -avz --delete ./dist/ root@76.13.175.233:/ativadash/frontend/dist/
```

Na VPS, ajuste permissões:

```bash
chown -R www-data:www-data /ativadash/frontend/dist
chmod -R 755 /ativadash/frontend/dist
```

**rsync do PC para a VPS**  
Só funciona **do seu PC** para o servidor. No PC (primeira vez pode pedir `yes` para o host):

```bash
cd /caminho/para/Ativadash/frontend
VITE_API_URL=https://api.ativadash.com npm run build
rsync -avz --delete ./dist/ root@76.13.175.233:/ativadash/frontend/dist/
```

---

## Atualizar o app depois (frontend)

No PC, após mudanças no frontend:

```bash
cd frontend
VITE_API_URL=https://api.ativadash.com npm run build
rsync -avz --delete ./dist/ root@76.13.175.233:/ativadash/frontend/dist/
```

## Atualizar o backend depois (API)

Na VPS:

```bash
cd /ativadash
git pull   # se usar Git
cd backend
npm ci
npx prisma migrate deploy
npm run build
pm2 restart ativadash-api
```

**Se aparecer** `Process or Namespace ativa-dash-api not found`: o nome correto é `ativadash-api` (sem "iva-"). Liste os processos com `pm2 list`. Se o backend não estiver rodando, suba assim (a partir de `/ativadash/backend`):

```bash
cd /ativadash/backend
pm2 start dist/index.js --name ativadash-api
pm2 save
```

**Variáveis de ambiente no servidor:** use sintaxe bash, não PowerShell. Exemplo: `export VITE_API_URL="https://api.ativadash.com"` antes do comando (no deploy atual o front já usa a API pelo hostname, então não é obrigatório).

---

Licença: Proprietário - Ativa Dash
