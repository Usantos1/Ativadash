# Passo a passo completo: deploy na VPS (do zero)

**VPS:** IP `76.13.175.233`  
**Domínios:** `app.ativadash.com` (frontend) e `api.ativadash.com` (API) — já apontando para esse IP.

Requisito: VPS com Ubuntu 22.04 ou 24.04 (ou Debian equivalente). Nada precisa estar instalado.

### Arquitetura típica: tudo na mesma VPS

Neste deploy, **banco PostgreSQL**, **API (Node + PM2)** e **frontend estático (Nginx)** ficam **no mesmo servidor**:

| Componente | Onde roda | Observação |
|------------|-----------|------------|
| PostgreSQL | `localhost:5432` | Só a própria VPS acessa; não é obrigatório abrir a porta 5432 na internet. |
| API Ativa Dash | `127.0.0.1:3000` | PM2; o Nginx faz `proxy_pass` a partir de `api.ativadash.com`. |
| Frontend (build) | Pastas servidas pelo Nginx | Ex.: `app.ativadash.com` com `root` apontando para `frontend/dist`. |

Por isso o **`DATABASE_URL` no `backend/.env` usa `localhost`** (ou `127.0.0.1`): a API conecta ao Postgres pela **rede interna da VPS**, não pelo IP público da máquina.

---

## Comandos na VPS — caminho padrão `/ativadash`

O repositório fica em **`/ativadash`** (não use `cd /var/www/ativadash` como padrão). Em qualquer sessão SSH:

```bash
cd /ativadash
```

**Primeira vez — clonar o repo na VPS:**

```bash
cd /
git clone https://github.com/Usantos1/Ativadash.git ativadash
cd /ativadash
```

**Deploy / atualização do backend (API + Prisma + PM2):**

```bash
cd /ativadash
git pull origin main
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart ativadash-api
curl -s http://127.0.0.1:3000/api/health
```

Se a API ainda não existir no PM2:

```bash
cd /ativadash/backend
pm2 start dist/index.js --name ativadash-api
pm2 save
```

O **frontend** é buildado no seu PC e o conteúdo de `frontend/dist` vai para **`/ativadash/frontend/dist/`** no servidor (rsync/scp — ver seções mais abaixo). No Nginx, `root` deve ser **`/ativadash/frontend/dist`**.

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

**Caminho padrão do projeto na VPS:** `/ativadash` (raiz do sistema — não use `/var/www/ativadash` a menos que o seu Nginx aponte explicitamente para lá).

Se o projeto está no GitHub (público ou com deploy key):

```bash
cd /
git clone https://github.com/Usantos1/Ativadash.git ativadash
cd /ativadash
```

Se a pasta `/ativadash` **já existir** (deploy subsequente):

