import type { Metadata } from 'next';
import Link from 'next/link';
import { PLANS } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Fetcher.io plans from Free to Enterprise — seats, AI credits, connectors, and device limits.',
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-bold">Simple, transparent pricing</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Pay for cloud services — auth, AI proxy, connectors, and team features. Local scraping stays free on your machine.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-2xl border p-6 ${plan.highlighted ? 'border-accent bg-accent/5' : 'border-white/10'}`}
          >
            <h2 className="text-xl font-bold">{plan.name}</h2>
            <p className="mt-2 text-3xl font-bold">
              {plan.price}
              {plan.price !== 'Custom' && <span className="text-sm font-normal text-muted">/mo</span>}
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted">
              {plan.features.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
            <Link
              href={plan.id === 'enterprise' ? '/support' : '/register'}
              className="mt-6 block rounded-lg bg-white/10 py-2 text-center font-semibold text-white no-underline hover:bg-white/20"
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-xl border border-white/10 p-8">
        <h3 className="text-lg font-semibold">FAQ</h3>
        <dl className="mt-6 space-y-6">
          <div>
            <dt className="font-medium">Does scraping count against AI credits?</dt>
            <dd className="mt-1 text-sm text-muted">No. Scraping runs locally. AI credits apply only to cloud-proxied generation.</dd>
          </div>
          <div>
            <dt className="font-medium">Can I use Fetcher without a subscription?</dt>
            <dd className="mt-1 text-sm text-muted">Yes. The Free plan includes local scraping and limited cloud features.</dd>
          </div>
          <div>
            <dt className="font-medium">Where is my product data stored?</dt>
            <dd className="mt-1 text-sm text-muted">By default on your computer. Cloud backup is opt-in per project.</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
