import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { PLANS } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Fetcher.io plans from Free to Enterprise — seats, AI credits, connectors, and device limits.',
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
          Simple, <span className="text-gradient">transparent</span> pricing
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Pay for cloud services — auth, AI proxy, connectors, and team features. Local scraping stays free on your machine.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`glass-card gradient-border flex flex-col p-8 transition-transform hover:scale-[1.02] ${
              plan.highlighted ? 'ring-2 ring-primary/30 shadow-glow' : ''
            }`}
          >
            {plan.highlighted && (
              <span className="mb-4 inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                Most popular
              </span>
            )}
            <h2 className="text-xl font-bold">{plan.name}</h2>
            <p className="mt-3 text-4xl font-extrabold tracking-tight">
              {plan.price}
              {plan.price !== 'Custom' && (
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              )}
            </p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-muted-foreground">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={plan.id === 'enterprise' ? '/support' : '/register'}
              className={plan.highlighted ? 'btn-primary mt-8 w-full text-center' : 'btn-secondary mt-8 w-full text-center'}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      <div className="glass-card gradient-border mt-16 p-8 md:p-10">
        <h3 className="text-xl font-bold">FAQ</h3>
        <dl className="mt-8 grid gap-8 md:grid-cols-3">
          <div>
            <dt className="font-semibold text-foreground">Does scraping count against AI credits?</dt>
            <dd className="mt-2 text-sm text-muted-foreground">
              No. Scraping runs locally. AI credits apply only to cloud-proxied generation.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Can I use Fetcher without a subscription?</dt>
            <dd className="mt-2 text-sm text-muted-foreground">
              Yes. The Free plan includes local scraping and limited cloud features.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Where is my product data stored?</dt>
            <dd className="mt-2 text-sm text-muted-foreground">
              By default on your computer. Cloud backup is opt-in per project.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
