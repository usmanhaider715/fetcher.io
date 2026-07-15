import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban } from 'lucide-react';
import { sendMessage } from '@/lib/messaging';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface CloudProject {
  _id: string;
  name: string;
  description?: string;
}

interface ProjectSelectorProps {
  value: string | null;
  onChange: (projectId: string | null) => void;
}

async function fetchProjects(): Promise<CloudProject[]> {
  const res = await sendMessage<undefined, { projects: CloudProject[] }>({ type: 'GET_PROJECTS' });
  return res.projects ?? [];
}

export function ProjectSelector({ value, onChange }: ProjectSelectorProps) {
  const { data: projects = [], isLoading, refetch } = useQuery({
    queryKey: ['cloud-projects'],
    queryFn: fetchProjects,
    retry: false,
  });

  useEffect(() => {
    const first = projects[0];
    if (first && !value) {
      onChange(first._id);
    }
  }, [projects, value, onChange]);

  return (
    <Card className="gradient-border">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FolderKanban className="h-4 w-4" />
          Save run to project
        </CardTitle>
        <CardDescription className="text-xs">
          Run summary syncs to your dashboard. Scrape files stay local until you download.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading projects…</p>
        ) : projects.length === 0 ? (
          <button
            type="button"
            className="text-xs font-medium text-primary"
            onClick={() => refetch()}
          >
            Create default project →
          </button>
        ) : (
          <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className="input-premium h-9 w-full text-xs"
          >
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </CardContent>
    </Card>
  );
}
