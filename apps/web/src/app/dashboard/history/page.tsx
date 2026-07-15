'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getAccessToken, restoreSession } from '@/lib/api';

type JobRow = {
  _id: string;
  mode: string;
  status: string;
  productsSaved: number;
  productsFound?: number;
  websiteUrl?: string;
  projectId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      await restoreSession();
      if (!getAccessToken()) {
        router.push('/login');
        return;
      }
      try {
        const [jobsRes, projectsRes] = await Promise.all([api.jobs(), api.projects()]);
        setJobs(jobsRes.jobs as JobRow[]);
        const map: Record<string, string> = {};
        for (const p of projectsRes.projects) {
          map[p._id] = p.name;
        }
        setProjects(map);
      } catch {
        router.push('/login');
      }
    }
    void load();
  }, [router]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Scrape history</h1>
      <p className="mt-2 text-muted-foreground">
        Run summaries from the extension. Product files live on your computer until you download and free them.
      </p>
      {jobs.length === 0 ? (
        <p className="mt-8 text-muted-foreground">No runs yet. Start scraping in the extension while signed in.</p>
      ) : (
        <table className="mt-8 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground">
              <th className="py-2">Project</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Saved</th>
              <th>Site</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j._id} className="border-b border-border/30">
                <td className="py-3 font-medium">
                  {j.projectId ? (projects[j.projectId] ?? '—') : '—'}
                </td>
                <td>{j.mode}</td>
                <td className="capitalize">{j.status}</td>
                <td>{j.productsSaved}</td>
                <td className="max-w-[200px] truncate text-muted-foreground">{j.websiteUrl ?? '—'}</td>
                <td>{new Date(j.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
