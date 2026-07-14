'use client';

import { useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/utils';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Request failed');
      setSent(true);
    } catch {
      setError('Could not send reset email. Check the address and try again.');
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold">Reset password</h1>
      {sent ? (
        <p className="mt-4 text-muted">If that email exists, we sent a reset link. Check your inbox.</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {error && <p className="text-sm text-red-300">{error}</p>}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-white/20 bg-card px-4 py-3"
          />
          <button type="submit" className="w-full rounded-lg bg-accent py-3 font-semibold">
            Send reset link
          </button>
        </form>
      )}
      <p className="mt-4 text-sm">
        <Link href="/login">Back to login</Link>
      </p>
    </div>
  );
}
