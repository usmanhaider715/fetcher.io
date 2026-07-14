#!/usr/bin/env bash
# Fetcher.io first deploy on shared DailyLens VPS (root required).
# Does NOT touch /var/www/dailylens or dailylens PM2 processes.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/fetcherio}"
REPO_URL="${REPO_URL:-https://github.com/usmanhaider715/fetcher.io.git}"
BRANCH="${BRANCH:-main}"
VPS_IP="${VPS_IP:-187.124.117.113}"

echo "=========================================="
echo " Fetcher.io deploy (isolated from DailyLens)"
echo " App dir: $APP_DIR"
echo " VPS IP:  $VPS_IP"
echo "=========================================="

# pnpm via corepack
corepack enable
corepack prepare pnpm@9 --activate

mkdir -p /var/log/fetcherio

if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"

JWT_ACCESS="$(openssl rand -hex 32)"
JWT_REFRESH="$(openssl rand -hex 32)"

if [ ! -f apps/api/.env ]; then
  cat > apps/api/.env <<EOF
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
MONGODB_URI=mongodb://127.0.0.1:27017/fetcherio
REDIS_URL=redis://127.0.0.1:6379
JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CORS_ORIGINS=http://productfetcher.online,http://www.productfetcher.online,http://app.productfetcher.online,http://admin.productfetcher.online,https://productfetcher.online,https://www.productfetcher.online,https://app.productfetcher.online,https://admin.productfetcher.online
WEB_URL=http://app.productfetcher.online
MARKETING_URL=http://productfetcher.online
EOF
  chmod 600 apps/api/.env
  echo "→ Created apps/api/.env"
else
  echo "→ apps/api/.env exists — keeping it"
fi

cat > apps/web/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://api.productfetcher.online
NEXT_PUBLIC_MARKETING_URL=http://productfetcher.online
NEXT_PUBLIC_APP_URL=http://app.productfetcher.online
EOF

echo "→ Installing dependencies…"
pnpm install --frozen-lockfile

echo "→ Building…"
pnpm --filter @fetcher/shared build
pnpm --filter @fetcher/api build
pnpm --filter @fetcher/web build
bash scripts/postbuild-web-standalone.sh

echo "→ Starting PM2 (fetcherio-* only)…"
pm2 delete fetcherio-api fetcherio-worker fetcherio-web fetcherio-admin 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo "→ Installing nginx site (fetcherio only)…"
cp infra/nginx/fetcherio-http.conf /etc/nginx/sites-available/fetcherio
ln -sf /etc/nginx/sites-available/fetcherio /etc/nginx/sites-enabled/fetcherio
nginx -t && systemctl reload nginx

echo "→ Health checks…"
sleep 5
curl -sf http://127.0.0.1:4000/health | grep -q '"status":"ok"'
curl -sf http://127.0.0.1:3020 -o /dev/null

echo ""
echo "=========================================="
echo " ✓ Fetcher.io deployed (DailyLens untouched)"
echo " Web:  http://productfetcher.online"
echo " API:  http://api.productfetcher.online/health"
echo " App:  http://app.productfetcher.online"
echo " Admin: http://admin.productfetcher.online"
echo ""
echo " Next: certbot --nginx -d productfetcher.online -d www.productfetcher.online \\"
echo "   -d app.productfetcher.online -d api.productfetcher.online -d admin.productfetcher.online -d docs.productfetcher.online"
echo "=========================================="
pm2 status
