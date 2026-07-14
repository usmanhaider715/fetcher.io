import Link from 'next/link';

const posts = [
  {
    slug: 'local-first-scraping',
    title: 'Why local-first scraping wins for e-commerce teams',
    date: '2026-07-01',
    excerpt: 'Heavy extraction belongs in the browser — not on a shared VPS.',
  },
  {
    slug: 'shopify-adapter-deep-dive',
    title: 'How the Shopify adapter detects products without brittle selectors',
    date: '2026-06-15',
    excerpt: 'DOM fingerprints, JSON-LD fallbacks, and selector healing explained.',
  },
];

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold">Blog</h1>
      <ul className="mt-12 space-y-8">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`} className="text-2xl font-semibold no-underline hover:text-accent">
              {p.title}
            </Link>
            <p className="mt-1 text-sm text-muted">{p.date}</p>
            <p className="mt-2 text-muted">{p.excerpt}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
