'use client';

import { useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/utils';

export function ResetPasswordClient({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      setStatus(res.ok ? 'ok' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-3xl font-bold">Reset password</h1>
        <p className="mt-4 text-muted">Invalid reset link.</p>
        <Link href="/forgot-password">Request a new link</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold">Set new password</h1>
      {status === 'ok' ? (
        <p className="mt-4 text-green-400">Password updated. <Link href="/login">Log in</Link></p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {status === 'error' && <p className="text-sm text-red-300">Reset failed. Try again or request a new link.</p>}
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            className="w-full rounded-lg border border-white/20 bg-card px-4 py-3"
          />
          <button type="submit" className="w-full rounded-lg bg-accent py-3 font-semibold">
            Update password
          </button>
        </form>
      )}
    </div>
  );
}
