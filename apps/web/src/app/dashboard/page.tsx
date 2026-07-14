'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FolderPlus, Package, Plus } from 'lucide-react';
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

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="mt-2 text-muted-foreground">
          A project is a scraping workspace with its own categories and tags.
        </p>
      </div>

      <form onSubmit={createProject} className="glass-card gradient-border mb-8 flex gap-3 p-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name"
          className="input-premium flex-1"
        />
        <button type="submit" className="btn-primary shrink-0 px-5 py-2 text-sm">
          <Plus className="h-4 w-4" />
          Create
        </button>
      </form>

      {projects.length === 0 ? (
        <div className="glass-card gradient-border flex flex-col items-center p-16 text-center">
          <div className="icon-3d mb-4 h-16 w-16">
            <FolderPlus className="h-8 w-8" />
          </div>
          <p className="text-lg font-semibold">No projects yet</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create one above or scrape from the Chrome extension.
          </p>
          <Link href="/docs/getting-started" className="btn-secondary mt-6 text-sm">
            Getting started guide →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <li
              key={p._id}
              className="glass-card gradient-border group p-6 transition-transform hover:scale-[1.01] hover:shadow-premium-lg"
            >
              <div className="flex items-start gap-4">
                <div className="icon-3d h-12 w-12 shrink-0">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground group-hover:text-primary">{p.name}</h2>
                  {p.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
