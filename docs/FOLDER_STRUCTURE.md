# Folder Structure

## Root

```
Fetcher.io/
├── apps/                    # Application packages
├── packages/                # Shared libraries
├── docs/                    # Documentation
├── package.json             # Root workspace config
├── pnpm-workspace.yaml      # pnpm monorepo definition
├── tsconfig.base.json       # Shared TypeScript config
├── eslint.config.js         # ESLint flat config
├── .prettierrc              # Prettier formatting rules
└── README.md
```

## `packages/shared`

Shared code consumed by extension and (future) backend.

```
packages/shared/
├── src/
│   ├── types/
│   │   ├── index.ts         # Product, Session, Settings, Message types
│   │   └── adapter.ts       # IAdapter interface for platform scrapers
│   ├── constants/
│   │   └── index.ts         # App constants, defaults, platform patterns
│   ├── utils/
│   │   └── index.ts         # URL, platform detection, JSON-LD helpers
│   └── index.ts             # Public API barrel export
├── package.json
└── tsconfig.json
```

**Why it exists:** Single source of truth for types and utilities. Prevents duplication between extension and backend.

## `apps/extension`

Chrome Extension (Manifest V3) built with Vite + React.

```
apps/extension/
├── public/icons/            # Extension icons (16/32/48/128)
├── scripts/
│   └── generate-icons.mjs   # Icon generation script
├── src/
│   ├── popup/               # Extension popup UI
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── options/             # Full settings page
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── sidepanel/           # Side panel for advanced controls
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── background/          # Service worker
│   │   └── index.ts         # Session manager, messaging hub
│   ├── content/             # Content scripts (injected into pages)
│   │   ├── index.ts         # Message router
│   │   ├── dom-inspector.ts # Product detection, lazy images
│   │   └── selector-recorder.ts # Interactive selector recording
│   ├── adapters/            # Platform adapters (Phase 3)
│   │   └── index.ts
│   ├── components/
│   │   ├── ui/              # shadcn-style primitives
│   │   ├── dashboard/       # Stats, controls, logs
│   │   ├── app-providers.tsx
│   │   └── theme-provider.tsx
│   ├── stores/
│   │   └── dashboard-store.ts  # Zustand state
│   ├── lib/
│   │   ├── messaging.ts     # chrome.runtime messaging helpers
│   │   └── utils.ts         # UI utilities
│   └── styles/
│       └── globals.css      # Tailwind + glassmorphism theme
├── manifest.config.ts       # MV3 manifest (via @crxjs/vite-plugin)
├── vite.config.ts
├── tailwind.config.js
├── package.json
└── tsconfig.json
```

### Module Purposes

| Module | Responsibility |
|--------|---------------|
| `popup/` | Quick dashboard: stats, start/pause/stop, logs |
| `options/` | Persistent settings with React Hook Form + Zod |
| `sidepanel/` | Mode selection, selector recorder, extended controls |
| `background/` | Session lifecycle, storage, platform detection |
| `content/` | DOM access, product counting, selector recording |
| `components/ui/` | Reusable UI primitives (Button, Card, Badge, etc.) |
| `stores/` | Client-side state via Zustand |
| `lib/messaging.ts` | Typed message passing between extension contexts |

## Build Output

```
apps/extension/dist/         # Load this folder in Chrome as unpacked extension
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm dev:extension` | Start Vite dev server with HMR |
| `pnpm build` | Production build (shared + extension) |
| `pnpm typecheck` | TypeScript validation |
| `pnpm lint` | ESLint across all packages |
