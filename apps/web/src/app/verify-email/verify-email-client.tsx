'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/utils';

export function VerifyEmailClient({ token }: { token: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  useEffect(() => {
    if (!token) return;
    setStatus('loading');
    fetch(`${API_URL}/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => setStatus(res.ok ? 'ok' : 'error'))
      .catch(() => setStatus('error'));
  }, [token]);

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-3xl font-bold">Verify email</h1>
        <p className="mt-4 text-muted">Missing verification token. Check your email link.</p>
        <Link href="/login" className="mt-6 inline-block">Log in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold">Verify email</h1>
      {status === 'loading' && <p className="mt-4 text-muted">Verifying…</p>}
      {status === 'ok' && <p className="mt-4 text-green-400">Email verified. You can log in now.</p>}
      {status === 'error' && <p className="mt-4 text-red-300">Verification failed. Link may be expired.</p>}
      <p className="mt-6"><Link href="/login">Log in</Link></p>
    </div>
  );
}
