'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getAccessToken } from '@/lib/api';

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<
    Array<{ _id: string; mode: string; status: string; productsSaved: number; createdAt: string; websiteUrl?: string }>
  >([]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push('/login');
      return;
    }
    api.jobs().then((r) => setJobs(r.jobs)).catch(() => router.push('/login'));
  }, [router]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Scrape history</h1>
      <p className="mt-2 text-muted">Job metadata only — product payloads stay local unless cloud backup is enabled.</p>
      {jobs.length === 0 ? (
        <p className="mt-8 text-muted">No jobs synced yet. Run a scrape in the extension while logged in.</p>
      ) : (
        <table className="mt-8 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-muted">
              <th className="py-2">Mode</th>
              <th>Status</th>
              <th>Products</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j._id} className="border-b border-white/5">
                <td className="py-3">{j.mode}</td>
                <td>{j.status}</td>
                <td>{j.productsSaved}</td>
                <td>{new Date(j.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
