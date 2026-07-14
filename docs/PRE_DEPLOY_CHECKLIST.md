# Pre-Deploy Checklist

Use this before pushing to GitHub and deploying to Hostinger VPS.

## ✅ Already in the repo (code-ready)

- [x] Cloud API (`apps/api`) — auth, billing, AI, connectors, admin, OpenAPI
- [x] Next.js website + dashboard (`apps/web`)
- [x] Chrome extension build (`apps/extension`)
- [x] Local backend (`apps/backend`)
- [x] Docker Compose for MongoDB + Redis
- [x] Nginx, PM2, VPS setup scripts
- [x] CI workflow (build + test on push)
- [x] Manual-only deploy workflow

## 🔲 You must add (not in repo — secrets & accounts)

### GitHub
- [ ] Create GitHub repository and push this monorepo
- [ ] Add secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`

### Domain & DNS (Hostinger panel)
- [ ] Register `productfetcher.online` (or your domain)
- [ ] A records → VPS IP: `@`, `www`, `app`, `api`, `admin`, `docs`

### VPS (`apps/api/.env`)
- [ ] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (32+ chars each)
- [ ] `MONGODB_URI` (self-hosted or Atlas)
- [ ] `REDIS_URL` (with password)
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs
- [ ] `RESEND_API_KEY` (email verification + password reset)
- [ ] `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (AI proxy)
- [ ] `CORS_ORIGINS` — production domains

### VPS (`apps/web/.env.local`)
- [ ] `NEXT_PUBLIC_API_URL=https://api.productfetcher.online`
- [ ] `NEXT_PUBLIC_MARKETING_URL=https://productfetcher.online`
- [ ] `NEXT_PUBLIC_APP_URL=https://app.productfetcher.online`

### Stripe Dashboard
- [ ] Create products/prices: Starter, Pro, Team
- [ ] Webhook endpoint: `https://api.productfetcher.online/webhooks/stripe`
- [ ] Events: `checkout.session.completed`, `customer.subscription.deleted`

### Chrome Extension (separate from VPS)
- [ ] Build: `pnpm --filter @fetcher/extension build`
- [ ] Publish to Chrome Web Store OR distribute `apps/extension/dist` as ZIP
- [ ] Set default `cloudApiUrl` in extension options to `https://api.productfetcher.online`

## 🔲 Optional / post-launch (Master doc phases not fully built)

| Feature | Status |
|---------|--------|
| GraphQL API | Not built — REST `/v1` only |
| Webhook system (outbound) | Not built |
| JS/Python SDK packages | Not built |
| Sandbox API subdomain | Not built |
| Meilisearch global search | Not built |
| Recharts analytics dashboard | UI shell only |
| Cloud export downloads (signed URLs) | UI placeholder |
| Team invites UI | Placeholder |
| OAuth (Google/GitHub login) | Not built |
| Sentry / uptime monitoring | Config docs only |
| E2E Playwright / k6 load tests | Not built |
| Full connector publish via upload token | Token API exists; extension uses local backend push |
| Trend intelligence (live Google Trends) | Basic snapshot scoring only |
| Legal review of ToS/AUP | Draft pages exist — needs lawyer |

## Git push commands

```bash
cd /path/to/Fetcher.io
git init
git add .
git commit -m "Production-ready: cloud API, Next.js web, extension, deploy infra"
git branch -M main
git remote add origin https://github.com/YOUR_ORG/fetcherio.git
git push -u origin main
```

## VPS first deploy (after git push)

```bash
ssh deploy@YOUR_VPS_IP
git clone https://github.com/YOUR_ORG/fetcherio.git /var/www/fetcherio
cd /var/www/fetcherio
cp apps/api/.env.example apps/api/.env   # edit secrets
cp apps/web/.env.example apps/web/.env.local
pnpm install --frozen-lockfile
pnpm --filter @fetcher/shared build
pnpm --filter @fetcher/api build
pnpm --filter @fetcher/web build
pm2 start ecosystem.config.cjs
pm2 save
sudo certbot --nginx -d productfetcher.online -d www.productfetcher.online -d app.productfetcher.online -d api.productfetcher.online -d admin.productfetcher.online -d docs.productfetcher.online
```

Then trigger **Deploy to VPS** workflow for future updates.
