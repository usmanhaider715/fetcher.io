# Changelog

## 2026-07-14 — Master Build: Production & deploy-ready (Phases 0–12)

### Phase 0 — Infra
- `docker-compose.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`
- `ecosystem.config.cjs` (PM2: API cluster, worker, web, admin)
- `infra/nginx/fetcherio.conf`, `infra/vps/setup.sh`, `infra/vps/backup.sh`
- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- `docs/DEPLOYMENT.md`, root `.env.example`

### Phase 1–3 — Cloud API + Next.js
- **`apps/api`**: MongoDB auth (register/login/refresh/logout), email verify, password reset, device management, JWT + RBAC, Redis rate limits
- **`apps/web`**: Next.js 15 App Router — marketing (landing, pricing, blog, legal), docs, support, auth pages, full dashboard shell (projects, history, billing, API keys, connectors, team, settings), admin panel route
- Host-based middleware for `app.`, `admin.`, `docs.` subdomains

### Phase 5–7 — AI, billing, connectors
- AI proxy with quota metering (`/v1/ai/generate`)
- Stripe checkout, portal, webhooks (`/webhooks/stripe`)
- Connector upload tokens (`/v1/connectors/upload-token`) — hybrid publish flow
- BullMQ worker stub for failed publish retries
- OpenAPI spec at `/v1/openapi.json`

### Phase 8–10 — Trends, admin
- Trend tracking + transparent opportunity scores (`/v1/trends`)
- Admin user lookup, plan override, audit log (`/admin`)

### Phase 12 — Hardening
- API unit tests (crypto, plans), CI pipeline, health check fixes
- Extension `cloud-api.ts` for license/AI/upload-token via cloud API
- Extension options: Cloud API URL, license key, access token fields
- Monorepo scripts: `dev:api`, `dev:web`, `start:api`, `start:web`
- **Deploy workflow is manual-only** (`workflow_dispatch`) — nothing auto-deploys to VPS
- `README.md`, `docs/PRE_DEPLOY_CHECKLIST.md`, git-ready `.gitignore`
- Web: `/verify-email`, `/reset-password` pages
- Fixed `applyPlanLimits` → correct MongoDB org field mapping

---

### Added
- **Connectors panel** in side panel — push session products to Shopify/WooCommerce
- **Bulk push API** — `POST /connectors/shopify/push-session`, `/woocommerce/push-session`
- **Options UI** — duplicate detection toggles, AI settings, connector credentials, async images
- **AI enrichment on save** — auto-runs when `aiEnrichmentEnabled` + OpenAI key set
- **Local auth** — User/License models, real register/login, license key validation
- **5 new adapters** — PrestaShop, OpenCart, CJ Dropshipping, Spocket, Walmart

---

## 2026-07-14 — Phase 8+ scaffold & reliability fixes

### Fixed
- **Pause/resume** now halts orchestrators (not just UI status)
- **Session-scoped export** — exports current session only; ZIP uses session folder
- **Duplicate detection** — image URL matching + fuzzy title similarity (85% threshold)
- **Selector recorder Save** — persists to chrome.storage + backend `/selectors`

### Added
- Custom selectors applied via `SelectorEngine` in `BaseAdapter`
- AI enrichment endpoint (`POST /enrichment/product`)
- Store connectors: `POST /connectors/shopify/push`, `/woocommerce/push`
- Marketing site scaffold at `apps/web`
- Backend session sync on pause/stop

---

## 2026-07-14 — Roadmap V2 Phases 2–8

### Phase 2 — URL import & categories
- CSV import panel with URL parsing (`url-import-panel.tsx`, `parse-csv.ts`)
- Selected URLs mode wired through `url-queue-orchestrator.ts`
- Category/subcategory selection passed into scrape payload

### Phase 3 — Throughput
- Parallel product enrichment via `product-pool.ts` (configurable concurrency)
- Async image download queue on backend (`image-queue.service.ts`)
- **Images Pending** stat in dashboard

### Phase 4 — Site crawl
- Sitemap-first discovery + BFS fallback (`site-crawler.ts`)
- robots.txt parsing and crawl-delay (`robots.ts`)
- Entire Website mode tries crawl before pagination fallback

### Phase 5 — Adapters
- BigCommerce, Magento, Temu, Alibaba adapters
- Feature flags via `ADAPTER_FLAGS` in shared constants

### Phase 6 — Rate limiting
- Per-domain adaptive backoff (`rate-limiter.ts`)
- 429/403 detection with exponential delay

### Phase 7–8 — Cloud scaffold (local-first)
- Auth routes stub: `/auth/register`, `/auth/login`, `/auth/license/validate`
- Extension validates license on startup (fail-open for local mode)

---

## 2026-07-14 — Roadmap V2 Phase 1: Core stabilization

### Added
- `docs/ROADMAP.md` aligned with Master Build Command + Roadmap V2
- `ScrapeCheckpoint` persistence for resume-after-crash
- Content script invalidation banner ("extension updated — refresh page")
- `GET_RESUMABLE_SESSION` message for interrupted sessions
- Real **Resume Session** flow via checkpoint (skips already-saved product URLs)
- Structured logging metadata (adapter, productUrl, durationMs, image count)
- Atomic file writes for `details.txt` / `details.json` (temp + rename)
- Backend folder cleanup on failed product save (no half-written product folders)

### Changed
- Stop now marks session as `interrupted` (checkpoint preserved for resume)
- Extension reload auto-marks `running` sessions as `interrupted`
- New Session clears checkpoint data

### Fixed
- Resume continues from last page + skips processed URLs instead of restarting from page 1
