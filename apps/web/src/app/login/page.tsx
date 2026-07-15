'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { api, setAccessToken } from '@/lib/api';
import { BrandLogo } from '@/components/layout/brand-logo';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(email, password);
      setAccessToken(res.accessToken);
      const dest = next.startsWith('/') ? next : '/dashboard';
      router.push(dest);
      // Content script on this page auto-links the extension within ~2s
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
        <h1 className="text-center text-2xl font-bold">Welcome back</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          No account? <Link href="/register" className="font-semibold no-underline">Register</Link>
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {error && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="input-premium"
          />
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            <Sparkles className="h-4 w-4" />
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="no-underline">Forgot password?</Link>
        </p>
      </div>
    </div>
  );
}
