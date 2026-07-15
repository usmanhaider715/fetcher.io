import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DashboardStats, ExtensionMessage, LogEntry, CloudAccount } from '@fetcher/shared';
import { AppProviders } from '@/components/app-providers';
import { AccountBanner } from '@/components/dashboard/account-banner';
import { ControlBar } from '@/components/dashboard/control-bar';
import { DashboardStatsGrid } from '@/components/dashboard/stats-grid';
import { LogsPanel } from '@/components/dashboard/logs-panel';
import { BrandHeader } from '@/components/layout/brand-header';
import { PremiumBackground } from '@/components/layout/premium-background';
import { Progress } from '@/components/ui/progress';
import { onMessage, sendMessage } from '@/lib/messaging';
import { useDashboardStore } from '@/stores/dashboard-store';
import '@/styles/globals.css';

async function fetchDashboardStats(): Promise<DashboardStats> {
  return sendMessage<undefined, DashboardStats>({ type: 'GET_DASHBOARD_STATS' });
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'success' {
  if (status === 'running') return 'default';
  if (status === 'error') return 'destructive';
  if (status === 'completed') return 'success';
  return 'secondary';
}

async function fetchCloudAccount(): Promise<CloudAccount> {
  return sendMessage<undefined, CloudAccount>({ type: 'GET_CLOUD_ACCOUNT' });
}

function Dashboard() {
  const queryClient = useQueryClient();
  const { stats, logs, isLoading, setStats, setSessionStatus, addLog, setLogs, setLoading } =
    useDashboardStore();

  const { data: account } = useQuery({
    queryKey: ['cloud-account'],
    queryFn: fetchCloudAccount,
    refetchInterval: 60000,
  });

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (data) setStats(data);
  }, [data, setStats]);

  useEffect(() => {
    const unsubscribe = onMessage((message: ExtensionMessage) => {
      if (message.type === 'DASHBOARD_STATS' && message.payload) {
        setStats(message.payload as DashboardStats);
        queryClient.setQueryData(['dashboard-stats'], message.payload);
      }
      if (message.type === 'SCRAPE_PROGRESS' && message.payload) {
        setStats(message.payload as DashboardStats);
      }
      if (message.type === 'SCRAPE_LOG' && message.payload) {
        addLog(message.payload as LogEntry);
      }
      if (message.type === 'CLOUD_ACCOUNT' && message.payload) {
        queryClient.setQueryData(['cloud-account'], message.payload);
      }
    });
    return unsubscribe;
  }, [setStats, addLog, queryClient]);

  const handleStart = useCallback(async () => {
    setLoading(true);
    try {
      await sendMessage({ type: 'START_SCRAPE', payload: { mode: 'current_product' } });
      setSessionStatus('running');
      await refetch();
    } finally {
      setLoading(false);
    }
  }, [setLoading, setSessionStatus, refetch]);

  const handlePause = useCallback(async () => {
    setLoading(true);
    try {
      await sendMessage({ type: 'PAUSE_SCRAPE' });
      setSessionStatus('paused');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setSessionStatus]);

  const handleResume = useCallback(async () => {
    setLoading(true);
    try {
      await sendMessage({ type: 'RESUME_SCRAPE' });
      setSessionStatus('running');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setSessionStatus]);

  const handleStop = useCallback(async () => {
    setLoading(true);
    try {
      await sendMessage({ type: 'STOP_SCRAPE' });
      setSessionStatus('stopped');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setSessionStatus]);

  const handleNewSession = useCallback(async () => {
    setLoading(true);
    try {
      if (stats.sessionStatus === 'running' || stats.sessionStatus === 'paused') {
        await sendMessage({ type: 'STOP_SCRAPE' });
      }
      await sendMessage({ type: 'NEW_SESSION' });
      setSessionStatus('idle');
      setLogs([]);
      await refetch();
    } finally {
      setLoading(false);
    }
  }, [stats.sessionStatus, setLoading, setSessionStatus, setLogs, refetch]);

  const handleSettings = useCallback(() => {
    chrome.runtime.openOptionsPage();
  }, []);

  const handleOpenSidePanel = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  }, []);

  const progressPercent =
    stats.productsFound > 0
      ? Math.round((stats.productsSaved / stats.productsFound) * 100)
      : stats.sessionStatus === 'running'
        ? 5
        : 0;

  const isActive = stats.sessionStatus === 'running' || stats.sessionStatus === 'paused';

  return (
    <div className="popup-shell premium-bg relative">
      <PremiumBackground />
      <div className="popup-content relative z-10 flex flex-col gap-2.5 p-3">
        <BrandHeader
          status={stats.sessionStatus}
          statusVariant={statusVariant(stats.sessionStatus)}
          minimal
        />

        <AccountBanner compact />

        {isActive && (
          <div className="glass-card space-y-1.5 p-2.5">
            <div className="flex justify-between text-[10px] font-medium">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-primary">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground">
              {stats.productsSaved} / {stats.productsFound} saved
            </p>
          </div>
        )}

        <DashboardStatsGrid {...stats} showHeader={false} popup />

        <ControlBar
          sessionStatus={stats.sessionStatus}
          signedIn={account?.signedIn ?? false}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          onNewSession={handleNewSession}
          onSettings={handleSettings}
          onOpenSidePanel={handleOpenSidePanel}
          isLoading={isLoading || isFetching}
          compact
        />

        <LogsPanel logs={logs} maxHeight="72px" compact />
      </div>
    </div>
  );
}

export function PopupApp() {
  return (
    <AppProviders theme="light">
      <Dashboard />
    </AppProviders>
  );
}
