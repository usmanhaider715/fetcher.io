import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Chrome, Shield, Sparkles, Upload } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Product Intelligence for E-commerce',
  description:
    'Scrape products locally in your browser, enrich with AI, and publish to Shopify, WooCommerce, and more.',
  openGraph: {
    title: 'Fetcher.io — Product Intelligence Platform',
    description: 'Local-first scraping with cloud auth, billing, and publishing.',
    type: 'website',
  },
};

const features = [
  {
    icon: Chrome,
    title: 'Browser-native scraping',
    body: 'Heavy extraction runs in your Chrome extension — not on our servers. Lower cost, lower legal exposure.',
  },
  {
    icon: Sparkles,
    title: 'AI product intelligence',
    body: 'SEO titles, descriptions, keywords, and listing reviews proxied through our API with usage metering.',
  },
  {
    icon: Upload,
    title: 'One-click publishing',
    body: 'Push finished products to Shopify, WooCommerce, and more with scoped upload tokens.',
  },
  {
    icon: Shield,
    title: 'Ethical by default',
    body: 'robots.txt respected, rate limits enforced, no captcha bypass — with clear warnings when you override.',
  },
];

export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Fetcher.io',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Chrome',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: metadata.description,
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className="mb-4 inline-block rounded-full border border-violet-500/40 px-3 py-1 text-xs text-violet-300">
          Local-first · Chrome MV3 · Hostinger-ready
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
          Turn any storefront into structured product data — in your browser
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          Fetcher.io scrapes, organizes, and exports e-commerce products locally. Cloud services handle auth,
          billing, AI enrichment, and store publishing — never bulk scraping on our VPS.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 font-semibold text-white no-underline hover:bg-violet-500"
          >
            Start free trial <ArrowRight size={18} />
          </Link>
          <Link
            href="/docs/getting-started"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 font-semibold text-white no-underline hover:bg-white/5"
          >
            Install extension
          </Link>
        </div>
      </section>

      <section className="border-y border-white/10 bg-card py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-white/10 p-6">
              <f.icon className="mb-4 text-accent" size={28} />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold">Built for operators, agencies, and product hunters</h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted">
          Whether you migrate catalogs, research suppliers, or publish dropshipping winners — Fetcher.io keeps
          payloads on your machine and uses the cloud only for account services.
        </p>
        <Link href="/pricing" className="mt-8 inline-block font-semibold text-accent no-underline">
          Compare plans →
        </Link>
      </section>
    </div>
  );
}
