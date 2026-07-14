import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DashboardStats, ExtensionMessage, LogEntry } from '@fetcher/shared';
import { AppProviders } from '@/components/app-providers';
import { ControlBar } from '@/components/dashboard/control-bar';
import { DashboardStatsGrid } from '@/components/dashboard/stats-grid';
import { LogsPanel } from '@/components/dashboard/logs-panel';
import { BrandHeader } from '@/components/layout/brand-header';
import { PremiumBackground } from '@/components/layout/premium-background';
import { Progress } from '@/components/ui/progress';
import { ProgressRing } from '@/components/ui/progress-ring';
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

function Dashboard() {
  const queryClient = useQueryClient();
  const { stats, logs, isLoading, setStats, setSessionStatus, addLog, setLogs, setLoading } =
    useDashboardStore();

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
    <div className="premium-bg relative min-h-[560px]">
      <PremiumBackground />
      <div className="relative z-10 flex flex-col gap-4 p-4">
        <BrandHeader
          status={stats.sessionStatus}
          statusVariant={statusVariant(stats.sessionStatus)}
        />

        {isActive && (
          <div className="glass-card flex items-center justify-center gap-4 p-4">
            <ProgressRing value={progressPercent} label="complete" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-muted-foreground">Scrape progress</span>
                <span className="text-primary">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-[11px] text-muted-foreground">
                {stats.productsSaved} of {stats.productsFound} products saved
              </p>
            </div>
          </div>
        )}

        <DashboardStatsGrid {...stats} showHeader={false} />

        <ControlBar
          sessionStatus={stats.sessionStatus}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          onNewSession={handleNewSession}
          onSettings={handleSettings}
          onOpenSidePanel={handleOpenSidePanel}
          isLoading={isLoading || isFetching}
        />

        <LogsPanel logs={logs} />
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
