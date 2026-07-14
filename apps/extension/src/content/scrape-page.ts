import type { IAdapter, Product, StartScrapePayload } from '@fetcher/shared';
import { delay, normalizeImageUrl } from '@fetcher/shared';
import { AmazonAdapter } from '../adapters/platform.adapters';
import { adapterRegistry } from '../adapters/registry';
import { applySortToUrl, filterProducts, findNextPageUrl } from './filters';

function notifyBackground(type: string, payload?: unknown): void {
  chrome.runtime.sendMessage({ type, payload }).catch(() => {});
}

function findCardForUrl(document: Document, productUrl: string): Element | null {
  const asin = productUrl.match(/\/dp\/([A-Z0-9]{10})/i)?.[1];
  if (asin) {
    const card = document.querySelector(`[data-asin="${asin}"]`);
    if (card) return card;
  }

  const anchors = document.querySelectorAll(
    'a[href*="/dp/"], a[href*="/gp/product/"], a[href*="/products/"], a[href*="/itm/"], a[href*="/listing/"]',
  );
  for (const anchor of anchors) {
    if (anchor instanceof HTMLAnchorElement) {
      const normalized = anchor.href.split('?')[0];
      const target = productUrl.split('?')[0];
      if (normalized === target) {
        return (
          anchor.closest('[data-asin], .product-card, .product-item, .s-result-item, [data-product-id]') ??
          anchor
        );
      }
    }
  }
  return null;
}

function extractListingProduct(
  adapter: IAdapter,
  document: Document,
  pageUrl: string,
  productUrl: string,
): Product {
  const card = findCardForUrl(document, productUrl);

  if (adapter instanceof AmazonAdapter && card) {
    return adapter.extractFromCard(card, productUrl, pageUrl);
  }

  if (card) {
    const title = card.querySelector('h2, h3, .title, [class*="title"], a span')?.textContent?.trim();
    const priceText = card.querySelector('.price, .a-price, [class*="price"]')?.textContent?.trim();
    const img = card.querySelector('img');

    const product = adapter.extract(document, productUrl);
    if (title) product.title = title;
    if (priceText) {
      const parsed = parseFloat(priceText.replace(/[^\d.]/g, ''));
      if (!Number.isNaN(parsed)) product.price = parsed;
    }
    if (img instanceof HTMLImageElement) {
      const src = normalizeImageUrl(img.src || img.dataset['src'] || '');
      if (src) {
        product.imageUrls = [src];
        product.images = [{ url: src, isCover: true }];
        product.imageCount = 1;
      }
    }
    product.productUrl = productUrl;
    return product;
  }

  return adapter.extract(document, productUrl);
}

async function scrollPage(steps = 3): Promise<void> {
  for (let i = 0; i < steps; i++) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    await delay(1000);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export async function scrapeCurrentPage(
  payload: StartScrapePayload & { sessionId: string; pageNumber?: number },
): Promise<void> {
  const pageUrl = window.location.href;
  const adapter = adapterRegistry.detect(document, pageUrl);
  const pageNumber = payload.pageNumber ?? 1;

  try {
    if (payload.mode === 'entire_website') {
      await scrollPage(4);
    }

    if (payload.mode === 'current_product') {
      const product = adapter.extract(document, pageUrl);
      if (product.imageUrls?.length) {
        product.imageUrls = product.imageUrls.map(normalizeImageUrl).filter(Boolean);
      }
      notifyBackground('PAGE_SCRAPED', {
        products: [product],
        nextPageUrl: null,
        pageNumber,
        productsOnPage: 1,
      });
      return;
    }

    const isListingMode =
      payload.mode === 'current_collection' || payload.mode === 'entire_website';

    if (isListingMode) {
      let productUrls = adapter.findProducts(document, pageUrl);
      let products = productUrls.map((url) =>
        extractListingProduct(adapter, document, pageUrl, url),
      );

      products = filterProducts(products, {
        sortFilter: payload.sortFilter,
        minRating: payload.minRating,
        minReviews: payload.minReviews,
      });

      products = products.map((p) => ({
        ...p,
        imageUrls: p.imageUrls?.map(normalizeImageUrl).filter(Boolean),
        images: p.images?.map((img) => ({ ...img, url: normalizeImageUrl(img.url) })),
      }));

      const paginate =
        payload.mode === 'entire_website' || (payload.maxPages != null && payload.maxPages > 1);
      const nextPageUrl = paginate ? findNextPageUrl(document, pageUrl) : null;

      notifyBackground('PAGE_SCRAPED', {
        products,
        nextPageUrl,
        pageNumber,
        productsOnPage: products.length,
      });
      return;
    }

    if (payload.urls?.length) {
      const products = payload.urls.map((url) => {
        const product = adapter.extract(document, url);
        product.productUrl = url;
        return product;
      });

      notifyBackground('PAGE_SCRAPED', {
        products,
        nextPageUrl: null,
        pageNumber,
        productsOnPage: products.length,
      });
    }
  } catch (error) {
    notifyBackground('SCRAPE_LOG', {
      id: Date.now().toString(),
      level: 'error',
      message: error instanceof Error ? error.message : 'Page scrape failed',
      timestamp: new Date().toISOString(),
    });
  }
}

export function getSortedStartUrl(url: string, sortFilter?: StartScrapePayload['sortFilter']): string {
  if (!sortFilter || sortFilter === 'default') return url;
  return applySortToUrl(url, sortFilter);
}
