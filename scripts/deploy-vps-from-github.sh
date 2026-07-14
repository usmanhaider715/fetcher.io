#!/usr/bin/env bash
# Pull latest Fetcher.io and reload PM2 — safe on shared DailyLens VPS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Deploy Fetcher.io from GitHub"
git fetch origin main
git pull origin main

corepack enable
corepack prepare pnpm@9 --activate

pnpm install --frozen-lockfile
pnpm --filter @fetcher/shared build
pnpm --filter @fetcher/api build
pnpm --filter @fetcher/web build
bash scripts/postbuild-web-standalone.sh

if pm2 describe fetcherio-api >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
  pm2 save
fi

sleep 5
curl -sf http://127.0.0.1:4000/health | grep -q '"status":"ok"'
curl -sf http://127.0.0.1:3020 -o /dev/null

echo "✓ Fetcher.io deploy complete"
pm2 status | grep -E "fetcherio|dailylens|name"
