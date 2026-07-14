import Link from 'next/link';

const sections = [
  { slug: 'getting-started', title: 'Getting started' },
  { slug: 'extension-install', title: 'Install the extension' },
  { slug: 'scraping-modes', title: 'Scraping modes' },
  { slug: 'api-reference', title: 'API reference' },
  { slug: 'connectors', title: 'Store connectors' },
];

const content: Record<string, string> = {
  'getting-started': `1. Install the Chrome extension from the build in apps/extension/dist
2. Start the local backend: pnpm dev:backend (port 3847)
3. Register at app.productfetcher.online and link your license key in extension options
4. Open a product page and launch the side panel`,
  'extension-install': `Build: pnpm --filter @fetcher/extension build
Load unpacked: chrome://extensions → Developer mode → Load unpacked → select apps/extension/dist`,
  'scraping-modes': `Single product, collection (pagination), entire website (sitemap/BFS), CSV import, and manual URL list. All modes respect robots.txt by default.`,
  'api-reference': `Base URL: https://api.productfetcher.online/v1
Auth: Bearer access token or API key (prefix fk_)
OpenAPI spec: GET /v1/openapi.json`,
  connectors: `Publishing flow: extension validates license → API returns scoped upload token → extension uploads directly to store → reports outcome to API for history.`,
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
