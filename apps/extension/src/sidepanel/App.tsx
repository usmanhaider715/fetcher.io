import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  SCRAPING_MODES,
  type DashboardStats,
  type ExtensionMessage,
  type LogEntry,
  type ProductSortFilter,
  type ScrapingMode,
  type SelectorMap,
} from '@fetcher/shared';
import {
  Crosshair,
  Download,
  Eye,
  Globe,
  MousePointer2,
  Save,
  Settings,
  Sparkles,
} from 'lucide-react';
import { AppProviders } from '@/components/app-providers';
import { DashboardStatsGrid } from '@/components/dashboard/stats-grid';
import { CategoryManager } from '@/components/dashboard/category-manager';
import { ConnectorsPanel } from '@/components/dashboard/connectors-panel';
import { ExportPanel } from '@/components/dashboard/export-panel';
import { FilterPanel, type ScrapeFilters } from '@/components/dashboard/filter-panel';
import { UrlImportPanel } from '@/components/dashboard/url-import-panel';
import { LogsPanel } from '@/components/dashboard/logs-panel';
import { ControlBar } from '@/components/dashboard/control-bar';
import { BrandHeader } from '@/components/layout/brand-header';
import { PremiumBackground } from '@/components/layout/premium-background';
import { SidebarNav, type NavItem } from '@/components/layout/sidebar-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { onMessage, sendMessage } from '@/lib/messaging';
import { saveDomainSelectors } from '@/lib/domain-selectors';
import { backendApi } from '@/lib/backend-api';
import { useDashboardStore } from '@/stores/dashboard-store';
import '@/styles/globals.css';

const NAV_ITEMS: NavItem[] = [
  { id: 'scraper', label: 'Scraper', icon: Sparkles },
  { id: 'page', label: 'Current Page', icon: Globe },
  { id: 'preview', label: 'Data Preview', icon: Eye },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'settings', label: 'Settings', icon: Settings },
];

async function fetchDashboardStats(): Promise<DashboardStats> {
  return sendMessage<undefined, DashboardStats>({ type: 'GET_DASHBOARD_STATS' });
}

