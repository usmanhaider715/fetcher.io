# Fetcher.io Roadmap

This roadmap is aligned with **Roadmap V2** (build forward from the current MVP) and the **Master Build Command** (long-term SaaS vision on Hostinger VPS).

## Current baseline (do not rebuild)

- Chrome MV3 extension + Express/Prisma/SQLite local backend
- Amazon adapter: pagination, filters, full image galleries
- Session folders: `scrape_<timestamp>/`
- Exports: TXT, JSON, CSV, Excel, ZIP
- Shopify, WooCommerce, eBay, Etsy, AliExpress (basic)

## Phase 1 — Stabilize the Core ✅

- Content script invalidation banner + auto-inject recovery
- Checkpoint persistence for true Resume Session
- Crash-safe atomic `details.json` / `details.txt` writes
- Structured logging (adapter, product URL, timing)
- Interrupted session detection on extension reload

**Exit criteria:** Kill browser mid-scrape → reopen → Resume → complete session without duplicates or corrupt files.

## Phase 2 — Finish half-built features ✅

- CSV import (URL list → scrape queue)
- Selected URLs mode (shared queue with CSV)
- Category persistence across all entry points

## Phase 3 — Throughput ✅

- Decouple metadata save from image downloads
- Parallel image + product page fetching (bounded concurrency)
- Live "images pending" indicator

## Phase 4 — True site crawl ✅

- Sitemap-first discovery
- BFS fallback for stores without sitemaps
- robots.txt respect + crawl-delay

## Phase 5 — Adapter expansion ✅

BigCommerce → Magento → Temu → Alibaba (feature-flagged)

## Phase 6 — Anti-bot maturity ✅

Adaptive backoff, block detection (no CAPTCHA circumvention)

## Phase 7+ — Optional cloud layer (scaffold) ✅

Auth + license validation stubs — **local-first remains default**

## Phase 9 — Production readiness (in progress)

- [x] Options UI: duplicate detection, AI, connectors, async images
- [x] Connectors panel + bulk session push API
- [x] AI enrichment wired into product save flow
- [x] All platform adapters (PrestaShop, OpenCart, CJ, Spocket, Walmart)
- [x] User/License models + local auth (register/login)
- [ ] Stripe billing
- [ ] Full Next.js marketing site
- [ ] Extension integration tests

## What NOT to do

- Do not replace SQLite local storage with Mongo/Postgres for scraping data
- Do not add CAPTCHA-solving or anti-bot circumvention
- Do not build billing before core reliability is proven
