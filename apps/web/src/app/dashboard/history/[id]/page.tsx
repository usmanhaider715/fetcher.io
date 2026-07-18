'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Trash2 } from 'lucide-react';
import { api, getAccessToken, restoreSession } from '@/lib/api';

type JobDetail = Awaited<ReturnType<typeof api.job>>;

function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function HistoryDetailPage() {
  const params = useParams();
  const id = typeof params['id'] === 'string' ? params['id'] : Array.isArray(params['id']) ? params['id'][0] : '';
  const router = useRouter();
  const [data, setData] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      await restoreSession();
      if (!getAccessToken()) {
        router.push('/login');
        return;
      }
      if (!id) return;
      try {
        setData(await api.job(id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load run');
      }
    }
    void load();
  }, [id, router]);

  const handleExport = async (format: 'json' | 'csv') => {
    if (!id) return;
    setBusy(true);
    try {
      const { blob, filename } = await api.exportJob(id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('Delete this run and all product details?')) return;
    setBusy(true);
    try {
      await api.deleteJob(id);
      router.push('/dashboard/history');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed');
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div>
        <Link href="/dashboard/history" className="inline-flex items-center gap-1 text-sm text-muted-foreground no-underline">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="mt-6 text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground">Loading run…</p>;
  }

  const { job, products, productCount } = data;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/history" className="inline-flex items-center gap-1 text-sm text-muted-foreground no-underline hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> History
          </Link>
          <h1 className="mt-2 text-2xl font-bold">
            {job.subcategoryName ?? job.categoryName ?? 'Scrape run'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {job.websiteUrl ?? '—'} · {new Date(job.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleExport('json')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            <Download className="h-4 w-4" /> JSON
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Status', job.status],
          ['Mode', job.mode],
          ['Platform', job.platform ?? '—'],
          ['Duration', formatDuration(job.durationMs)],
          ['Found', String(job.productsFound ?? 0)],
          ['Saved', String(job.productsSaved)],
          ['Image URLs', String(job.imagesDownloaded ?? 0)],
          ['Errors', String(job.errors ?? 0)],
          ['Category', job.categoryName ?? '—'],
          ['Subcategory', job.subcategoryName ?? '—'],
          ['Sort', job.sortFilter ?? '—'],
          ['Max products', job.maxProducts != null ? String(job.maxProducts) : '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border/50 bg-secondary/20 p-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-medium capitalize">{value}</dd>
          </div>
        ))}
      </dl>

      {job.errorMessages && job.errorMessages.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-sm font-semibold">Errors</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {job.errorMessages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold">Products ({productCount})</h2>
      {products.length === 0 ? (
        <p className="mt-4 text-muted-foreground">No product details stored for this run.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="py-2 pr-3">Title</th>
                <th className="pr-3">Price</th>
                <th className="pr-3">Category</th>
                <th className="pr-3">Images</th>
                <th className="pr-3">URL</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id} className="border-b border-border/30">
                  <td className="max-w-[280px] py-3 pr-3 font-medium">{p.title ?? '—'}</td>
                  <td className="pr-3 whitespace-nowrap">
                    {p.price != null ? `${p.currency ?? ''} ${p.price}`.trim() : '—'}
                  </td>
                  <td className="pr-3">
                    {[p.category, p.subcategory].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="pr-3">{p.imageCount ?? p.imageUrls?.length ?? 0}</td>
                  <td className="pr-3 max-w-[200px] truncate">
                    {p.productUrl ? (
                      <a href={p.productUrl} target="_blank" rel="noreferrer" className="text-primary">
                        Open
                      </a>
                    ) : (
                      '—'
                    )}
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
