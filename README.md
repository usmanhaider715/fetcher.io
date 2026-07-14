# Fetcher.io

Local-first e-commerce product intelligence platform.

| Surface | Path | Deploy target |
|---------|------|---------------|
| Chrome Extension | `apps/extension` | Chrome Web Store or manual load (not VPS) |
| Local scrape API | `apps/backend` | User's machine (`localhost:3847`) |
| Cloud API | `apps/api` | VPS (`api.productfetcher.online`) |
| Website + Dashboard | `apps/web` | VPS (`productfetcher.online`, `app.`, `admin.`, `docs.`) |

## Quick start (local)

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/backend/.env.example apps/backend/.env

# MongoDB + Redis (cloud API deps)
docker compose up -d mongo redis

pnpm --filter @fetcher/shared build
pnpm dev:api      # :4000
pnpm dev:backend  # :3847
pnpm dev:web      # :3000
pnpm dev:extension
```

Load extension: `chrome://extensions` → Load unpacked → `apps/extension/dist`

## Build all (pre-deploy verify)

```bash
pnpm install
pnpm --filter @fetcher/shared build
pnpm --filter @fetcher/api build
pnpm --filter @fetcher/web build
pnpm --filter @fetcher/backend build
pnpm --filter @fetcher/extension build
pnpm test
```

## Git → VPS deploy flow

1. **Push to GitHub** (see `docs/PRE_DEPLOY_CHECKLIST.md`)
2. **VPS setup** — run `infra/vps/setup.sh` once on Hostinger Ubuntu VPS
3. **Configure secrets** on VPS: `apps/api/.env`, `apps/web/.env.local`
4. **Build + PM2** — `pnpm build && pm2 start ecosystem.config.cjs`
5. **Manual deploy** — GitHub Actions → "Deploy to VPS" → type `deploy`

Full guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Monorepo structure

```
apps/
  api/         Cloud SaaS API (MongoDB, Redis, Stripe, AI proxy)
  backend/     Local scrape/storage API (SQLite, Prisma)
  extension/   Chrome MV3 extension
  web/         Next.js marketing + dashboard + admin
packages/
  shared/      Types, constants
  parsers/     Product detection
  selectors/   Selector engine
infra/
  nginx/       Reverse proxy config
  vps/         Setup + backup scripts
```

## Docs

- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — VPS steps
- [PRE_DEPLOY_CHECKLIST.md](docs/PRE_DEPLOY_CHECKLIST.md) — What you must add before go-live
- [CHANGELOG.md](docs/CHANGELOG.md) — Build history
- [ROADMAP.md](docs/ROADMAP.md) — Product roadmap