function SidePanel() {
  const queryClient = useQueryClient();
  const { stats, logs, isLoading, setStats, setSessionStatus, addLog, setLogs, setLoading } =
    useDashboardStore();
  const [activeNav, setActiveNav] = useState('scraper');
  const [selectedMode, setSelectedMode] = useState<ScrapingMode>('current_collection');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSelectors, setRecordedSelectors] = useState<SelectorMap | null>(null);
  const [importUrls, setImportUrls] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ScrapeFilters>({
    sortFilter: 'default',
    maxPages: 10,
    minRating: 0,
    minReviews: 0,
  });
  const [resumable, setResumable] = useState<{
    processedCount: number;
    currentPage: number;
  } | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (data) setStats(data);
  }, [data, setStats]);

  useEffect(() => {
    sendMessage({ type: 'GET_RESUMABLE_SESSION' })
      .then((result) => {
        const r = result as { resumable?: boolean; processedCount?: number; currentPage?: number };
        if (r?.resumable) {
          setResumable({ processedCount: r.processedCount ?? 0, currentPage: r.currentPage ?? 1 });
        } else {
          setResumable(null);
        }
      })
      .catch(() => setResumable(null));
  }, [stats.sessionStatus]);

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
      const payload: {
        mode: ScrapingMode;
        urls?: string[];
        categoryId?: string;
        subcategoryId?: string;
        sortFilter: ProductSortFilter;
        maxPages?: number;
        minRating?: number;
        minReviews?: number;
        respectRobots?: boolean;
        maxCrawlPages?: number;
        productConcurrency?: number;
      } = { mode: selectedMode, sortFilter: filters.sortFilter };

      if (categoryId) payload.categoryId = categoryId;
      if (subcategoryId) payload.subcategoryId = subcategoryId;
      if (selectedMode === 'import_csv' || selectedMode === 'selected_urls') {
        payload.urls = importUrls;
      }
      if (selectedMode === 'entire_website' || selectedMode === 'current_collection') {
        payload.maxPages = filters.maxPages;
        if (filters.minRating > 0) payload.minRating = filters.minRating;
        if (filters.minReviews > 0) payload.minReviews = filters.minReviews;
      }
      if (selectedMode === 'entire_website') {
        payload.respectRobots = true;
        payload.maxCrawlPages = filters.maxPages;
        payload.productConcurrency = 2;
      }

      await sendMessage({ type: 'START_SCRAPE', payload });
      setSessionStatus('running');
      await refetch();
    } finally {
      setLoading(false);
    }
  }, [selectedMode, filters, importUrls, categoryId, subcategoryId, setLoading, setSessionStatus, refetch]);

  const handlePause = useCallback(async () => {
    await sendMessage({ type: 'PAUSE_SCRAPE' });
    setSessionStatus('paused');
  }, [setSessionStatus]);

  const handleResume = useCallback(async () => {
    await sendMessage({ type: 'RESUME_SCRAPE' });
    setSessionStatus('running');
  }, [setSessionStatus]);

  const handleStop = useCallback(async () => {
    await sendMessage({ type: 'STOP_SCRAPE' });
    setSessionStatus('stopped');
  }, [setSessionStatus]);

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

  const handleStartRecording = useCallback(async () => {
    setIsRecording(true);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'START_SELECTOR_RECORDING' });
    }
  }, []);

  const handleStopRecording = useCallback(async () => {
    setIsRecording(false);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const response = (await chrome.tabs.sendMessage(tab.id, {
        type: 'STOP_SELECTOR_RECORDING',
      })) as { selectors?: SelectorMap };
      if (response?.selectors && Object.keys(response.selectors).length > 0) {
        setRecordedSelectors(response.selectors);
      }
    }
  }, []);

  const handleSaveSelectors = useCallback(async () => {
    if (!recordedSelectors) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url;
    if (!url) return;

    const domain = await saveDomainSelectors(url, recordedSelectors);
    try {
      await backendApi.saveSelectors(domain, 'recorded', recordedSelectors);
    } catch {
      // Saved locally even if backend unavailable
    }

    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'RELOAD_DOMAIN_SELECTORS' });
    }
    setRecordedSelectors(null);
  }, [recordedSelectors]);

  const scraperContent = (
    <div className="space-y-4">
      {resumable && stats.sessionStatus === 'interrupted' && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-semibold">Interrupted session found</p>
            <p className="text-xs text-muted-foreground">
              Page {resumable.currentPage} · {resumable.processedCount} products saved. Resume or start fresh.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="gradient-border">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Scraping Mode</CardTitle>
          <CardDescription className="text-xs">Select how products should be scraped</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0">
          {SCRAPING_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setSelectedMode(mode.value)}
              className={`w-full rounded-xl border p-3 text-left transition-all duration-200 ${
                selectedMode === mode.value
                  ? 'border-primary/40 bg-primary/5 shadow-premium'
                  : 'border-border/60 hover:border-primary/20 hover:bg-accent/40'
              }`}
            >
              <p className="text-sm font-semibold">{mode.label}</p>
              <p className="text-xs text-muted-foreground">{mode.description}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {(selectedMode === 'entire_website' || selectedMode === 'current_collection') && (
        <FilterPanel filters={filters} onChange={setFilters} />
      )}

      {(selectedMode === 'import_csv' || selectedMode === 'selected_urls') && (
        <UrlImportPanel mode={selectedMode} urls={importUrls} onChange={setImportUrls} />
      )}

      <Card className="gradient-border">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Selector Recorder</CardTitle>
              <CardDescription className="text-xs">Record CSS selectors by clicking elements</CardDescription>
            </div>
            {isRecording && (
              <Badge variant="destructive" className="animate-pulse-soft">
                Recording
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex gap-2 p-4 pt-0">
          {!isRecording ? (
            <Button onClick={handleStartRecording} variant="outline" size="sm" className="flex-1">
              <Crosshair className="h-4 w-4" />
              Record
            </Button>
          ) : (
            <Button onClick={handleStopRecording} variant="destructive" size="sm" className="flex-1">
              <MousePointer2 className="h-4 w-4" />
              Stop
            </Button>
          )}
          <Button variant="secondary" size="sm" disabled={!recordedSelectors} onClick={handleSaveSelectors}>
            <Save className="h-4 w-4" />
            Save
          </Button>
        </CardContent>
      </Card>

      <ControlBar
        sessionStatus={stats.sessionStatus}
        onStart={handleStart}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        onNewSession={handleNewSession}
        onSettings={handleSettings}
        onOpenSidePanel={() => {}}
        isLoading={isLoading}
      />

      <CategoryManager
        selectedCategoryId={categoryId}
        selectedSubcategoryId={subcategoryId}
        onSelectionChange={(cat, sub) => {
          setCategoryId(cat);
          setSubcategoryId(sub);
        }}
      />
    </div>
  );

  return (
    <div className="premium-bg relative flex h-screen">
      <PremiumBackground />
      <aside className="relative z-10 flex w-[200px] shrink-0 flex-col border-r border-border/50 glass p-3">
        <BrandHeader
          status={stats.sessionStatus}
          compact
          className="mb-4 px-1"
        />
        <SidebarNav items={NAV_ITEMS} activeId={activeNav} onChange={setActiveNav} />
      </aside>

      <main className="relative z-10 flex-1 overflow-y-auto p-4">
        {activeNav === 'scraper' && scraperContent}
        {activeNav === 'page' && <DashboardStatsGrid {...stats} showHeader={false} />}
        {activeNav === 'preview' && <LogsPanel logs={logs} maxHeight="calc(100vh - 120px)" />}
        {activeNav === 'downloads' && (
          <div className="space-y-4">
            <ExportPanel />
            <ConnectorsPanel />
          </div>
        )}
        {activeNav === 'settings' && (
          <Card className="gradient-border">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm text-muted-foreground">
                Open the full settings page to configure scraping, AI, connectors, and cloud sync.
              </p>
              <Button onClick={handleSettings}>
                <Settings className="h-4 w-4" />
                Open Settings
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export function SidePanelApp() {
  return (
    <AppProviders theme="light">
      <SidePanel />
    </AppProviders>
  );
}
