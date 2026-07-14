import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DashboardStats, ExtensionMessage, LogEntry } from '@fetcher/shared';
import { AppProviders } from '@/components/app-providers';
import { ControlBar } from '@/components/dashboard/control-bar';
import { DashboardStatsGrid } from '@/components/dashboard/stats-grid';
import { LogsPanel } from '@/components/dashboard/logs-panel';
import { Progress } from '@/components/ui/progress';
import { onMessage, sendMessage } from '@/lib/messaging';
import { useDashboardStore } from '@/stores/dashboard-store';
import '@/styles/globals.css';

async function fetchDashboardStats(): Promise<DashboardStats> {
  return sendMessage<undefined, DashboardStats>({ type: 'GET_DASHBOARD_STATS' });
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
    if (data) {
      setStats(data);
    }
  }, [data, setStats]);

  useEffect(() => {
    const unsubscribe = onMessage((message: ExtensionMessage) => {
      if (message.type === 'DASHBOARD_STATS' && message.payload) {
        setStats(message.payload as DashboardStats);
        queryClient.setQueryData(['dashboard-stats'], message.payload);
      }
      if (message.type === 'SCRAPE_PROGRESS' && message.payload) {
        const progress = message.payload as DashboardStats;
        setStats(progress);
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
      await sendMessage({
        type: 'START_SCRAPE',
        payload: { mode: 'current_product' },
      });
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

  return (
    <div className="flex flex-col gap-3 p-4">
      <DashboardStatsGrid {...stats} />

      {stats.sessionStatus === 'running' && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      )}

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
  );
}

export function PopupApp() {
  return (
    <AppProviders>
      <Dashboard />
    </AppProviders>
  );
}
