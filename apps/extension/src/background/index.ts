import type {
  AppSettings,
  DashboardStats,
  ExtensionMessage,
  LogEntry,
  Product,
  ScrapeCheckpoint,
  ScrapeSession,
  ScrapingMode,
  StartScrapePayload,
} from '@fetcher/shared';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  generateRequestId,
} from '@fetcher/shared';
import { backendApi } from '../lib/backend-api';
import { cloudApi } from '../lib/cloud-api';
import { clearCheckpoint, loadCheckpoint } from './checkpoint';
import { scrapeOrchestrator } from './scrape-orchestrator';
import { urlQueueOrchestrator } from './url-queue-orchestrator';
import { discoverProductUrls } from './site-crawler';

class SessionManager {
  private session: ScrapeSession | null = null;
  private logs: LogEntry[] = [];
  private backendConnected = false;

  getSession(): ScrapeSession | null {
    return this.session;
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  isBackendConnected(): boolean {
    return this.backendConnected;
  }

  async load(): Promise<void> {
    const result = await chrome.storage.local.get([STORAGE_KEYS.SESSION, STORAGE_KEYS.LOGS]);
    this.session = (result[STORAGE_KEYS.SESSION] as ScrapeSession) ?? null;
    this.logs = (result[STORAGE_KEYS.LOGS] as LogEntry[]) ?? [];

    if (this.session?.status === 'running') {
      this.session.status = 'interrupted';
      this.session.updatedAt = new Date().toISOString();
      await this.persist();
    }

    await backendApi.init();
    this.backendConnected = await backendApi.healthCheck();
  }

  private async persist(): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SESSION]: this.session,
      [STORAGE_KEYS.LOGS]: this.logs.slice(0, 500),
    });
  }

  addLog(
    level: LogEntry['level'],
    message: string,
    sessionId?: string,
    metadata?: Record<string, unknown>,
  ): LogEntry {
    const entry: LogEntry = {
      id: generateRequestId(),
      level,
      message,
      timestamp: new Date().toISOString(),
      sessionId,
      metadata,
    };
    this.logs.unshift(entry);
    this.persist();
    this.broadcastLog(entry);
    return entry;
  }

  private broadcastLog(entry: LogEntry): void {
    chrome.runtime.sendMessage({ type: 'SCRAPE_LOG', payload: entry }).catch(() => {});
  }

  async start(payload: StartScrapePayload, tabUrl: string): Promise<ScrapeSession> {
    const now = new Date().toISOString();
    const folderName = `scrape_${now.replace(/[:.]/g, '-').slice(0, 19)}`;

    let backendSessionId: string | undefined;
    if (this.backendConnected) {
      try {
        const result = await backendApi.startScrape({
          mode: payload.mode,
          websiteUrl: tabUrl,
          urls: payload.urls,
          categoryId: payload.categoryId,
          subcategoryId: payload.subcategoryId,
          folderName,
          products: [],
        });
        backendSessionId = result.sessionId;
      } catch (error) {
        this.addLog('warning', `Backend unavailable, using local session: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }

    this.session = {
      id: backendSessionId ?? generateRequestId(),
      mode: payload.mode,
      status: 'running',
      websiteUrl: tabUrl,
      productsFound: 0,
      productsSaved: 0,
      imagesDownloaded: 0,
      imagesPending: 0,
      errors: 0,
      startedAt: now,
      updatedAt: now,
      currentUrl: tabUrl,
      productUrls: payload.urls ?? [],
      metadata: {
        categoryId: payload.categoryId,
        subcategoryId: payload.subcategoryId,
        backendConnected: this.backendConnected,
        sortFilter: payload.sortFilter,
        maxPages: payload.maxPages,
        folderName,
      },
    };

    await this.persist();
    this.addLog('info', `Started scraping in ${payload.mode} mode → ${folderName}`, this.session.id);
    this.broadcastProgress();
    return this.session;
  }

  async saveProduct(
    product: Product,
    meta?: { adapter?: string; productUrl?: string; durationMs?: number },
  ): Promise<boolean> {
    if (!this.session) return false;

    if (this.backendConnected) {
      try {
        const started = Date.now();
        const result = await backendApi.saveProduct(
          product,
          this.session.id,
          this.session.metadata?.['categoryId'] as string | undefined,
          this.session.metadata?.['subcategoryId'] as string | undefined,
        );
        const durationMs = meta?.durationMs ?? Date.now() - started;

        if (result.saved) {
          this.session.productsSaved++;
          if (result.imagesDownloaded) {
            this.session.imagesDownloaded += result.imagesDownloaded;
          }
          if (result.imagesPending) {
            this.session.imagesPending = (this.session.imagesPending ?? 0) + result.imagesPending;
          }
          this.addLog(
            'success',
            `Saved: ${product.title ?? product.uniqueId}`,
            this.session.id,
            {
              adapter: meta?.adapter ?? product.platform,
              productUrl: meta?.productUrl ?? product.productUrl,
              durationMs,
              images: result.imagesDownloaded ?? 0,
            },
          );
          this.broadcastProgress();
          return true;
        }

        if (result.reason === 'duplicate') {
          this.addLog(
            'warning',
            `Duplicate skipped: ${product.title ?? product.productUrl}`,
            this.session.id,
            { productUrl: product.productUrl, reason: 'duplicate' },
          );
          this.broadcastProgress();
          return false;
        }
      } catch (error) {
        this.session.errors++;
        this.addLog(
          'error',
          `Save failed: ${error instanceof Error ? error.message : 'unknown'}`,
          this.session.id,
          { productUrl: product.productUrl, adapter: product.platform },
        );
        this.broadcastProgress();
        return false;
      }
    }

    this.session.productsSaved++;
    this.broadcastProgress();
    return true;
  }

  pause(): void {
    if (!this.session || this.session.status !== 'running') return;
    this.session.status = 'paused';
    this.session.pausedAt = new Date().toISOString();
    this.session.updatedAt = new Date().toISOString();
    this.persist();
    this.addLog('warning', 'Session paused', this.session.id);
    this.broadcastProgress();
  }

  resume(): void {
    if (!this.session || this.session.status !== 'paused') return;
    this.session.status = 'running';
    this.session.updatedAt = new Date().toISOString();
    this.persist();
    this.addLog('info', 'Session resumed', this.session.id);
    this.broadcastProgress();
  }

  stop(): void {
    if (!this.session) return;
    this.session.status = 'interrupted';
    this.session.updatedAt = new Date().toISOString();
    this.persist();
    this.addLog('warning', 'Session interrupted — use Resume to continue', this.session.id);
    this.broadcastProgress();
  }

  reset(): void {
    this.session = null;
    this.logs = [];
    void clearCheckpoint();
    this.persist();
    this.broadcastIdle();
    this.addLog('info', 'New session ready — products will save to a fresh folder');
  }

  private broadcastIdle(): void {
    const stats: DashboardStats = {
      currentUrl: '',
      detectedPlatform: null,
      productsFound: 0,
      productsSaved: 0,
      imagesDownloaded: 0,
      imagesPending: 0,
      errors: 0,
      sessionStatus: 'idle',
    };
    chrome.runtime.sendMessage({ type: 'SCRAPE_PROGRESS', payload: stats }).catch(() => {});
    chrome.runtime.sendMessage({ type: 'DASHBOARD_STATS', payload: stats }).catch(() => {});
  }

  updateStats(stats: Partial<ScrapeSession>): void {
    if (!this.session) return;
    Object.assign(this.session, stats, { updatedAt: new Date().toISOString() });
    this.persist();
    this.broadcastProgress();
  }

  async restoreFromCheckpoint(checkpoint: import('@fetcher/shared').ScrapeCheckpoint): Promise<ScrapeSession> {
    if (!this.session || this.session.id !== checkpoint.sessionId) {
      throw new Error('No matching session found for checkpoint');
    }
    this.session.status = 'running';
    this.session.productsFound = checkpoint.totalFound;
    this.session.productsSaved = checkpoint.totalSaved;
    this.session.currentUrl = checkpoint.listingUrl;
    this.session.updatedAt = new Date().toISOString();
    await this.persist();
    this.broadcastProgress();
    return this.session;
  }

  getDashboardStats(tabUrl: string, platform: string | null): DashboardStats {
    return {
      sessionId: this.session?.id,
      currentUrl: tabUrl,
      detectedPlatform: platform as DashboardStats['detectedPlatform'],
      productsFound: this.session?.productsFound ?? 0,
      productsSaved: this.session?.productsSaved ?? 0,
      imagesDownloaded: this.session?.imagesDownloaded ?? 0,
      imagesPending: this.session?.imagesPending ?? 0,
      pagesDiscovered: this.session?.pagesDiscovered,
      crawlMethod: this.session?.crawlMethod,
      errors: this.session?.errors ?? 0,
      sessionStatus: this.session?.status ?? 'idle',
    };
  }

  private broadcastProgress(): void {
    if (!this.session) return;
    const stats: DashboardStats = {
      sessionId: this.session.id,
      currentUrl: this.session.currentUrl ?? this.session.websiteUrl,
      detectedPlatform: (this.session.platform as DashboardStats['detectedPlatform']) ?? null,
      productsFound: this.session.productsFound,
      productsSaved: this.session.productsSaved,
      imagesDownloaded: this.session.imagesDownloaded,
      imagesPending: this.session.imagesPending ?? 0,
      pagesDiscovered: this.session.pagesDiscovered,
      crawlMethod: this.session.crawlMethod,
      errors: this.session.errors,
      sessionStatus: this.session.status,
    };
    chrome.runtime.sendMessage({ type: 'SCRAPE_PROGRESS', payload: stats }).catch(() => {});
    chrome.runtime.sendMessage({ type: 'DASHBOARD_STATS', payload: stats }).catch(() => {});
  }
}

class SettingsManager {
  private settings: AppSettings = DEFAULT_SETTINGS;

  async load(): Promise<void> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    const stored = result[STORAGE_KEYS.SETTINGS] as AppSettings | undefined;
    if (stored) {
      this.settings = { ...DEFAULT_SETTINGS, ...stored };
    }
    backendApi.setBaseUrl(this.settings.backendUrl);
    cloudApi.setBaseUrl(this.settings.cloudApiUrl ?? 'https://api.fetcherio.dev');
    cloudApi.setAccessToken(this.settings.accessToken ?? null);

    if (await backendApi.healthCheck()) {
      try {
        const remote = await backendApi.getSettings();
        this.settings = { ...this.settings, ...remote };
      } catch {
        // Use local settings
      }
    }
  }

  get(): AppSettings {
    return this.settings;
  }

  async update(settings: Partial<AppSettings>): Promise<AppSettings> {
    this.settings = { ...this.settings, ...settings };
    await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: this.settings });
    backendApi.setBaseUrl(this.settings.backendUrl);
    cloudApi.setBaseUrl(this.settings.cloudApiUrl ?? 'https://api.fetcherio.dev');
    cloudApi.setAccessToken(this.settings.accessToken ?? null);

    if (await backendApi.healthCheck()) {
      try {
        await backendApi.updateSettings(settings);
      } catch {
        // Local only
      }
    }

    return this.settings;
  }
}

const sessionManager = new SessionManager();
const settingsManager = new SettingsManager();

async function getActiveTabInfo(): Promise<{ url: string; title: string; tabId?: number }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return { url: tab?.url ?? '', title: tab?.title ?? '', tabId: tab?.id };
}

async function detectPlatformInActiveTab(): Promise<string | null> {
  const { tabId } = await getActiveTabInfo();
  if (!tabId) return null;

  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'DETECT_PLATFORM' });
    return (response as { platform?: string })?.platform ?? null;
  } catch {
    return null;
  }
}

function isUrlQueueMode(mode: ScrapingMode, payload?: StartScrapePayload): boolean {
  return (
    mode === 'import_csv' ||
    mode === 'selected_urls' ||
    (mode === 'entire_website' && (payload?.urls?.length ?? 0) > 0)
  );
}

async function runUrlQueue(
  urls: string[],
  payload: StartScrapePayload,
  session: ScrapeSession,
): Promise<void> {
  await urlQueueOrchestrator.start(
    urls,
    payload,
    session.id,
    async (product, meta) => sessionManager.saveProduct(product, meta),
    (stats) =>
      sessionManager.updateStats({
        productsFound: stats.productsFound,
        productsSaved: stats.productsSaved,
        currentUrl: stats.currentUrl,
      }),
    (msg, level) => sessionManager.addLog(level, msg, session.id),
  );
  await clearCheckpoint();
  sessionManager.updateStats({ status: 'completed' });
}

async function resumeCheckpoint(
  checkpoint: ScrapeCheckpoint,
  session: ScrapeSession,
  tabInfo: { tabId?: number; url: string },
): Promise<void> {
  scrapeOrchestrator.stop();
  urlQueueOrchestrator.stop();

  if (isUrlQueueMode(checkpoint.payload.mode, checkpoint.payload)) {
    await urlQueueOrchestrator.resumeFromCheckpoint(
      checkpoint,
      async (product, meta) => sessionManager.saveProduct(product, meta),
      (stats) =>
        sessionManager.updateStats({
          productsFound: stats.productsFound,
          productsSaved: stats.productsSaved,
          currentUrl: stats.currentUrl,
        }),
      (msg, level) => sessionManager.addLog(level, msg, session.id),
    );
    await clearCheckpoint();
    sessionManager.updateStats({ status: 'completed' });
    return;
  }

  if (!tabInfo.tabId) throw new Error('No active tab for resume');
  await scrapeOrchestrator.resumeFromCheckpoint(
    checkpoint,
    tabInfo.tabId,
    (msg, level) => sessionManager.addLog(level, msg, session.id),
  );
}

async function runScrape(
  payload: StartScrapePayload,
  session: ScrapeSession,
  tabInfo: { tabId?: number; url: string },
): Promise<void> {
  scrapeOrchestrator.stop();
  urlQueueOrchestrator.stop();

  if (payload.mode === 'import_csv' || payload.mode === 'selected_urls') {
    const urls = payload.urls ?? [];
    if (urls.length === 0) {
      throw new Error('No URLs provided — add URLs before starting');
    }
    sessionManager.updateStats({ productsFound: urls.length });
    await runUrlQueue(urls, payload, session);
    return;
  }

  if (payload.mode === 'entire_website') {
    sessionManager.addLog('info', 'Discovering product URLs (sitemap/BFS)...', session.id);
    const discovery = await discoverProductUrls(tabInfo.url, {
      maxPages: payload.maxCrawlPages ?? payload.maxPages ?? 20,
      respectRobots: payload.respectRobots !== false,
      maxProducts: 500,
    });

    sessionManager.updateStats({
      pagesDiscovered: discovery.pagesDiscovered,
      crawlMethod: discovery.method,
      productsFound: discovery.productUrls.length,
    });
    sessionManager.addLog(
      'info',
      `Discovered ${discovery.productUrls.length} products via ${discovery.method}`,
      session.id,
    );

    if (discovery.productUrls.length > 0) {
      const enriched = { ...payload, urls: discovery.productUrls };
      await runUrlQueue(discovery.productUrls, enriched, session);
      return;
    }

    sessionManager.addLog('warning', 'Crawl found no URLs — falling back to pagination', session.id);
  }

  if (!tabInfo.tabId) throw new Error('No active tab');
  await scrapeOrchestrator.start(
    tabInfo.tabId,
    tabInfo.url,
    payload,
    session.id,
    (msg, level) => sessionManager.addLog(level, msg, session.id),
  );
}

async function handleMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  switch (message.type) {
    case 'PING':
      return { ok: true, backendConnected: sessionManager.isBackendConnected() };

    case 'GET_DASHBOARD_STATS': {
      const tabInfo = await getActiveTabInfo();
      const platform = await detectPlatformInActiveTab();
      const session = sessionManager.getSession();
      if (session?.status === 'running' && sessionManager.isBackendConnected()) {
        try {
          const progress = await backendApi.getProgress(session.id);
          sessionManager.updateStats({
            imagesDownloaded: progress.imagesDownloaded,
            imagesPending: progress.imagesPending ?? 0,
          });
        } catch {
          // ignore progress poll errors
        }
      }
      return sessionManager.getDashboardStats(tabInfo.url, platform);
    }

    case 'GET_TAB_INFO':
      return getActiveTabInfo();

    case 'GET_SETTINGS':
      return settingsManager.get();

    case 'UPDATE_SETTINGS': {
      return settingsManager.update(message.payload as Partial<AppSettings>);
    }

    case 'GET_RESUMABLE_SESSION': {
      const checkpoint = await loadCheckpoint();
      const session = sessionManager.getSession();
      if (!checkpoint || !session || session.status !== 'interrupted') {
        return { resumable: false };
      }
      return {
        resumable: true,
        session,
        checkpoint,
        processedCount: checkpoint.processedProductUrls.length,
        currentPage: checkpoint.currentPage,
      };
    }

    case 'START_SCRAPE': {
      const tabInfo = await getActiveTabInfo();
      const payload = message.payload as StartScrapePayload;
      const platform = await detectPlatformInActiveTab();

      if (payload.mode === 'resume_session') {
        const checkpoint = await loadCheckpoint();
        if (!checkpoint) {
          sessionManager.addLog('error', 'No interrupted session to resume');
          return sessionManager.getDashboardStats(tabInfo.url, platform);
        }

        const session = await sessionManager.restoreFromCheckpoint(checkpoint);
        try {
          await resumeCheckpoint(checkpoint, session, tabInfo);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Resume failed';
          sessionManager.addLog('error', msg, session.id);
          sessionManager.updateStats({ status: 'error' });
        }
        return sessionManager.getDashboardStats(tabInfo.url, platform);
      }

      if (
        (payload.mode === 'import_csv' || payload.mode === 'selected_urls') &&
        (!payload.urls || payload.urls.length === 0)
      ) {
        sessionManager.addLog('error', 'No URLs provided');
        return sessionManager.getDashboardStats(tabInfo.url, platform);
      }

      const session = await sessionManager.start(payload, tabInfo.url);

      if (platform) {
        sessionManager.updateStats({ platform: platform as ScrapeSession['platform'] });
      }

      try {
        await runScrape(payload, session, tabInfo);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Scrape failed to start';
        sessionManager.addLog('error', msg, session.id);
        sessionManager.updateStats({ status: 'error' });
      }

      return sessionManager.getDashboardStats(tabInfo.url, platform);
    }

    case 'PAUSE_SCRAPE': {
      sessionManager.pause();
      scrapeOrchestrator.pause();
      urlQueueOrchestrator.pause();
      const session = sessionManager.getSession();
      if (session?.id && sessionManager.isBackendConnected()) {
        void backendApi.pauseSession(session.id);
      }
      const tabInfo = await getActiveTabInfo();
      if (tabInfo.tabId) {
        chrome.tabs.sendMessage(tabInfo.tabId, { type: 'PAUSE_SCRAPE' }).catch(() => {});
      }
      return sessionManager.getDashboardStats(tabInfo.url, await detectPlatformInActiveTab());
    }

    case 'RESUME_SCRAPE': {
      const tabInfo = await getActiveTabInfo();
      const checkpoint = await loadCheckpoint();
      const session = sessionManager.getSession();

      if (session?.status === 'paused') {
        sessionManager.resume();
        scrapeOrchestrator.resume();
        urlQueueOrchestrator.resume();
        if (session.id && sessionManager.isBackendConnected()) {
          void backendApi.resumeSession(session.id);
        }
        if (tabInfo.tabId) {
          chrome.tabs.sendMessage(tabInfo.tabId, { type: 'RESUME_SCRAPE' }).catch(() => {});
        }
      } else if (checkpoint && session?.status === 'interrupted') {
        await sessionManager.restoreFromCheckpoint(checkpoint);
        try {
          await resumeCheckpoint(checkpoint, session, tabInfo);
        } catch (error) {
          sessionManager.addLog(
            'error',
            error instanceof Error ? error.message : 'Resume failed',
            session.id,
          );
        }
      } else {
        sessionManager.resume();
        if (tabInfo.tabId) {
          chrome.tabs.sendMessage(tabInfo.tabId, { type: 'RESUME_SCRAPE' }).catch(() => {});
        }
      }

      return sessionManager.getDashboardStats(tabInfo.url, await detectPlatformInActiveTab());
    }

    case 'STOP_SCRAPE': {
      scrapeOrchestrator.stop();
      urlQueueOrchestrator.stop();
      const session = sessionManager.getSession();
      sessionManager.stop();
      if (session?.id && sessionManager.isBackendConnected()) {
        void backendApi.stopSession(session.id);
      }
      const tabInfo = await getActiveTabInfo();
      if (tabInfo.tabId) {
        chrome.tabs.sendMessage(tabInfo.tabId, { type: 'STOP_SCRAPE' }).catch(() => {});
      }
      return sessionManager.getDashboardStats(tabInfo.url, await detectPlatformInActiveTab());
    }

    case 'NEW_SESSION': {
      scrapeOrchestrator.stop();
      urlQueueOrchestrator.stop();
      sessionManager.reset();
      const tabInfo = await getActiveTabInfo();
      return sessionManager.getDashboardStats(tabInfo.url, await detectPlatformInActiveTab());
    }

    case 'DETECT_PLATFORM': {
      return { platform: await detectPlatformInActiveTab() };
    }

    case 'PLATFORM_DETECTED': {
      if (message.payload && typeof message.payload === 'object' && 'platform' in message.payload) {
        sessionManager.updateStats({
          platform: (message.payload as { platform: string }).platform as ScrapeSession['platform'],
        });
      }
      return { ok: true };
    }

    default:
      if ((message as { type: string }).type === 'PAGE_SCRAPED') {
        const result = message.payload as import('@fetcher/shared').PageScrapeResult;
        await scrapeOrchestrator.handlePageScraped(
          result,
          async (product, meta) => sessionManager.saveProduct(product, meta),
          (stats) => sessionManager.updateStats(stats),
          (msg, level) => sessionManager.addLog(level, msg),
          async () => {
            await clearCheckpoint();
            sessionManager.updateStats({ status: 'completed' });
          },
        );
        return { ok: true };
      }

      if ((message as { type: string }).type === 'PRODUCT_EXTRACTED') {
        const { product } = message.payload as { product: Product };
        await sessionManager.saveProduct(product);
        return { ok: true };
      }

      if ((message as { type: string }).type === 'SCRAPE_UPDATE') {
        const stats = message.payload as Partial<ScrapeSession>;
        sessionManager.updateStats(stats);
        if (stats.status === 'completed' || stats.status === 'error') {
          sessionManager.updateStats({ status: stats.status });
        }
        return { ok: true };
      }

      if ((message as { type: string }).type === 'SCRAPE_LOG') {
        const log = message.payload as LogEntry;
        if (log?.message) {
          sessionManager.addLog(log.level ?? 'info', log.message, log.sessionId);
        }
        return { ok: true };
      }

      return { error: 'Unknown message type' };
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    scrapeOrchestrator.onTabUpdated(tabId, changeInfo.status).catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  await sessionManager.load();
  await settingsManager.load();
  sessionManager.addLog('info', 'Fetcher.io extension installed');

  if (chrome.sidePanel) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await sessionManager.load();
  await settingsManager.load();
  if (await backendApi.healthCheck()) {
    await backendApi.validateLicense();
  }
  try {
    const settings = settingsManager.get();
    if (settings.cloudApiUrl) {
      await cloudApi.validateLicense(settings.licenseKey);
    }
  } catch {
    // Cloud license optional — local mode still works
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId && chrome.sidePanel) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message as ExtensionMessage, sender)
    .then(sendResponse)
    .catch((error: Error) => {
      sessionManager.addLog('error', error.message);
      sendResponse({ error: error.message });
    });
  return true;
});

sessionManager.load();
settingsManager.load();

export { sessionManager, settingsManager };
