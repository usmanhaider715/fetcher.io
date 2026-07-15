import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  Chrome,
  Download,
  MousePointerClick,
  Shield,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';

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
    icon: Brain,
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

const platforms = [
  'AliExpress', 'Amazon', 'eBay', 'CJ Dropshipping', 'Walmart',
  'Etsy', 'TikTok Shop', 'TEMU', 'DHgate', 'Shopify',
];

const steps = [
  { icon: MousePointerClick, title: 'Choose website', desc: 'Open any supported storefront in Chrome' },
  { icon: Sparkles, title: 'Start scraping', desc: 'Extension extracts products locally' },
  { icon: Wand2, title: 'AI enhancement', desc: 'Enrich titles, SEO, and descriptions' },
  { icon: Download, title: 'Export or publish', desc: 'CSV, JSON, ZIP, or push to your store' },
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

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="animate-fade-up">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Local-first · Chrome MV3 · Cloud-ready
            </p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Turn any storefront into{' '}
              <span className="text-gradient">structured product data</span>
              {' '}— in your browser
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Fetcher.io scrapes, organizes, and exports e-commerce products locally. Cloud services handle auth,
              billing, AI enrichment, and store publishing — never bulk scraping on our VPS.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/register" className="btn-primary">
                Start free trial <ArrowRight size={18} />
              </Link>
              <Link href="/docs/getting-started" className="btn-secondary">
                <Chrome size={18} />
                Install extension
              </Link>
            </div>
          </div>
          <div className="relative animate-fade-up lg:pl-4" style={{ animationDelay: '0.15s' }}>
            <div className="gradient-border overflow-hidden rounded-3xl bg-white/80 shadow-premium-lg">
              <Image
                src="/images/dashboard-mockup.png"
                alt="Fetcher.io dashboard — projects, stats, and product discovery score"
                width={900}
                height={560}
                className="w-full object-contain"
                priority
              />
            </div>
            <div className="absolute -bottom-4 -left-4 h-24 w-24 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-300/20 blur-2xl" />
            <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-border/50 bg-white/40 py-20 backdrop-blur-sm">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="glass-card gradient-border p-6 transition-transform hover:scale-[1.02]">
              <div className="icon-3d mb-4 h-12 w-12">
                <f.icon size={24} />
              </div>
              <h3 className="font-bold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Platforms */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Works on 50+ platforms</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            From AliExpress to Shopify — scrape product data from the stores you already use.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {platforms.map((p) => (
            <span
              key={p}
              className="rounded-xl border border-border/60 bg-white/70 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm"
            >
              {p}
            </span>
          ))}
          <span className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">
            + 40 more
          </span>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border/50 bg-lavender/50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold">How it works</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div key={step.title} className="glass-card gradient-border p-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-500 text-white shadow-glow">
                  <step.icon size={24} />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Step {i + 1}</p>
                <h3 className="mt-2 font-bold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="glass-card gradient-border mx-auto max-w-3xl p-12">
          <h2 className="text-3xl font-bold">Built for operators, agencies, and product hunters</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Whether you migrate catalogs, research suppliers, or publish dropshipping winners — Fetcher.io keeps
            payloads on your machine and uses the cloud only for account services.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/register" className="btn-primary">
              Get started free
            </Link>
            <Link href="/pricing" className="btn-secondary">
              Compare plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
