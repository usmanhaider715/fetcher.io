# Architecture

## Overview

Fetcher.io uses a monorepo architecture with a Chrome Extension frontend and a local Node.js backend.

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
├─────────────┬──────────────┬──────────────┬─────────────────┤
│   Popup     │  Side Panel  │   Options    │  Content Script │
│  (React)    │   (React)    │   (React)    │  (DOM/Selectors)│
└──────┬──────┴──────┬───────┴──────┬───────┴────────┬────────┘
       │             │              │                │
       └─────────────┴──────────────┴────────────────┘
                              │
                    Background Service Worker
                    (Session, Messaging, Storage)
                              │
                              ▼
                    ┌─────────────────┐
                    │  Local Backend  │  (Phase 2)
                    │  Express + API  │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │ SQLite + Prisma │
                    └─────────────────┘
```

## Module Responsibilities

### `packages/shared`
Cross-cutting types, constants, and utilities used by both extension and backend.

### `apps/extension`
- **popup/** - Quick-access dashboard
- **sidepanel/** - Advanced scraping controls
- **options/** - User settings
- **background/** - Service worker orchestration
- **content/** - Page-level DOM interaction
- **adapters/** - Platform-specific scrapers (Phase 3)
- **components/** - Shared UI components (shadcn/ui style)

## Communication Flow

1. UI components send messages via `chrome.runtime.sendMessage`
2. Background service worker handles session state
3. Content scripts receive scrape commands and report progress
4. Backend receives product JSON for file/image operations (Phase 2)

## Design Principles

- **SOLID**: Single-responsibility modules, adapter interface for extensibility
- **Modular adapters**: Each e-commerce platform gets its own adapter
- **Type safety**: Strict TypeScript across all packages
- **Local-first**: All data stored locally, no cloud dependency
