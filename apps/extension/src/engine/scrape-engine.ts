import type { Product, ScrapingMode, StartScrapePayload } from '@fetcher/shared';
import { delay, randomDelay } from '@fetcher/shared';
import { adapterRegistry } from '../adapters/registry';
import { backendApi } from '../lib/backend-api';

export interface ScrapeEngineOptions {
  delayMs: number;
  randomizeDelay: boolean;
  onProgress?: (data: { productsFound: number; productsSaved: number; currentUrl?: string }) => void;
  onProduct?: (product: Product) => void;
  onError?: (error: string, url?: string) => void;
  onLog?: (message: string, level: 'info' | 'success' | 'warning' | 'error') => void;
}

export class ScrapeEngine {
  private aborted = false;
  private paused = false;

  abort(): void {
    this.aborted = true;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  private async wait(options: ScrapeEngineOptions): Promise<void> {
    if (this.aborted) throw new Error('Scrape aborted');
    while (this.paused) {
      await delay(500);
      if (this.aborted) throw new Error('Scrape aborted');
    }
    const ms = options.randomizeDelay
      ? randomDelay(options.delayMs)
      : options.delayMs;
    await delay(ms);
  }

  async scrapeCurrentProduct(
    document: Document,
    url: string,
    options: ScrapeEngineOptions,
    sessionId: string,
    categoryId?: string,
    subcategoryId?: string,
  ): Promise<Product | null> {
    const adapter = adapterRegistry.detect(document, url);
    options.onLog?.(`Using ${adapter.name} adapter`, 'info');

    const product = adapter.extract(document, url);
    options.onProduct?.(product);
    options.onProgress?.({ productsFound: 1, productsSaved: 0, currentUrl: url });

    try {
      await backendApi.saveProduct(product, sessionId, categoryId, subcategoryId);
      options.onProgress?.({ productsFound: 1, productsSaved: 1, currentUrl: url });
      options.onLog?.(`Saved: ${product.title}`, 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Save failed';
      options.onError?.(msg, url);
    }

    return product;
  }

  async scrapeCollection(
    document: Document,
    url: string,
    options: ScrapeEngineOptions,
    sessionId: string,
    categoryId?: string,
    subcategoryId?: string,
  ): Promise<Product[]> {
    const adapter = adapterRegistry.detect(document, url);
    const productUrls = adapter.findProducts(document, url);

    options.onLog?.(`Found ${productUrls.length} product URLs`, 'info');
    options.onProgress?.({ productsFound: productUrls.length, productsSaved: 0 });

    const products: Product[] = [];
    let saved = 0;

    for (const productUrl of productUrls) {
      if (this.aborted) break;
      await this.wait(options);

      try {
        const product = adapter.extract(document, productUrl);
        product.productUrl = productUrl;
        products.push(product);
        options.onProduct?.(product);

        await backendApi.saveProduct(product, sessionId, categoryId, subcategoryId);
        saved++;
        options.onProgress?.({
          productsFound: productUrls.length,
          productsSaved: saved,
          currentUrl: productUrl,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Scrape failed';
        options.onError?.(msg, productUrl);
      }
    }

    return products;
  }

  async execute(
    mode: ScrapingMode,
    document: Document,
    url: string,
    payload: StartScrapePayload,
    sessionId: string,
    options: ScrapeEngineOptions,
  ): Promise<{ products: Product[]; saved: number }> {
    this.aborted = false;
    this.paused = false;

    options.onLog?.(`Starting scrape mode: ${mode}`, 'info');

    switch (mode) {
      case 'current_product': {
        const product = await this.scrapeCurrentProduct(
          document,
          url,
          options,
          sessionId,
          payload.categoryId,
          payload.subcategoryId,
        );
        return { products: product ? [product] : [], saved: product ? 1 : 0 };
      }

      case 'current_collection': {
        const products = await this.scrapeCollection(
          document,
          url,
          options,
          sessionId,
          payload.categoryId,
          payload.subcategoryId,
        );
        return { products, saved: products.length };
      }

      case 'selected_urls':
      case 'import_csv': {
        const urls = payload.urls ?? [];
        const products: Product[] = [];
        let saved = 0;

        for (const productUrl of urls) {
          if (this.aborted) break;
          await this.wait(options);

          const adapter = adapterRegistry.detect(document, productUrl);
          try {
            const product = adapter.extract(document, productUrl);
            product.productUrl = productUrl;
            products.push(product);
            await backendApi.saveProduct(product, sessionId, payload.categoryId, payload.subcategoryId);
            saved++;
            options.onProgress?.({ productsFound: urls.length, productsSaved: saved, currentUrl: productUrl });
          } catch (error) {
            options.onError?.(error instanceof Error ? error.message : 'Failed', productUrl);
          }
        }
        return { products, saved };
      }

      default:
        options.onLog?.(`Mode ${mode} queued for processing`, 'warning');
        return { products: [], saved: 0 };
    }
  }
}

export const scrapeEngine = new ScrapeEngine();
