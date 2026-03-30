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
# Se o git pull falhar ("local changes would be overwritten" em deploy.sh):
#   cd /ativadash && git checkout -- deploy.sh && git pull origin main && ./deploy.sh
# (Descarta edições locais só nesse ficheiro; não use se tiveres customizações a preservar — use stash.)
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

API_PORT=3000
if [[ -f "$ROOT/backend/.env" ]]; then
  _p="$(grep -E '^[[:space:]]*PORT=' "$ROOT/backend/.env" | tail -1 | cut -d= -f2- | tr -d '\r' | tr -d '"' | tr -d "'")"
  [[ -n "${_p:-}" ]] && API_PORT="$_p"
fi

echo "==> Concluído. Health check local (PORT=$API_PORT):"
sleep 2
curl -sS "http://127.0.0.1:${API_PORT}/api/health" || true
echo ""
echo "Fingerprint do bundle (confirme após deploy / purge CDN):"
ls -1 "$ROOT/frontend/dist/assets"/index-*.js 2>/dev/null | head -1 || true
echo ""
echo "Frontend em: $ROOT/frontend/dist"
echo "  Verifique: sudo nginx -T 2>&1 | grep -E 'server_name app\\.|root .*dist'"
echo "  O root do Nginx tem de ser esta pasta (ou copiar dist para o root configurado)."
echo "  Cloudflare: Purge Cache no app.ativadash.com se o menu não atualizar."