```bash
cd /ativadash
git pull origin main
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
# Trust proxy vem ligado por padrão no código (Nginx + localhost com proxy).
# Só use se o Node estiver exposto direto, sem proxy: TRUST_PROXY=false
PORT=3000
DATABASE_URL="postgresql://ativadash:SUA_SENHA_SEGURA@localhost:5432/ativa_dash?schema=public"
JWT_SECRET=gere-uma-string-aleatoria-longa-aqui
JWT_REFRESH_SECRET=outra-string-aleatoria-longa
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
# CORS: pode listar várias origens separadas por vírgula (dev local só com front + API remota):
# FRONTEND_URL=https://app.ativadash.com,http://127.0.0.1:5173,http://localhost:5173
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
    charset utf-8;
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
    charset utf-8;
    root /ativadash/frontend/dist;
    index index.html;

    location ^~ /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        access_log off;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**500 no Nginx com SPA:** evite `location = /index.html` com `alias` ou só `add_header` junto a `try_files … /index.html` — em muitos setups isso gera **500** ou ciclo interno. Use só `location /` + `try_files` como acima; cache do `index.html` fica a cargo de **Cloudflare purge** ou hard refresh. Ficheiro completo: `deploy/nginx-app-spa.example.conf`.

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
    charset utf-8;
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

### Erro clássico ao copiar com `scp`

- **Certo:** o conteúdo de `dist` fica **direto** na pasta do Nginx: nela devem existir `index.html` e `assets/` **no mesmo nível**.
- **Errado:** criar `.../dist/dist/index.html` (pasta `dist` dentro de `dist`) ou enviar para um caminho diferente do `root` do Nginx (ex.: Nginx em `/var/www/...` e cópia em `/ativadash/...`).

---

## 10b. Build do frontend **na VPS** (recomendado se o 500 continua)

Assim o `index.html` fica sempre no repo em `/ativadash` e você só precisa **alinhar o `root` do Nginx** a esse caminho (ou usar o exemplo em `deploy/nginx-app-spa.example.conf`).

Na VPS (uma linha de cada vez):

```bash
cd /ativadash
git pull origin main
cd frontend
npm ci
export VITE_API_URL="https://api.ativadash.com"
npm run build
ls -la dist/index.html dist/assets | head
```

Confirme que o site do app aponta para **essa** pasta:

```bash
grep -R "server_name app.ativadash" /etc/nginx/sites-enabled/ -A 25 | grep -E "root |listen"
```

O `root` deve ser **`/ativadash/frontend/dist`** (com `;` no arquivo). Se estiver `/var/www/ativadash/frontend/dist`, **ou** mude o `root` no Nginx para `/ativadash/frontend/dist`, **ou** copie o build:

```bash
sudo mkdir -p /var/www/ativadash/frontend
sudo rsync -a --delete /ativadash/frontend/dist/ /var/www/ativadash/frontend/dist/
sudo chown -R www-data:www-data /var/www/ativadash/frontend/dist
sudo nginx -t && sudo systemctl reload nginx
```

Checklist rápido (mostra o que o Nginx espera vs. o que existe no disco):

```bash
ROOT=$(grep -R "server_name app.ativadash.com" /etc/nginx/sites-enabled/ -A 40 | grep -E "^\s*root\s+" | head -1 | awk '{print $2}' | tr -d ';')
echo "root do Nginx: $ROOT"
test -f "$ROOT/index.html" && echo "OK: index.html existe" || echo "FALTA index.html — build ou root errado"
```

Exemplo de config mínima versionada no repositório: `deploy/nginx-app-spa.example.conf`.

### Ainda parece “cache” após deploy

1. **Nginx:** use `location /` + `try_files $uri $uri/ /index.html` e opcionalmente `location ^~ /assets/` para cache dos JS/CSS com hash. **Não** combine `location = /index.html` (alias/só headers) com esse `try_files` — causa **500** em vários servidores.
2. **Cloudflare** (se `app.ativadash.com` estiver “laranja”): **Caching → Purge Cache → Purge Everything** (ou purge só em `https://app.ativadash.com/` e `.../index.html`). Opcional: *Page Rule* ou *Cache Rule* com **Cache Level: Bypass** para `app.ativadash.com/index.html` (ou para o path `/`).
3. **Navegador:** teste em aba anônima ou **Ctrl+Shift+R** (recarregar forçado). No DevTools → *Network*, marque **Disable cache** enquanto valida o deploy.

### 500 no `app.ativadash.com` (Nginx)

1. **Obrigatório:** `ls -la /ativadash/frontend/dist/index.html` tem de existir. Se der *No such file*, o **build do front não está na VPS** (só atualizaste o repo/git). Gera `frontend/dist` no PC e envia com `rsync`/`scp` — ver §10.
2. Log: `sudo tail -60 /var/log/nginx/error.log`. A mensagem **`rewrite or internal redirection cycle` … **`/index.html`** quase sempre significa **`index.html` em falta** (ou `root` do Nginx aponta para pasta errada).
3. Permissões: `sudo -u www-data test -r /ativadash/frontend/dist/index.html && echo OK`.
3. Config **mínima** (sem `location = /index.html`): ver `deploy/nginx-app-spa.example.conf`. Se ainda der 500, **apaga** o bloco `location ^~ /assets/` e deixa só `location / { try_files ... }`.
4. Conflito: `sudo nginx -T 2>&1 | grep -n app.ativadash` — não pode haver **dois** `server` com o mesmo `server_name` e `listen 443` a servir o app.

---

## 11. Ajustar permissões (se precisar)

Se o Nginx reclamar de permissão ao servir os arquivos:

```bash
chown -R www-data:www-data /ativadash/frontend/dist
chmod -R 755 /ativadash/frontend/dist
```

### Acentuação (UTF-8) na interface

Se aparecerem caracteres estranhos (símbolos quebrados no lugar de ç, ã, í, etc.):

