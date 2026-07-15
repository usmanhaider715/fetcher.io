import { useQuery } from '@tanstack/react-query';
import { ExternalLink, LogIn, User } from 'lucide-react';
import type { CloudAccount } from '@fetcher/shared';
import { DEFAULT_WEB_APP_URL } from '@fetcher/shared';
import { sendMessage } from '@/lib/messaging';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const CONNECT_URL = `${DEFAULT_WEB_APP_URL}/login?next=/dashboard/extension`;

async function fetchCloudAccount(): Promise<CloudAccount> {
  return sendMessage<undefined, CloudAccount>({ type: 'GET_CLOUD_ACCOUNT' });
}

export function AccountBanner({ compact = false }: { compact?: boolean }) {
  const { data: account } = useQuery({
    queryKey: ['cloud-account'],
    queryFn: fetchCloudAccount,
    refetchInterval: 60000,
  });

  if (!account?.signedIn) {
    return (
      <div className="glass-card space-y-2 p-2.5">
        <p className="text-[10px] text-muted-foreground">
          Sign in to your Fetcher.io account to start scraping.
        </p>
        <Button
          size="sm"
          className="w-full text-xs"
          onClick={() => chrome.tabs.create({ url: CONNECT_URL })}
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign in & link extension
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-card flex items-center gap-2 p-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <User className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold">{account.email}</p>
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="secondary" className="text-[9px]">
            {account.plan ?? 'free'}
          </Badge>
          {!compact && (
            <span className="truncate font-mono text-[9px] text-muted-foreground" title={account.userId}>
              ID: {account.userId?.slice(0, 8)}…
            </span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 shrink-0 p-0"
        title="Open dashboard"
        onClick={() => chrome.tabs.create({ url: DEFAULT_WEB_APP_URL })}
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
