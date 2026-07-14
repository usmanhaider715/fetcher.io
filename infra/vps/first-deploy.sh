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
CORS_ORIGINS=http://fetcherio.dev,http://www.fetcherio.dev,http://app.fetcherio.dev,http://admin.fetcherio.dev,https://fetcherio.dev,https://www.fetcherio.dev,https://app.fetcherio.dev,https://admin.fetcherio.dev
WEB_URL=http://app.fetcherio.dev
MARKETING_URL=http://fetcherio.dev
EOF
  chmod 600 apps/api/.env
  echo "→ Created apps/api/.env"
else
  echo "→ apps/api/.env exists — keeping it"
fi

cat > apps/web/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://api.fetcherio.dev
NEXT_PUBLIC_MARKETING_URL=http://fetcherio.dev
NEXT_PUBLIC_APP_URL=http://app.fetcherio.dev
EOF

echo "→ Installing dependencies…"
pnpm install --frozen-lockfile

echo "→ Building…"
pnpm --filter @fetcher/shared build
pnpm --filter @fetcher/api build
pnpm --filter @fetcher/web build

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
echo " Web:  http://fetcherio.dev"
echo " API:  http://api.fetcherio.dev/health"
echo " App:  http://app.fetcherio.dev"
echo " Admin: http://admin.fetcherio.dev"
echo ""
echo " Next: certbot --nginx -d fetcherio.dev -d www.fetcherio.dev \\"
echo "   -d app.fetcherio.dev -d api.fetcherio.dev -d admin.fetcherio.dev -d docs.fetcherio.dev"
echo "=========================================="
pm2 status
