'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { api, getAccessToken, restoreSession } from '@/lib/api';

type JobRow = {
  _id: string;
  mode: string;
  status: string;
  productsFound?: number;
  productsSaved: number;
  imagesDownloaded?: number;
  errors?: number;
  durationMs?: number;
  websiteUrl?: string;
  platform?: string;
  categoryName?: string;
  subcategoryName?: string;
  projectId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

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

  useEffect(() => {
    void load();
  }, [router]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this run and all product details from the dashboard?')) return;
    setDeleting(id);
    try {
      await api.deleteJob(id);
      setJobs((prev) => prev.filter((j) => j._id !== id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Scrape history</h1>
      <p className="mt-2 text-muted-foreground">
        Detailed run logs from the extension. Product images download to your computer — only metadata is stored here.
      </p>
      {jobs.length === 0 ? (
        <p className="mt-8 text-muted-foreground">No runs yet. Start scraping in the extension while signed in.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="py-2 pr-3">Project</th>
                <th className="pr-3">Target</th>
                <th className="pr-3">Platform</th>
                <th className="pr-3">Status</th>
                <th className="pr-3">Found</th>
                <th className="pr-3">Saved</th>
                <th className="pr-3">Images</th>
                <th className="pr-3">Duration</th>
                <th className="pr-3">Date</th>
                <th className="pr-3" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j._id} className="border-b border-border/30 hover:bg-secondary/30">
                  <td className="py-3 pr-3 font-medium">
                    <Link href={`/dashboard/history/${j._id}`} className="text-primary no-underline hover:underline">
                      {j.projectId ? (projects[j.projectId] ?? '—') : '—'}
                    </Link>
                  </td>
                  <td className="pr-3 max-w-[160px] truncate">
                    {j.subcategoryName ?? j.categoryName ?? j.mode}
                  </td>
                  <td className="pr-3 capitalize">{j.platform ?? '—'}</td>
                  <td className="pr-3 capitalize">{j.status}</td>
                  <td className="pr-3">{j.productsFound ?? '—'}</td>
                  <td className="pr-3">{j.productsSaved}</td>
                  <td className="pr-3">{j.imagesDownloaded ?? '—'}</td>
                  <td className="pr-3">{formatDuration(j.durationMs)}</td>
                  <td className="pr-3 whitespace-nowrap text-muted-foreground">
                    {new Date(j.createdAt).toLocaleString()}
                  </td>
                  <td className="pr-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                      disabled={deleting === j._id}
                      onClick={(e) => handleDelete(j._id, e)}
                      title="Delete run"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deleting === j._id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
