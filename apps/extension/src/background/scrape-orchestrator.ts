import type { PageScrapeResult, Product, ScrapeCheckpoint, StartScrapePayload } from '@fetcher/shared';
import { delay } from '@fetcher/shared';
import { getSortedStartUrl } from '../content/scrape-page';
import { saveCheckpoint } from './checkpoint';
import { ensureContentScriptReady } from './content-script';
import { productEnricher } from './product-enricher';
import { runPool } from './product-pool';
import { rateLimiter } from './rate-limiter';

interface OrchestratorState {
  sessionId: string;
  payload: StartScrapePayload;
  tabId: number;
  tabUrl: string;
  listingUrl: string;
  currentPage: number;
  maxPages: number;
  totalFound: number;
  totalSaved: number;
  processedProductUrls: Set<string>;
  nextPageUrl: string | null;
  stopped: boolean;
  paused: boolean;
  waitingForLoad: boolean;
}

type LogFn = (message: string, level: 'info' | 'success' | 'warning' | 'error') => void;

type CheckpointFn = (checkpoint: ScrapeCheckpoint) => Promise<void>;

export class ScrapeOrchestrator {
  private state: OrchestratorState | null = null;
  private onCheckpoint: CheckpointFn = saveCheckpoint;

  setCheckpointHandler(handler: CheckpointFn): void {
    this.onCheckpoint = handler;
  }

  async start(
    tabId: number,
    tabUrl: string,
    payload: StartScrapePayload,
    sessionId: string,
    onLog?: LogFn,
  ): Promise<void> {
    this.state = {
      sessionId,
      payload,
      tabId,
      tabUrl,
      listingUrl: tabUrl,
      currentPage: 1,
      maxPages: payload.maxPages ?? (payload.mode === 'entire_website' ? 10 : 1),
      totalFound: 0,
      totalSaved: 0,
      processedProductUrls: new Set(),
      nextPageUrl: null,
      stopped: false,
      paused: false,
      waitingForLoad: false,
    };

    const sortedUrl = getSortedStartUrl(tabUrl, payload.sortFilter);
    if (sortedUrl !== tabUrl) {
      this.state.waitingForLoad = true;
      this.state.listingUrl = sortedUrl;
      onLog?.('Applying sort filter, loading page...', 'info');
      await chrome.tabs.update(tabId, { url: sortedUrl });
      return;
    }

    await this.scrapePage(tabId, onLog);
  }

  async resumeFromCheckpoint(checkpoint: ScrapeCheckpoint, tabId: number, onLog?: LogFn): Promise<void> {
    this.state = {
      sessionId: checkpoint.sessionId,
      payload: checkpoint.payload,
      tabId,
      tabUrl: checkpoint.tabUrl,
      listingUrl: checkpoint.listingUrl,
      currentPage: checkpoint.currentPage,
      maxPages: checkpoint.payload.maxPages ?? (checkpoint.payload.mode === 'entire_website' ? 10 : 1),
      totalFound: checkpoint.totalFound,
      totalSaved: checkpoint.totalSaved,
      processedProductUrls: new Set(checkpoint.processedProductUrls),
      nextPageUrl: checkpoint.nextPageUrl,
      stopped: false,
      paused: false,
      waitingForLoad: false,
    };

    onLog?.(
      `Resuming session at page ${checkpoint.currentPage} (${checkpoint.processedProductUrls.length} products already saved)`,
      'info',
    );

    const ready = await ensureContentScriptReady(tabId);
    if (!ready) {
      throw new Error('Content script not available. Refresh the page, then resume again.');
    }

    const tab = await chrome.tabs.get(tabId);
    const currentUrl = tab.url?.split('?')[0] ?? '';
    const targetUrl = checkpoint.listingUrl.split('?')[0];

    if (currentUrl !== targetUrl) {
      this.state.waitingForLoad = true;
      onLog?.('Navigating back to listing page...', 'info');
      await chrome.tabs.update(tabId, { url: checkpoint.listingUrl });
      return;
    }

    await this.scrapePage(tabId, onLog);
  }

  stop(): void {
    if (this.state) this.state.stopped = true;
    this.state = null;
  }

  pause(): void {
    if (this.state) this.state.paused = true;
  }

  resume(): void {
    if (this.state) this.state.paused = false;
  }

  isRunning(): boolean {
    return this.state !== null && !this.state.stopped;
  }

  async onTabUpdated(tabId: number, status: string): Promise<void> {
    if (!this.state || this.state.tabId !== tabId || status !== 'complete') return;
    if (!this.state.waitingForLoad) return;

    this.state.waitingForLoad = false;
    this.state.listingUrl = (await chrome.tabs.get(tabId)).url ?? this.state.listingUrl;
    await delay(1500);
    await this.scrapePage(tabId);
  }

  private async waitWhilePaused(): Promise<boolean> {
    while (this.state?.paused && !this.state.stopped) {
      await delay(400);
    }
    return !this.state || this.state.stopped;
  }

