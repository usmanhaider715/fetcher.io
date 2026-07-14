# Developer Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- Google Chrome

## Setup

```bash
pnpm install
pnpm db:push        # Initialize SQLite database
pnpm build          # Build all packages
```

## Development

```bash
# Run backend + extension together
pnpm dev

# Or separately
pnpm dev:backend    # http://127.0.0.1:3847
pnpm dev:extension  # Vite HMR on :5173
```

Load extension: `chrome://extensions` → Load unpacked → `apps/extension/dist`

## Adding a New Platform Adapter

1. Create adapter in `apps/extension/src/adapters/`:

```typescript
import { BaseAdapter } from './base.adapter';

export class MyPlatformAdapter extends BaseAdapter {
  readonly platform = 'generic' as const;
  readonly name = 'My Platform';
  readonly domains = ['myplatform.com'];

  detect(document: Document, url: string): boolean {
    return url.includes('myplatform.com');
  }

  findProducts(document: Document): string[] {
    // Return product page URLs
  }
}
```

2. Register in `apps/extension/src/adapters/registry.ts`

3. Add detection patterns to `packages/shared/src/constants/index.ts`

## Selector Engine

Located in `packages/selectors`. Supports CSS, XPath, attribute, regex, and text selectors with fallback chains.

```typescript
import { selectorEngine } from '@fetcher/selectors';

const title = selectorEngine.query(document, {
  type: 'css',
  value: 'h1.product-title',
  fallbacks: [{ type: 'css', value: 'h1' }],
});
```

## Product Detection Pipeline

Located in `packages/parsers`. Priority order:
1. Schema.org JSON-LD
2. OpenGraph
3. Meta tags
4. DOM (via adapters)

## Database

Prisma + SQLite. Schema at `apps/backend/prisma/schema.prisma`.

```bash
pnpm db:studio     # Open Prisma Studio
pnpm db:push       # Push schema changes
```

## Testing

```bash
pnpm test          # Run all package tests
pnpm typecheck     # TypeScript validation
pnpm lint          # ESLint
```

## Project Conventions

- Strict TypeScript everywhere
- ESM modules (`"type": "module"`)
- Shared types in `@fetcher/shared`
- Backend services follow single-responsibility
- Adapters implement `IAdapter` interface
