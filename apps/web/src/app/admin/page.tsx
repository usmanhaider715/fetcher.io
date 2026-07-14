'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/utils';

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [health, setHealth] = useState<unknown>(null);

  useEffect(() => {
    fetch(`${API_URL}/health`).then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const token = sessionStorage.getItem('fetcher_access');
    const res = await fetch(`${API_URL}/admin/users/lookup?email=${encodeURIComponent(email)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    setResult(await res.json());
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-bold">Admin panel</h1>
      <p className="mt-2 text-sm text-muted">Staff-only. Requires admin role on API.</p>

      <section className="mt-8 rounded-xl border border-white/10 p-6">
        <h2 className="font-semibold">System health</h2>
        <pre className="mt-4 overflow-auto text-xs text-muted">{JSON.stringify(health, null, 2)}</pre>
      </section>

      <section className="mt-8 rounded-xl border border-white/10 p-6">
        <h2 className="font-semibold">User lookup</h2>
        <form onSubmit={lookup} className="mt-4 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="flex-1 rounded-lg border border-white/20 bg-card px-4 py-2"
          />
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold">
            Search
          </button>
        </form>
        {result != null && (
          <pre className="mt-4 overflow-auto text-xs text-muted">{JSON.stringify(result, null, 2)}</pre>
        )}
      </section>
    </div>
  );
}
