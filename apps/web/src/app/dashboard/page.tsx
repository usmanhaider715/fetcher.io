'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getAccessToken } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Array<{ _id: string; name: string; description?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!getAccessToken()) {
      router.push('/login');
      return;
    }
    api
      .projects()
      .then((r) => setProjects(r.projects))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await api.createProject(newName.trim());
    setProjects((p) => [res.project as typeof p[0], ...p]);
    setNewName('');
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Projects</h1>
      <p className="mt-2 text-muted">A project is a scraping workspace with its own categories and tags.</p>

      <form onSubmit={createProject} className="mt-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name"
          className="flex-1 rounded-lg border border-white/20 bg-card px-4 py-2"
        />
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 font-semibold">
          Create
        </button>
      </form>

      {projects.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-white/20 p-12 text-center">
          <p className="text-muted">No projects yet. Create one above or scrape from the Chrome extension.</p>
          <Link href="/docs/getting-started" className="mt-4 inline-block text-accent">
            Getting started guide →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <li key={p._id} className="rounded-xl border border-white/10 p-6">
              <h2 className="font-semibold">{p.name}</h2>
              {p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
