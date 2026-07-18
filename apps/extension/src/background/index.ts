import type {
  AppSettings,
  CloudAccount,
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
  delay,
  generateRequestId,
} from '@fetcher/shared';
import { backendApi } from '../lib/backend-api';
import { cloudApi } from '../lib/cloud-api';
import { clearCheckpoint, loadCheckpoint } from './checkpoint';
import { scrapeOrchestrator } from './scrape-orchestrator';
import { urlQueueOrchestrator } from './url-queue-orchestrator';
import { discoverProductUrls } from './site-crawler';
import { getSortedStartUrl } from '../content/scrape-page';
import { isJunkProductTitle, matchesCategoryTarget } from '../content/filters';
import * as categoryStore from './category-store';
import { ensureContentScriptReady } from './content-script';
import { downloadBlobFile, downloadProductImagesLocally } from './local-downloads';

class SessionManager {
  private session: ScrapeSession | null = null;
  private logs: LogEntry[] = [];
  private backendConnected = false;
  /** In-memory products for the active cloud run (for local details.txt if needed). */
  private cloudProducts: Product[] = [];

  getSession(): ScrapeSession | null {
    return this.session;
  }

  getCloudProducts(): Product[] {
    return this.cloudProducts;
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  isBackendConnected(): boolean {
    return this.backendConnected;
  }

  isCloudMode(): boolean {
    return Boolean(this.session?.metadata?.['cloudMode']);
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

  async refreshBackend(): Promise<boolean> {
    await backendApi.init();
    this.backendConnected = await backendApi.healthCheck();
    return this.backendConnected;
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
    this.cloudProducts = [];

    const settings = settingsManager.get();
    const token = settings.accessToken;
    if (!token) {
      throw new Error('Sign in required to save scrape runs to your account');
    }

    cloudApi.setAccessToken(token);
    cloudApi.setBaseUrl(settings.cloudApiUrl ?? 'https://api.productfetcher.online');

    // Prefer cloud (no local backend). Fall back to local SQLite only if cloud job create fails
    // and local backend happens to be up.
    let sessionId: string;
    let cloudJobId: string | undefined;
    let projectId = payload.projectId;
    let cloudMode = true;

    try {
      projectId = projectId ?? (await cloudApi.ensureDefaultProject());
      const res = await cloudApi.logJob({
        mode: payload.mode,
        websiteUrl: tabUrl,
        projectId,
        platform: undefined,
        categoryName: payload.categoryName,
        subcategoryName: payload.subcategoryName,
        sortFilter: payload.sortFilter,
        maxProducts: payload.maxProducts,
        status: 'running',
        productsFound: 0,
        productsSaved: 0,
        metadata: {
          folderName,
          categoryId: payload.categoryId,
          subcategoryId: payload.subcategoryId,
          maxPages: payload.maxPages,
        },
      });
      sessionId = res.job._id;
      cloudJobId = res.job._id;
    } catch (cloudError) {
      await backendApi.init();
      if (!(await backendApi.healthCheck())) {
        throw new Error(
          `Cloud save failed (${cloudError instanceof Error ? cloudError.message : 'unknown'}) and local backend is offline.`,
        );
      }
      cloudMode = false;
      const result = await backendApi.startScrape({
        mode: payload.mode,
        websiteUrl: tabUrl,
        urls: payload.urls,
        categoryId: payload.categoryId,
        subcategoryId: payload.subcategoryId,
        categoryName: payload.categoryName,
        subcategoryName: payload.subcategoryName,
        folderName,
        products: [],
      });
      sessionId = result.sessionId;
    }

    this.backendConnected = !cloudMode;
    this.session = {
      id: sessionId,
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
        categoryName: payload.categoryName,
        subcategoryName: payload.subcategoryName,
        projectId,
        cloudJobId,
        cloudMode,
        backendConnected: !cloudMode,
        sortFilter: payload.sortFilter,
        maxPages: payload.maxPages,
        maxProducts: payload.maxProducts,
        folderName,
      },
    };

    await this.persist();
    this.addLog(
      'info',
      `Started scraping in ${payload.mode} mode → ${folderName}` +
        (cloudMode ? ' (cloud run — files download to your computer)' : ' (local backend)') +
        (payload.subcategoryName
          ? ` · target: ${payload.subcategoryName}`
          : payload.categoryName
            ? ` · target: ${payload.categoryName}`
            : ''),
      this.session.id,
    );
    this.broadcastProgress();
    return this.session;
  }

  async saveProduct(
    product: Product,
    meta?: { adapter?: string; productUrl?: string; durationMs?: number },
  ): Promise<boolean> {
    if (!this.session) return false;

    if (isJunkProductTitle(product.title)) {
      this.addLog('warning', `Skipped junk listing title: ${(product.title ?? '').slice(0, 60)}`, this.session.id);
      return false;
    }

    const categoryName = this.session.metadata?.['categoryName'] as string | undefined;
    const subcategoryName = this.session.metadata?.['subcategoryName'] as string | undefined;
    if (
      (categoryName || subcategoryName) &&
      !matchesCategoryTarget(product, { categoryName, subcategoryName })
    ) {
      this.addLog(
        'warning',
        `Skipped off-target product (wanted "${subcategoryName ?? categoryName}"): ${product.title?.slice(0, 80)}`,
        this.session.id,
      );
      return false;
    }

    const cloudMode = Boolean(this.session.metadata?.['cloudMode']);
    const folderName = (this.session.metadata?.['folderName'] as string) ?? this.session.id;
    const started = Date.now();

    try {
      if (cloudMode) {
        const jobId = (this.session.metadata?.['cloudJobId'] as string) ?? this.session.id;
        const settings = settingsManager.get();
        cloudApi.setAccessToken(settings.accessToken!);
        cloudApi.setBaseUrl(settings.cloudApiUrl ?? 'https://api.productfetcher.online');

        const imageUrls = product.imageUrls ?? [];
        await cloudApi.appendProducts(jobId, [
          {
            title: product.title,
            price: product.price,
            currency: product.currency,
            productUrl: product.productUrl,
            imageUrls: imageUrls.slice(0, 50),
            imageCount: imageUrls.length,
            category: categoryName ?? product.category,
            subcategory: subcategoryName ?? product.subcategory,
            sku: product.sku,
            platform: product.platform,
            scrapedAt: product.scrapedDate ?? new Date().toISOString(),
          },
        ]);

        const imagesDownloaded = await downloadProductImagesLocally(folderName, product);
        this.cloudProducts.push(product);
        this.session.productsSaved++;
        this.session.imagesDownloaded += imagesDownloaded;

        this.addLog(
          'success',
          `Saved: ${product.title ?? product.uniqueId}` +
            (imagesDownloaded ? ` (${imagesDownloaded} images → Downloads/fetcher-io)` : ''),
          this.session.id,
          {
            adapter: meta?.adapter ?? product.platform,
            productUrl: meta?.productUrl ?? product.productUrl,
            durationMs: meta?.durationMs ?? Date.now() - started,
            images: imagesDownloaded,
          },
        );
        this.broadcastProgress();
        return true;
      }

      if (!(await this.refreshBackend())) {
        this.session.errors++;
        this.addLog(
          'error',
          'Backend offline — product not saved. Restart `pnpm dev:backend`.',
          this.session.id,
        );
        this.broadcastProgress();
        return false;
      }

      const result = await backendApi.saveProduct(
        product,
        this.session.id,
        this.session.metadata?.['categoryId'] as string | undefined,
        this.session.metadata?.['subcategoryId'] as string | undefined,
        this.session.metadata?.['categoryName'] as string | undefined,
        this.session.metadata?.['subcategoryName'] as string | undefined,
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
          `Saved: ${product.title ?? product.uniqueId}` +
            (result.imagesDownloaded ? ` (${result.imagesDownloaded} images)` : ''),
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

      this.addLog('warning', `Product not saved: ${product.title ?? product.productUrl}`, this.session.id);
      return false;
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
    void finalizeCloudJob(this.session, 'interrupted');
  }

  reset(): void {
    this.session = null;
    this.logs = [];
    this.cloudProducts = [];
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
    cloudApi.setBaseUrl(this.settings.cloudApiUrl ?? 'https://api.productfetcher.online');
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
    cloudApi.setBaseUrl(this.settings.cloudApiUrl ?? 'https://api.productfetcher.online');
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

let cloudAccountCache: CloudAccount = { signedIn: false };

async function fetchCloudAccount(): Promise<CloudAccount> {
  const settings = settingsManager.get();
  if (!settings.accessToken) {
    cloudAccountCache = { signedIn: false };
    return cloudAccountCache;
  }

  cloudApi.setBaseUrl(settings.cloudApiUrl ?? 'https://api.productfetcher.online');
  cloudApi.setAccessToken(settings.accessToken);

  try {
    const me = await cloudApi.getMe();
    cloudAccountCache = {
      signedIn: true,
      userId: me.user.id,
      email: me.user.email,
      plan: me.organization?.plan ?? 'free',
      organizationId: me.organization?.id,
      organizationName: me.organization?.name,
    };
    chrome.runtime.sendMessage({ type: 'CLOUD_ACCOUNT', payload: cloudAccountCache }).catch(() => {});
    return cloudAccountCache;
  } catch {
    cloudAccountCache = { signedIn: false };
    return cloudAccountCache;
  }
}

async function setAccessToken(token: string): Promise<CloudAccount> {
  await settingsManager.update({ accessToken: token });
  sessionManager.addLog('info', 'Fetcher.io account linked');
  const account = await fetchCloudAccount();
  try {
    cloudApi.setAccessToken(token);
    await cloudApi.ensureDefaultProject();
  } catch {
    // project created on first scrape if needed
  }
  return account;
}

async function disconnectCloudAccount(): Promise<CloudAccount> {
  await settingsManager.update({ accessToken: undefined });
  cloudAccountCache = { signedIn: false };
  sessionManager.addLog('info', 'Fetcher.io account disconnected');
  chrome.runtime.sendMessage({ type: 'CLOUD_ACCOUNT', payload: cloudAccountCache }).catch(() => {});
  return cloudAccountCache;
}

function isSignedIn(): boolean {
  return Boolean(settingsManager.get().accessToken);
}

function statsWithAuth(tabUrl: string, platform: string | null, authRequired = false): DashboardStats {
  return {
    ...sessionManager.getDashboardStats(tabUrl, platform),
    authRequired: authRequired || !isSignedIn(),
  };
}

async function createCloudJobForSession(session: ScrapeSession, projectId?: string): Promise<void> {
  // Job is created in SessionManager.start for cloud mode
  if (session.metadata?.['cloudJobId']) {
    if (projectId && session.metadata['projectId'] !== projectId) {
      session.metadata['projectId'] = projectId;
      sessionManager.updateStats({ metadata: session.metadata });
    }
    return;
  }

  const settings = settingsManager.get();
  if (!settings.accessToken) return;

  cloudApi.setAccessToken(settings.accessToken);
  cloudApi.setBaseUrl(settings.cloudApiUrl ?? 'https://api.productfetcher.online');

  try {
    const pid = projectId ?? (await cloudApi.ensureDefaultProject());
    const res = await cloudApi.logJob({
      mode: session.mode,
      websiteUrl: session.websiteUrl,
      projectId: pid,
      platform: session.platform,
      categoryName: session.metadata?.['categoryName'] as string | undefined,
      subcategoryName: session.metadata?.['subcategoryName'] as string | undefined,
      sortFilter: session.metadata?.['sortFilter'] as string | undefined,
      maxProducts: session.metadata?.['maxProducts'] as number | undefined,
      status: 'running',
      productsFound: 0,
      productsSaved: 0,
      metadata: {
        localSessionId: session.id,
        platform: session.platform,
        folderName: session.metadata?.['folderName'],
        categoryId: session.metadata?.['categoryId'],
        subcategoryId: session.metadata?.['subcategoryId'],
      },
    });

    if (session.metadata) {
      session.metadata['cloudJobId'] = res.job._id;
      session.metadata['projectId'] = pid;
    }
    sessionManager.updateStats({ metadata: session.metadata });
    sessionManager.addLog('info', `Run synced to dashboard`, session.id);
  } catch (error) {
    sessionManager.addLog(
      'warning',
      `Dashboard sync failed: ${error instanceof Error ? error.message : 'unknown'}`,
      session.id,
    );
  }
}

async function finalizeCloudJob(session: ScrapeSession, status: 'completed' | 'failed' | 'interrupted'): Promise<void> {
  const jobId = (session.metadata?.['cloudJobId'] as string | undefined) ?? (
    session.metadata?.['cloudMode'] ? session.id : undefined
  );
  if (!jobId || !settingsManager.get().accessToken) return;

  cloudApi.setAccessToken(settingsManager.get().accessToken!);
  try {
    await cloudApi.updateJob(jobId, {
      status,
      productsFound: session.productsFound,
      productsSaved: session.productsSaved,
      imagesDownloaded: session.imagesDownloaded,
      errors: session.errors,
      durationMs: Date.now() - new Date(session.startedAt).getTime(),
      platform: session.platform,
      categoryName: session.metadata?.['categoryName'] as string | undefined,
      subcategoryName: session.metadata?.['subcategoryName'] as string | undefined,
      metadata: {
        localSessionId: session.id,
        platform: session.platform,
        folderName: session.metadata?.['folderName'],
        projectId: session.metadata?.['projectId'],
        exportedAt: status === 'completed' ? new Date().toISOString() : undefined,
      },
    });
  } catch {
    // non-fatal
  }
}

function notifyRunComplete(cloudStatus: 'completed' | 'failed' | 'interrupted' = 'completed'): void {
  const session = sessionManager.getSession();
  if (!session) return;
  const localStatus: ScrapeSession['status'] =
    cloudStatus === 'failed' ? 'error' : cloudStatus === 'interrupted' ? 'interrupted' : 'completed';
  sessionManager.updateStats({ status: localStatus, completedAt: new Date().toISOString() });
  void finalizeCloudJob(session, cloudStatus);
}

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
  notifyRunComplete('completed');
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
    notifyRunComplete('completed');
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

  // Always resolve listing URL from subcategory/category + sort BEFORE scraping
  const targetUrl = getSortedStartUrl(
    tabInfo.url,
    payload.sortFilter,
    payload.categoryName,
    payload.subcategoryName,
  );
  const targetLabel = payload.subcategoryName ?? payload.categoryName;
  const limitLabel = payload.maxProducts ? ` · top ${payload.maxProducts}` : '';

  async function waitForTabComplete(tabId: number, timeoutMs = 20000): Promise<void> {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, timeoutMs);
      const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
        if (id === tabId && info.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  if (targetLabel && tabInfo.tabId) {
    sessionManager.addLog(
      'info',
      `Step 1/3: Searching exactly for "${targetLabel}"${limitLabel}...`,
      session.id,
    );

    // Navigate to marketplace search URL (single query param for CJ compatibility)
    if (targetUrl !== tabInfo.url) {
      await chrome.tabs.update(tabInfo.tabId, { url: targetUrl });
      await waitForTabComplete(tabInfo.tabId);
      const settleMs = /aliexpress\.|temu\.|alibaba\.|cjdropshipping\./i.test(targetUrl)
        ? 2800
        : 800;
      await delay(settleMs);
    }

    // Force the site's own search box so SPA routers apply the exact subcategory
    const ready = await ensureContentScriptReady(tabInfo.tabId);
    if (ready) {
      try {
        const searchResult = (await chrome.tabs.sendMessage(tabInfo.tabId, {
          type: 'PERFORM_SITE_SEARCH',
          payload: { query: targetLabel },
        })) as { ok?: boolean; method?: string; url?: string };

        sessionManager.addLog(
          'info',
          `Site search "${targetLabel}" via ${searchResult?.method ?? 'unknown'}`,
          session.id,
        );

        if (
          searchResult?.method === 'dom-click' ||
          searchResult?.method === 'dom-enter' ||
          searchResult?.method === 'location'
        ) {
          await waitForTabComplete(tabInfo.tabId);
          await delay(
            /cjdropshipping\.|aliexpress\./i.test(tabInfo.url) ? 3000 : 1200,
          );
        }
      } catch (error) {
        sessionManager.addLog(
          'warning',
          `Site search UI failed: ${error instanceof Error ? error.message : 'unknown'} — using URL search`,
          session.id,
        );
      }
    }

    const tab = await chrome.tabs.get(tabInfo.tabId);
    tabInfo = { ...tabInfo, url: tab.url ?? targetUrl };
    sessionManager.updateStats({ currentUrl: tabInfo.url });
    sessionManager.addLog('info', `Search URL: ${tabInfo.url}`, session.id);
  } else if (targetUrl !== tabInfo.url && tabInfo.tabId) {
    sessionManager.addLog('info', `Step 1/3: Applying sort filter${limitLabel}...`, session.id);
    await chrome.tabs.update(tabInfo.tabId, { url: targetUrl });
    await waitForTabComplete(tabInfo.tabId);
    await delay(800);
    tabInfo = { ...tabInfo, url: targetUrl };
    sessionManager.updateStats({ currentUrl: targetUrl });
  }

  // With a subcategory/category target on Amazon (or similar search), prefer collection
  // pagination of that search — whole-site crawl ignores the filter.
  const hasTarget = Boolean(payload.subcategoryName || payload.categoryName);
  const useCollectionForTarget =
    hasTarget &&
    (payload.mode === 'entire_website' || payload.mode === 'current_collection');

  if (payload.mode === 'entire_website' && !useCollectionForTarget) {
    sessionManager.addLog('info', 'Discovering product URLs (sitemap/BFS)...', session.id);
    const discovery = await discoverProductUrls(tabInfo.url, {
      maxPages: payload.maxCrawlPages ?? payload.maxPages ?? 20,
      respectRobots: payload.respectRobots !== false,
      maxProducts: payload.maxProducts ?? 500,
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

  if (useCollectionForTarget && payload.mode === 'entire_website') {
    sessionManager.addLog(
      'info',
      `Step 2/3: Filters applied — scraping search results for "${targetLabel}" (not entire site)`,
      session.id,
    );
  }

  if (payload.maxProducts) {
    sessionManager.addLog(
      'info',
      `Step 3/3: Will scrape top ${payload.maxProducts} products then stop`,
      session.id,
    );
  }

  if (!tabInfo.tabId) throw new Error('No active tab');
  await scrapeOrchestrator.start(
    tabInfo.tabId,
    tabInfo.url,
    {
      ...payload,
      // Force collection-style page scrape when targeting a subcategory
      mode: useCollectionForTarget ? 'current_collection' : payload.mode,
      maxPages: payload.maxPages ?? (useCollectionForTarget ? 10 : undefined),
    },
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
      return statsWithAuth(tabInfo.url, platform);
    }

    case 'GET_TAB_INFO':
      return getActiveTabInfo();

    case 'GET_SETTINGS':
      return settingsManager.get();

    case 'UPDATE_SETTINGS': {
      const updated = await settingsManager.update(message.payload as Partial<AppSettings>);
      const payload = message.payload as Partial<AppSettings> | undefined;
      if (payload && 'accessToken' in payload) {
        void fetchCloudAccount();
      }
      return updated;
    }

    case 'GET_CLOUD_ACCOUNT':
      return fetchCloudAccount();

    case 'SET_ACCESS_TOKEN': {
      const token = (message.payload as { accessToken?: string })?.accessToken;
      if (!token) return { error: 'accessToken required' };
      return setAccessToken(token);
    }

    case 'DISCONNECT_CLOUD':
      return disconnectCloudAccount();

    case 'GET_CATEGORIES':
      return categoryStore.getCategories();

    case 'CREATE_CATEGORY': {
      const name = (message.payload as { name?: string })?.name;
      if (!name) return { error: 'name required' };
      return categoryStore.createCategory(name);
    }

    case 'CREATE_SUBCATEGORY': {
      const { categoryId, name } = (message.payload as { categoryId?: string; name?: string }) ?? {};
      if (!categoryId || !name) return { error: 'categoryId and name required' };
      return categoryStore.createSubcategory(categoryId, name);
    }

    case 'DELETE_CATEGORY': {
      const categoryId = (message.payload as { categoryId?: string })?.categoryId;
      if (!categoryId) return { error: 'categoryId required' };
      await categoryStore.deleteCategory(categoryId);
      return { ok: true };
    }

    case 'DELETE_SUBCATEGORY': {
      const { categoryId, subcategoryId } =
        (message.payload as { categoryId?: string; subcategoryId?: string }) ?? {};
      if (!categoryId || !subcategoryId) return { error: 'categoryId and subcategoryId required' };
      await categoryStore.deleteSubcategory(categoryId, subcategoryId);
      return { ok: true };
    }

    case 'GET_PROJECTS': {
      if (!isSignedIn()) return { projects: [] };
      cloudApi.setAccessToken(settingsManager.get().accessToken!);
      try {
        let { projects } = await cloudApi.getProjects();
        if (projects.length === 0) {
          await cloudApi.ensureDefaultProject();
          ({ projects } = await cloudApi.getProjects());
        }
        return { projects };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to load projects', projects: [] };
      }
    }

    case 'GET_BACKEND_STATUS': {
      // Signed-in cloud mode does not need local backend
      if (isSignedIn()) {
        return { connected: true, cloud: true };
      }
      await backendApi.init();
      return { connected: await backendApi.healthCheck(), cloud: false };
    }

    case 'EXPORT_AND_DOWNLOAD': {
      const { format, sessionId } = (message.payload as { format?: string; sessionId?: string }) ?? {};
      if (!format) return { error: 'format required' };

      const session = sessionManager.getSession();
      const activeSessionId = sessionId ?? session?.id;
      if (!activeSessionId) {
        return { error: 'No active session to export. Start a scrape first.' };
      }

      const cloudMode = Boolean(session?.metadata?.['cloudMode']);
      const cloudJobId =
        (session?.metadata?.['cloudJobId'] as string | undefined) ??
        (cloudMode ? activeSessionId : undefined);

      try {
        if (cloudMode && cloudJobId && isSignedIn()) {
          cloudApi.setAccessToken(settingsManager.get().accessToken!);
          cloudApi.setBaseUrl(settingsManager.get().cloudApiUrl ?? 'https://api.productfetcher.online');

          const exportFormat = format === 'csv' ? 'csv' : 'json';
          if (format === 'excel' || format === 'zip' || format === 'txt') {
            // Stream JSON from cloud (no VPS file storage); images already in Downloads
            const { blob, filename } = await cloudApi.exportJob(cloudJobId, 'json');
            if (blob.size < 10) {
              return { error: 'Export empty — no products saved for this run yet.' };
            }
            const downloadId = await downloadBlobFile(
              filename.replace(/\.json$/, `.${format === 'txt' ? 'json' : 'json'}`),
              blob,
            );
            const detail = await cloudApi.getJob(cloudJobId);
            return {
              success: true,
              count: detail.productCount,
              downloadId,
              filename,
              note:
                format === 'zip'
                  ? 'Product metadata downloaded as JSON. Images were saved to Downloads/fetcher-io during scrape.'
                  : undefined,
            };
          }

          const { blob, filename } = await cloudApi.exportJob(cloudJobId, exportFormat);
          if (blob.size < 10) {
            return { error: 'Export empty — no products saved for this run yet.' };
          }
          const downloadId = await downloadBlobFile(filename, blob);
          const detail = await cloudApi.getJob(cloudJobId);
          return { success: true, count: detail.productCount, downloadId, filename };
        }

        await backendApi.init();
        if (!(await backendApi.healthCheck())) {
          return { error: 'Sign in to export from cloud, or run pnpm dev:backend for local export.' };
        }

        const stored = await backendApi.getProducts(activeSessionId, 1);
        if (!stored.total) {
          return { error: 'No products saved for this session yet.' };
        }

        const result = await backendApi.export(
          format as import('@fetcher/shared').ExportFormat,
          activeSessionId,
        );
        if (!result.count || !result.downloadUrl || !result.filename) {
          return { error: 'Export produced an empty file — no products in this session.' };
        }
        const blob = await backendApi.downloadExport(result.downloadUrl, result.filename);
        if (blob.size < 10) {
          return { error: 'Export file is empty (0 bytes).' };
        }
        const downloadId = await downloadBlobFile(result.filename, blob);
        return { success: true, count: result.count, downloadId, filename: result.filename };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Export failed' };
      }
    }

    case 'PURGE_SESSION': {
      const session = sessionManager.getSession();
      const sessionId = session?.id;
      const cloudJobId = session?.metadata?.['cloudJobId'] as string | undefined;
      // Free local session only — cloud run history stays on dashboard until deleted there
      if (sessionId && !session?.metadata?.['cloudMode']) {
        await backendApi.init();
        if (await backendApi.healthCheck()) {
          try {
            await backendApi.purgeSession(sessionId);
          } catch (error) {
            sessionManager.addLog(
              'warning',
              `Purge partial: ${error instanceof Error ? error.message : 'unknown'}`,
              sessionId,
            );
          }
        }
      }
      scrapeOrchestrator.stop();
      urlQueueOrchestrator.stop();
      sessionManager.reset();
      return {
        success: true,
        purged: true,
        cloudJobKept: Boolean(cloudJobId),
      };
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

      if (!isSignedIn()) {
        sessionManager.addLog(
          'error',
          'Sign in required — open app.productfetcher.online/dashboard/extension to link your account',
        );
        return statsWithAuth(tabInfo.url, platform, true);
      }

      try {
        const account = await fetchCloudAccount();
        if (!account.signedIn) {
          sessionManager.addLog('error', 'Session expired — sign in again at app.productfetcher.online');
          return statsWithAuth(tabInfo.url, platform, true);
        }
        sessionManager.addLog('info', `Signed in as ${account.email} (${account.plan} plan)`);
      } catch {
        sessionManager.addLog('error', 'Could not verify account — check your connection');
        return statsWithAuth(tabInfo.url, platform, true);
      }

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

      let session;
      try {
        session = await sessionManager.start(payload, tabInfo.url);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to start scrape';
        sessionManager.addLog('error', msg);
        return { ...statsWithAuth(tabInfo.url, platform), error: msg };
      }

      await createCloudJobForSession(session, payload.projectId);

      if (platform) {
        sessionManager.updateStats({ platform: platform as ScrapeSession['platform'] });
        const jobId = session.metadata?.['cloudJobId'] as string | undefined;
        if (jobId && settingsManager.get().accessToken) {
          cloudApi.setAccessToken(settingsManager.get().accessToken!);
          void cloudApi.updateJob(jobId, { platform }).catch(() => {});
        }
      }

      try {
        await runScrape(payload, session, tabInfo);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Scrape failed to start';
        sessionManager.addLog('error', msg, session.id);
        sessionManager.updateStats({ status: 'error' });
        void finalizeCloudJob(session, 'failed');
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
            notifyRunComplete('completed');
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
  void fetchCloudAccount();

  if (chrome.sidePanel) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await sessionManager.load();
  await settingsManager.load();
  void fetchCloudAccount();
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

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  const extMessage = message as ExtensionMessage;
  if (extMessage.type === 'SET_ACCESS_TOKEN') {
    const token = (extMessage.payload as { accessToken?: string })?.accessToken;
    if (!token) {
      sendResponse({ error: 'accessToken required' });
      return true;
    }
    setAccessToken(token)
      .then(sendResponse)
      .catch((error: Error) => sendResponse({ error: error.message }));
    return true;
  }
  if (extMessage.type === 'GET_CLOUD_ACCOUNT') {
    fetchCloudAccount()
      .then(sendResponse)
      .catch((error: Error) => sendResponse({ error: error.message }));
    return true;
  }
  if (extMessage.type === 'PING') {
    sendResponse({ ok: true, extension: 'fetcher.io' });
    return true;
  }
  sendResponse({ error: 'Unknown message type' });
  return true;
});

sessionManager.load();
settingsManager.load().then(() => fetchCloudAccount());

export { sessionManager, settingsManager };
