# Fetcher.io — Hostinger VPS Deployment

> **Status:** Production-ready locally. VPS deployment is **not** performed automatically — use this guide when you are ready to go live.

Production deployment for **fetcherio.dev** on a single Ubuntu 22.04/24.04 VPS with Nginx, PM2, MongoDB, and Redis.

## Architecture

| Subdomain | Purpose | Port |
|-----------|---------|------|
| fetcherio.dev / www | Marketing | 3000 |
| app.fetcherio.dev | Dashboard | 3000 (host routing) |
| docs.fetcherio.dev | Documentation | 3000 |
| admin.fetcherio.dev | Admin panel | 3001 |
| api.fetcherio.dev | Cloud API | 4000 |

Local scraping stays in the Chrome extension + `apps/backend` (SQLite, port 3847) on the user's machine.

## 1. VPS baseline

```bash
# On a fresh Ubuntu VPS as root:
export DEPLOY_USER=deploy
export REPO_URL=https://github.com/YOUR_ORG/fetcherio.git
bash infra/vps/setup.sh
```

This script:
- Creates a sudo deploy user with SSH key auth
- Installs Node 20, pnpm, PM2, Nginx, Certbot, MongoDB, Redis
- Configures UFW (22, 80, 443 only)
- Copies Nginx config from `infra/nginx/fetcherio.conf`

## 2. DNS

In Hostinger DNS panel, add **A records** pointing to your VPS IP:

- `fetcherio.dev`
- `www.fetcherio.dev`
- `app.fetcherio.dev`
- `api.fetcherio.dev`
- `admin.fetcherio.dev`
- `docs.fetcherio.dev`

## 3. TLS certificates

```bash
sudo certbot --nginx \
  -d fetcherio.dev -d www.fetcherio.dev \
  -d app.fetcherio.dev -d api.fetcherio.dev \
  -d admin.fetcherio.dev -d docs.fetcherio.dev
```

## 4. Environment files

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Edit secrets: JWT, MongoDB, Redis, Stripe, Resend, AI keys
```

Generate JWT secrets:
```bash
openssl rand -hex 32  # access
openssl rand -hex 32  # refresh
```

## 5. Build and start

```bash
cd /var/www/fetcherio
pnpm install --frozen-lockfile
pnpm --filter @fetcher/shared build
pnpm --filter @fetcher/api build
pnpm --filter @fetcher/web build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # follow printed command
```

## 6. Verify

```bash
curl -s https://api.fetcherio.dev/health | jq .
curl -sI https://fetcherio.dev | head -1
```

## 7. CI/CD

GitHub Actions workflows:
- `.github/workflows/ci.yml` — build + test on push/PR (runs automatically)
- `.github/workflows/deploy.yml` — **manual only** (`workflow_dispatch` — type `deploy` to confirm)

Deploy is intentionally **not** triggered on push to `main`. When ready:

1. Configure GitHub secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
2. Go to Actions → "Deploy to VPS" → Run workflow → type `deploy`

## 8. Backups

```bash
# Add to crontab (sudo crontab -e):
0 3 * * * MONGODB_URI='mongodb://fetcher:PASSWORD@127.0.0.1:27017/fetcherio?authSource=admin' /var/www/fetcherio/infra/vps/backup.sh
```

Ship backups to off-VPS storage (Hostinger Object Storage, B2, etc.) — never rely on the same disk as the live DB.

## 9. Blue/green deploy rehearsal

```bash
# Start new API on alt port
PORT=4001 pm2 start apps/api/dist/index.js --name fetcherio-api-staging
curl -s http://127.0.0.1:4001/health
# Update nginx upstream, reload, then:
pm2 delete fetcherio-api-staging
pm2 reload fetcherio-api
```

## 10. Docker (optional local/staging)

```bash
docker compose up -d
```

## Rollback

```bash
cd /var/www/fetcherio
git checkout <previous-sha>
pnpm install --frozen-lockfile && pnpm build
pm2 reload ecosystem.config.cjs --update-env
```
