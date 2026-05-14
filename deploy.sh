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
# Motor de automação (regras Meta/Google): em backend/.env defina pelo menos
#   AUTOMATION_WORKER_ENABLED=true
#   AUTOMATION_WORKER_CRON=*/30 * * * *
# Ver backend/.env.example para AUTOMATION_INTERNAL_SECRET e restantes.
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

echo "==> landing-app (LP em ativadash.com): dependências + build"
cd "$ROOT/landing-app"
npm ci
export VITE_API_URL="${VITE_API_URL:-https://api.ativadash.com}"
export VITE_APP_URL="${VITE_APP_URL:-https://app.ativadash.com}"
export VITE_SITE_URL="${VITE_SITE_URL:-https://ativadash.com}"
npm run build

# Sincroniza o build da LP para a pasta servida pelo Nginx em ativadash.com.
# Mantém arquivos legados (legal/) caso ainda estejam fora do build.
LANDING_ROOT="${LANDING_ROOT:-$ROOT/landing}"
echo "==> sincronizando build da LP para $LANDING_ROOT"
mkdir -p "$LANDING_ROOT"
# Remove apenas arquivos versionados antigos da LP (single-file). Não toca em pastas legais.
rm -f "$LANDING_ROOT/index.html" "$LANDING_ROOT"/assets/* 2>/dev/null || true
mkdir -p "$LANDING_ROOT/assets"
cp -f "$ROOT/landing-app/dist/index.html" "$LANDING_ROOT/index.html"
cp -f "$ROOT/landing-app/dist/favicon.svg" "$LANDING_ROOT/favicon.svg" 2>/dev/null || true
cp -f "$ROOT/landing-app/dist/robots.txt" "$LANDING_ROOT/robots.txt" 2>/dev/null || true
cp -f "$ROOT/landing-app/dist/sitemap.xml" "$LANDING_ROOT/sitemap.xml" 2>/dev/null || true
cp -rf "$ROOT/landing-app/dist/assets/." "$LANDING_ROOT/assets/" 2>/dev/null || true

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
echo ""
echo "Landing page em: $LANDING_ROOT (servido em https://ativadash.com)"
echo "  Veja landing/nginx-root.example.conf — root deve apontar para $LANDING_ROOT"
echo "  Cloudflare: Purge Cache no ativadash.com após mudanças no hero/copy."
echo ""
echo "IMPORTANTE: garanta que o backend permite CORS para https://ativadash.com"
echo "  No backend/.env: FRONTEND_URL=https://app.ativadash.com,https://ativadash.com,https://www.ativadash.com"
