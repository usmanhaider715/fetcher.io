'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getAccessToken } from '@/lib/api';

export default function BillingPage() {
  const router = useRouter();
  const [usage, setUsage] = useState<{ plan: string; aiCallsUsed: number; aiCallsLimit: number } | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push('/login');
      return;
    }
    api.usage().then(setUsage).catch(() => {});
  }, [router]);

  async function upgrade(plan: string) {
    const res = await api.checkout(plan);
    window.location.href = res.url;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Billing</h1>
      {usage && (
        <div className="mt-6 rounded-xl border border-white/10 p-6">
          <p>
            Plan: <strong className="capitalize">{usage.plan}</strong>
          </p>
          <p className="mt-2 text-sm text-muted">
            AI usage: {usage.aiCallsUsed} / {usage.aiCallsLimit} calls this period
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-accent"
              style={{ width: `${Math.min(100, (usage.aiCallsUsed / usage.aiCallsLimit) * 100)}%` }}
            />
          </div>
        </div>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        {['starter', 'pro', 'team'].map((plan) => (
          <button
            key={plan}
            type="button"
            onClick={() => upgrade(plan)}
            className="rounded-lg bg-accent px-4 py-2 font-semibold capitalize"
          >
            Upgrade to {plan}
          </button>
        ))}
      </div>
    </div>
  );
}
