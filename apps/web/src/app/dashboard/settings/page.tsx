'use client';

import { api, getAccessToken, setAccessToken } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();

  async function logout() {
    try {
      await api.logout();
    } finally {
      setAccessToken(null);
      router.push('/login');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Settings</h1>
      <section className="mt-8 space-y-4">
        <div className="rounded-xl border border-white/10 p-6">
          <h2 className="font-semibold">Profile</h2>
          <p className="mt-2 text-sm text-muted">Signed in as authenticated user ({getAccessToken() ? 'active session' : 'none'})</p>
        </div>
        <div className="rounded-xl border border-white/10 p-6">
          <h2 className="font-semibold">Theme</h2>
          <p className="mt-2 text-sm text-muted-foreground">Light purple theme is the default across Fetcher.io.</p>
        </div>
        <div className="rounded-xl border border-red-500/30 p-6">
          <h2 className="font-semibold text-red-300">Danger zone</h2>
          <button type="button" onClick={logout} className="mt-4 rounded-lg border border-white/20 px-4 py-2 text-sm">
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
