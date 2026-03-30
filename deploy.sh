#!/usr/bin/env bash
#
# Deploy na VPS (Ubuntu): backend + Prisma + build do frontend + PM2.
# Uso (na VPS, como root ou usuário com permissões):
#   chmod +x /ativadash/deploy.sh
#   /ativadash/deploy.sh
#
# Opcional: URL da API para o build Vite (padrão produção)
#   VITE_API_URL=https://api.ativadash.com /ativadash/deploy.sh
#
set -euo pipefail

# Raiz do repo = pasta onde está este script (ex.: /ativadash)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PM2_NAME="ativadash-api"

cd "$ROOT"

echo "==> git pull"
git pull origin main

echo "==> backend: dependências + Prisma + build"
cd "$ROOT/backend"
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

echo "==> frontend: dependências + build"
cd "$ROOT/frontend"
npm ci
export VITE_API_URL="${VITE_API_URL:-https://api.ativadash.com}"
npm run build

echo "==> PM2: reiniciar API"
pm2 restart "$PM2_NAME"

echo "==> Concluído. Health check local:"
curl -sS "http://127.0.0.1:3000/api/health" || true
echo ""
echo "Frontend em: $ROOT/frontend/dist (confirme que o Nginx root aponta para este diretório)"
echo "Se usar CDN, faça purge do cache do app após o deploy."
