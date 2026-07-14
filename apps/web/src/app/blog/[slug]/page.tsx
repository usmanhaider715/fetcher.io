import { notFound } from 'next/navigation';
import Link from 'next/link';

const posts: Record<string, { title: string; date: string; body: string }> = {
  'local-first-scraping': {
    title: 'Why local-first scraping wins',
    date: '2026-07-01',
    body: `Fetcher.io runs extraction in your Chrome extension while you browse. The cloud API handles auth, billing, AI proxy, and publishing orchestration — never bulk page fetching.

This architecture keeps VPS costs predictable, reduces legal exposure for the platform operator, and gives users full control over where product images and JSON land on disk.`,
  },
  'shopify-adapter-deep-dive': {
    title: 'Shopify adapter deep dive',
    date: '2026-06-15',
    body: `Our Shopify adapter combines platform-specific DOM fingerprints with Schema.org JSON-LD extraction. When a recorded selector breaks, we fall back to structured data and flag the adapter for review instead of failing silently.

Pagination, collection pages, and infinite scroll are handled through the scrape orchestrator with configurable rate limits per domain.`,
  },
};

export function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = posts[slug];
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/blog" className="text-sm text-muted">
        ← Blog
      </Link>
      <h1 className="mt-4 text-4xl font-bold">{post.title}</h1>
      <p className="mt-2 text-muted">{post.date}</p>
      <div className="prose prose-invert mt-8 whitespace-pre-wrap text-zinc-300">{post.body}</div>
    </article>
  );
}