  private async persistCheckpoint(): Promise<void> {
    if (!this.state) return;
    await this.onCheckpoint({
      sessionId: this.state.sessionId,
      payload: this.state.payload,
      tabUrl: this.state.tabUrl,
      listingUrl: this.state.listingUrl,
      currentPage: this.state.currentPage,
      nextPageUrl: this.state.nextPageUrl,
      totalFound: this.state.totalFound,
      totalSaved: this.state.totalSaved,
      processedProductUrls: Array.from(this.state.processedProductUrls),
      updatedAt: new Date().toISOString(),
    });
  }

  async handlePageScraped(
    result: PageScrapeResult,
    onProduct: (
      product: Product,
      meta?: { adapter?: string; productUrl?: string; durationMs?: number },
    ) => Promise<boolean>,
    onUpdate: (stats: { productsFound: number; productsSaved: number; currentUrl: string }) => void,
    onLog: (message: string, level: 'info' | 'success' | 'warning' | 'error') => void,
    onComplete: () => void,
  ): Promise<void> {
    if (!this.state || this.state.stopped) return;
    if (await this.waitWhilePaused()) return;

    const { products, nextPageUrl, pageNumber, productsOnPage } = result;
    this.state.listingUrl = (await chrome.tabs.get(this.state.tabId)).url ?? this.state.listingUrl;
    this.state.nextPageUrl = nextPageUrl;

    const pending = products.filter(
      (p) => p.productUrl && !this.state!.processedProductUrls.has(p.productUrl),
    );

    this.state.totalFound += productsOnPage;

    onUpdate({
      productsFound: this.state.totalFound,
      productsSaved: this.state.totalSaved,
      currentUrl: this.state.listingUrl,
    });

    onLog(`Page ${pageNumber}: found ${productsOnPage} products (${pending.length} new)`, 'info');

    const enrichProducts =
      this.state.payload.mode === 'current_collection' ||
      this.state.payload.mode === 'entire_website';

    const concurrency = this.state.payload.productConcurrency ?? 2;

    await runPool(
      pending,
      concurrency,
      async (product) => {
        if (!this.state || this.state.stopped) return;
        if (await this.waitWhilePaused()) return;

        let toSave = product;
        const started = Date.now();
        if (enrichProducts && product.productUrl) {
          if (rateLimiter.isBlocked(product.productUrl)) {
            onLog(`Rate limited — skipping ${product.productUrl}`, 'warning');
            return;
          }

          await rateLimiter.wait(product.productUrl);
          onLog(`Fetching all images: ${product.title ?? product.productUrl}`, 'info');
          try {
            toSave = await productEnricher.enrichFromProductPage(product);
            rateLimiter.recordSuccess(product.productUrl);
            const imageCount = toSave.imageUrls?.length ?? toSave.images?.length ?? 0;
            onLog(`Found ${imageCount} images for ${toSave.title ?? 'product'}`, 'info');
          } catch (error) {
            rateLimiter.recordFailure(product.productUrl);
            onLog(
              error instanceof Error ? error.message : 'Enrichment failed',
              'warning',
            );
          }
          await delay(400);
        }

        const saved = await onProduct(toSave, {
          adapter: toSave.platform,
          productUrl: toSave.productUrl,
          durationMs: Date.now() - started,
        });

        if (saved && product.productUrl && this.state) {
          this.state.processedProductUrls.add(product.productUrl);
          this.state.totalSaved++;
          await this.persistCheckpoint();
        }
      },
      () => this.state?.stopped ?? true,
    );

    onUpdate({
      productsFound: this.state.totalFound,
      productsSaved: this.state.totalSaved,
      currentUrl: this.state.listingUrl,
    });

    const shouldPaginate =
      (this.state.payload.mode === 'entire_website' || this.state.maxPages > 1) &&
      nextPageUrl &&
      pageNumber < this.state.maxPages &&
      !this.state.stopped;

    if (shouldPaginate) {
      this.state.currentPage = pageNumber + 1;
      this.state.waitingForLoad = true;
      this.state.nextPageUrl = nextPageUrl;
      await this.persistCheckpoint();
      onLog(`Moving to page ${this.state.currentPage}...`, 'info');
      await chrome.tabs.update(this.state.tabId, { url: nextPageUrl });
      return;
    }

    onLog(
      `Scraping complete: ${this.state.totalSaved} saved from ${this.state.totalFound} found`,
      'success',
    );
    this.state = null;
    onComplete();
  }

  private async scrapePage(tabId: number, onLog?: LogFn): Promise<void> {
    if (!this.state || this.state.stopped) return;

    const ready = await ensureContentScriptReady(tabId);
    if (!ready) {
      throw new Error(
        'Content script not available. Refresh the page, then click New Session and Start again.',
      );
    }

    await chrome.tabs.sendMessage(tabId, {
      type: 'SCRAPE_PAGE',
      payload: {
        ...this.state.payload,
        sessionId: this.state.sessionId,
        pageNumber: this.state.currentPage,
      },
    });

    onLog?.(`Scraping page ${this.state.currentPage}...`, 'info');
    await this.persistCheckpoint();
  }
}

export const scrapeOrchestrator = new ScrapeOrchestrator();