- Inclua `charset utf-8;` em cada bloco `server { }` do Nginx (já consta nos exemplos deste guia), depois `nginx -t && systemctl reload nginx`.
- Garanta que o código no repositório está em **UTF-8** (há `.editorconfig` na raiz do projeto) e gere de novo o `frontend/dist` antes de enviar à VPS.

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
| VPS    | `cd /ativadash/backend && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build && pm2 start dist/index.js --name ativadash-api` |
| VPS    | Nginx: sites para `api.ativadash.com` (proxy 3000) e `app.ativadash.com` (root frontend/dist) |
| VPS    | `certbot --nginx -d api.ativadash.com -d app.ativadash.com` |
| PC     | `cd frontend && VITE_API_URL=https://api.ativadash.com npm run build` |
| PC     | Enviar `frontend/dist` para `/ativadash/frontend/dist` (rsync ou scp) |
| Google | Callback: `https://api.ativadash.com/api/integrations/google-ads/callback` |
| Meta Ads | Callback: `https://api.ativadash.com/api/integrations/meta-ads/callback` (configurar em developers.facebook.com no app) |

---

## Se algo deu errado (correções na VPS)

**500 em rotas do app (`/planos`, `/dashboard`, etc.) com página “nginx/1.24.0”**

Se já tentou de tudo: faça o **build na VPS** e alinhe o `root` — ver **§ 10b** e o checklist com variável `ROOT` abaixo. Arquivo de referência: `deploy/nginx-app-spa.example.conf`.

Isso é **Nginx / arquivos estáticos**, não a API Node. O React só roda no navegador depois que o `index.html` é entregue. Rotas como `/marketing/conversao`, `/planos` ou `/dashboard` **não existem no backend** — o servidor só precisa devolver o **mesmo** `index.html` para qualquer caminho (SPA); se faltar o arquivo ou o `root` estiver errado, **todas** essas URLs quebram com 500 ou ciclo no log.

Causas frequentes:

1. **Bloco `server` em HTTPS (443) sem `try_files` para SPA** — após o Certbot, às vezes só o `listen 80` ficou correto ou o `location /` do SSL não repete o fallback para `index.html`. Abra o arquivo ativo e confira **os dois** blocos (`listen 80` e `listen 443 ssl`):

   ```nginx
   root /ativadash/frontend/dist;
   index index.html;
   location / {
       try_files $uri $uri/ /index.html;
   }
   ```

2. **`root` do Nginx ≠ pasta onde você copiou o build** — o log costuma mostrar o caminho real, por exemplo:

   `directory index of "/var/www/ativadash/frontend/dist/" is forbidden`

   Enquanto o guia usa `/ativadash/frontend/dist`, na sua VPS o site pode estar com **`root /var/www/ativadash/frontend/dist`**. O `ls` tem que ser **no mesmo caminho** do `root` no arquivo do Nginx:

   ```bash
   grep -R "root " /etc/nginx/sites-enabled/
   ls -la /ativadash/frontend/dist/index.html
   # Se o root no Nginx for outro caminho (ex.: legado /var/www/...), o ls deve ser nesse mesmo caminho.
   ```

3. **`rewrite or internal redirection cycle` ao ir para `/index.html`** — o `try_files ... /index.html` cai num arquivo que **não existe** na pasta `root`. O Nginx tenta de novo e entra em ciclo → **500**. **Correção:** gerar o front no PC e enviar **`index.html` + pasta `assets/`** para o diretório exato do `root` (crie `mkdir -p` se precisar).

4. **`connect() failed (111: Connection refused)` para `127.0.0.1:3000`** — a API Node **não está escutando**. Suba com PM2 (`pm2 start` / `pm2 restart ativadash-api`) e confira `curl http://127.0.0.1:3000/api/health`.

5. **Deploy do front incompleto** — após copiar, na VPS:

   ```bash
   ls -la <MESMO_CAMINHO_DO_ROOT>/index.html
   ls <MESMO_CAMINHO_DO_ROOT>/assets | head
   ```

6. Ver o erro exato do Nginx:

   ```bash
   sudo tail -80 /var/log/nginx/error.log
   ```

   Teste local no servidor (ajuste o host se precisar):

   ```bash
   curl -sI -H "Host: app.ativadash.com" https://127.0.0.1/planos -k
   ```

   Esperado para SPA bem configurada: **200** ou **304** servindo HTML (não 500).

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
git pull origin main
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart ativadash-api
curl -s http://127.0.0.1:3000/api/health
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
