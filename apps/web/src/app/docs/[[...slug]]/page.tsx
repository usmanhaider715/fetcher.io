import Link from 'next/link';

const sections = [
  { slug: 'getting-started', title: 'Getting started' },
  { slug: 'extension-install', title: 'Install the extension' },
  { slug: 'chrome-web-store', title: 'Chrome Web Store' },
  { slug: 'scraping-modes', title: 'Scraping modes' },
  { slug: 'api-reference', title: 'API reference' },
  { slug: 'connectors', title: 'Store connectors' },
];

const content: Record<string, string> = {
  'getting-started': `1. Register at app.productfetcher.online (any plan — payment skipped in dev)
2. Install the Chrome extension (Web Store or unpacked dist)
3. Open Dashboard → Extension and click "Link extension now"
4. Start local backend: pnpm dev:backend (port 3847) for product storage & store push
5. Open a product or collection page → extension popup → Start`,
  'extension-install': `Development build:
  pnpm --filter @fetcher/extension build

Load unpacked:
  chrome://extensions → Developer mode → Load unpacked → apps/extension/dist

After install, sign in on the web app and link from /dashboard/extension.`,
  'chrome-web-store': `Professional Chrome Web Store publish checklist:

1. Google Developer account ($5 one-time) — chrome.google.com/webstore/devconsole
2. Build production zip:
   pnpm --filter @fetcher/extension build
   cd apps/extension/dist && zip -r ../fetcher-io-extension.zip .
3. Required assets:
   - 128×128 icon, 440×280 small promo, 1280×800 screenshots (popup + side panel)
   - Privacy policy URL (host at productfetcher.online/privacy)
   - Single purpose: e-commerce product data extraction for merchant workflows
4. Manifest permissions justification:
   - tabs/activeTab: read current product page
   - storage: save session & settings
   - downloads: export CSV/images
   - host_permissions <all_urls>: scrape arbitrary storefronts user visits
5. Set NEXT_PUBLIC_EXTENSION_ID in web .env to the published extension ID
6. Submit for review (typically 1–3 business days)

Update flow: bump version in manifest.config.ts → rebuild zip → upload new package in dev console.`,
  'scraping-modes': `Single product, collection (pagination), entire website (sitemap/BFS), CSV import, and manual URL list. Requires signed-in Fetcher.io account. All modes respect robots.txt by default.`,
  'api-reference': `Base URL: https://api.productfetcher.online/v1
Auth: Bearer access token (web login) or API key (prefix fk_) from Dashboard → API Keys
OpenAPI spec: GET /v1/openapi.json`,
  connectors: `How store connectors work:

1. Configure in extension Settings → Connectors:
   - Shopify: store URL + Admin API access token
   - WooCommerce: store URL + consumer key/secret (REST API)

2. Scrape products — they save to the local backend (SQLite on your machine).

3. In the side panel → Downloads → Store Connectors, click "Push to Shopify" or "Push to Woo".

4. The local backend reads saved products and calls the store REST API directly from your computer. Credentials never leave your machine except to your store.

5. Cloud role (optional): signed-in users can request scoped upload tokens from api.productfetcher.online for audited publish history. Plan limits apply (see Billing).

Free plan: connectors disabled. Starter+: 1+ connector slots per plan.`,
};

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = slug?.[0] ?? 'getting-started';
  const body = content[page] ?? content['getting-started'];

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-12">
      <aside className="w-48 shrink-0">
        <p className="mb-4 text-xs font-semibold uppercase text-muted">Docs</p>
        <nav className="space-y-2 text-sm">
          {sections.map((s) => (
            <Link
              key={s.slug}
              href={`/docs/${s.slug}`}
              className={`block no-underline ${page === s.slug ? 'text-accent' : 'text-muted hover:text-white'}`}
            >
              {s.title}
            </Link>
          ))}
        </nav>
      </aside>
      <article className="flex-1">
        <h1 className="text-3xl font-bold">{sections.find((s) => s.slug === page)?.title ?? 'Docs'}</h1>
        <pre className="mt-8 whitespace-pre-wrap rounded-xl border border-white/10 bg-card p-6 text-sm text-zinc-300">
          {body}
        </pre>
      </article>
    </div>
  );
}
