'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { api, setAccessToken } from '@/lib/api';
import { BrandLogo } from '@/components/layout/brand-logo';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.register(email, password, name || undefined);
      setAccessToken(res.accessToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <div className="glass-card gradient-border p-8 shadow-premium-lg">
        <div className="mb-6 flex justify-center">
          <BrandLogo />
        </div>
        <h1 className="text-center text-2xl font-bold">Create your account</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Already have an account? <Link href="/login" className="font-semibold no-underline">Log in</Link>
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {error && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className="input-premium"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="input-premium"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 chars)"
            className="input-premium"
          />
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            <Sparkles className="h-4 w-4" />
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          By registering you agree to our{' '}
          <Link href="/legal/terms" className="no-underline">Terms</Link> and{' '}
          <Link href="/legal/aup" className="no-underline">AUP</Link>.
        </p>
      </div>
    </div>
  );
}
