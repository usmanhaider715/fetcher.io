'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getAccessToken } from '@/lib/api';

export default function ApiKeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<Array<{ _id: string; name: string; prefix: string; scopes: string[] }>>([]);
  const [created, setCreated] = useState<string | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!getAccessToken()) {
      router.push('/login');
      return;
    }
    api.apiKeys().then((r) => setKeys(r.keys)).catch(() => router.push('/login'));
  }, [router]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    const res = await api.createApiKey(name || 'Default key', ['read']);
    setCreated(res.key);
    setKeys((k) => [{ _id: res.apiKey.id, name: name || 'Default key', prefix: res.apiKey.prefix, scopes: ['read'] }, ...k]);
    setName('');
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">API keys</h1>
      <p className="mt-2 text-muted">Scoped keys for programmatic access. Store secrets securely — shown once on creation.</p>
      {created && (
        <div className="mt-4 rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-sm">
          <p className="font-semibold text-green-300">Key created — copy now:</p>
          <code className="mt-2 block break-all">{created}</code>
        </div>
      )}
      <form onSubmit={createKey} className="mt-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name"
          className="flex-1 rounded-lg border border-white/20 bg-card px-4 py-2"
        />
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 font-semibold">
          Generate
        </button>
      </form>
      <ul className="mt-8 space-y-2">
        {keys.map((k) => (
          <li key={k._id} className="rounded-lg border border-white/10 px-4 py-3 text-sm">
            {k.name} — <span className="text-muted">{k.prefix}…</span> ({k.scopes.join(', ')})
          </li>
        ))}
      </ul>
    </div>
  );
}
