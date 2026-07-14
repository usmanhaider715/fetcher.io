import type { Product, ScrapeCheckpoint, StartScrapePayload } from '@fetcher/shared';
import { delay } from '@fetcher/shared';
import { saveCheckpoint } from './checkpoint';
import { productEnricher } from './product-enricher';
import { rateLimiter } from './rate-limiter';

type LogFn = (message: string, level: 'info' | 'success' | 'warning' | 'error') => void;

interface UrlQueueState {
  sessionId: string;
  payload: StartScrapePayload;
  urls: string[];
  index: number;
  totalSaved: number;
  processedUrls: Set<string>;
  stopped: boolean;
  paused: boolean;
}

export class UrlQueueOrchestrator {
  private state: UrlQueueState | null = null;

  private async waitWhilePaused(): Promise<boolean> {
    while (this.state?.paused && !this.state.stopped) {
      await delay(400);
    }
    return !this.state || this.state.stopped;
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

  async start(
    urls: string[],
    payload: StartScrapePayload,
    sessionId: string,
    onProduct: (product: Product, meta?: { durationMs?: number }) => Promise<boolean>,
    onUpdate: (stats: { productsFound: number; productsSaved: number; currentUrl?: string }) => void,
    onLog: LogFn,
  ): Promise<void> {
    this.state = {
      sessionId,
      payload,
      urls,
      index: 0,
      totalSaved: 0,
      processedUrls: new Set(),
      stopped: false,
      paused: false,
    };

    onLog(`URL queue: ${urls.length} products to scrape`, 'info');
    onUpdate({ productsFound: urls.length, productsSaved: 0, currentUrl: urls[0] });

    for (let i = 0; i < urls.length; i++) {
      if (!this.state || this.state.stopped) break;
      if (await this.waitWhilePaused()) break;

      const url = urls[i]!;
      if (this.state.processedUrls.has(url)) continue;

      this.state.index = i;

      if (rateLimiter.isBlocked(url)) {
        onLog(`Stopped: domain rate-limited`, 'error');
        break;
      }

      try {
        await rateLimiter.wait(url);
        const started = Date.now();
        onLog(`[${i + 1}/${urls.length}] Scraping ${url}`, 'info');

        const product = await productEnricher.enrichFromProductPage({ productUrl: url } as Product);
        product.productUrl = url;

        const saved = await onProduct(product, { durationMs: Date.now() - started });
        rateLimiter.recordSuccess(url);

        if (saved) {
          this.state.totalSaved++;
          this.state.processedUrls.add(url);
        }

        onUpdate({
          productsFound: urls.length,
          productsSaved: this.state.totalSaved,
          currentUrl: url,
        });

        await saveCheckpoint({
          sessionId,
          payload: { ...payload, urls },
          tabUrl: url,
          listingUrl: url,
          currentPage: i + 1,
          nextPageUrl: urls[i + 1] ?? null,
          totalFound: urls.length,
          totalSaved: this.state.totalSaved,
          processedProductUrls: Array.from(this.state.processedUrls),
          updatedAt: new Date().toISOString(),
        });

        await delay(500);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'URL scrape failed';
        onLog(msg, 'error');
        rateLimiter.recordFailure(url);
      }
    }

    onLog(`URL queue complete: ${this.state?.totalSaved ?? 0} saved`, 'success');
    this.state = null;
  }

  async resumeFromCheckpoint(
    checkpoint: ScrapeCheckpoint,
    onProduct: (product: Product, meta?: { durationMs?: number }) => Promise<boolean>,
    onUpdate: (stats: { productsFound: number; productsSaved: number; currentUrl?: string }) => void,
    onLog: LogFn,
  ): Promise<void> {
    const allUrls = checkpoint.payload.urls ?? [];
    const remaining = allUrls.filter((u) => !checkpoint.processedProductUrls.includes(u));

    if (remaining.length === 0) {
      onLog('All URLs already processed', 'info');
      return;
    }

    this.state = {
      sessionId: checkpoint.sessionId,
      payload: checkpoint.payload,
      urls: allUrls,
      index: checkpoint.currentPage - 1,
      totalSaved: checkpoint.totalSaved,
      processedUrls: new Set(checkpoint.processedProductUrls),
      stopped: false,
      paused: false,
    };

    onLog(`Resuming URL queue: ${remaining.length} remaining`, 'info');
    onUpdate({
      productsFound: allUrls.length,
      productsSaved: checkpoint.totalSaved,
      currentUrl: remaining[0],
    });

    for (let i = 0; i < allUrls.length; i++) {
      if (!this.state || this.state.stopped) break;
      if (await this.waitWhilePaused()) break;

      const url = allUrls[i]!;
      if (this.state.processedUrls.has(url)) continue;

      this.state.index = i;

      if (rateLimiter.isBlocked(url)) {
        onLog('Stopped: domain rate-limited', 'error');
        break;
      }

      try {
        await rateLimiter.wait(url);
        const started = Date.now();
        onLog(`[${i + 1}/${allUrls.length}] Scraping ${url}`, 'info');

        const product = await productEnricher.enrichFromProductPage({ productUrl: url } as Product);
        product.productUrl = url;

        const saved = await onProduct(product, { durationMs: Date.now() - started });
        rateLimiter.recordSuccess(url);

        if (saved) {
          this.state.totalSaved++;
          this.state.processedUrls.add(url);
        }

        onUpdate({
          productsFound: allUrls.length,
          productsSaved: this.state.totalSaved,
          currentUrl: url,
        });

        await saveCheckpoint({
          sessionId: checkpoint.sessionId,
          payload: { ...checkpoint.payload, urls: allUrls },
          tabUrl: url,
          listingUrl: url,
          currentPage: i + 1,
          nextPageUrl: allUrls[i + 1] ?? null,
          totalFound: allUrls.length,
          totalSaved: this.state.totalSaved,
          processedProductUrls: Array.from(this.state.processedUrls),
          updatedAt: new Date().toISOString(),
        });

        await delay(500);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'URL scrape failed';
        onLog(msg, 'error');
        rateLimiter.recordFailure(url);
      }
    }

    onLog(`URL queue complete: ${this.state?.totalSaved ?? 0} saved`, 'success');
    this.state = null;
  }
}

export const urlQueueOrchestrator = new UrlQueueOrchestrator();
