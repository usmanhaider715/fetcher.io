import type { IAdapter, Product, StartScrapePayload } from '@fetcher/shared';
import { delay, normalizeImageUrl, parsePrice } from '@fetcher/shared';
import { AliExpressAdapter, AmazonAdapter, CjDropshippingAdapter } from '../adapters/platform.adapters';
import { adapterRegistry } from '../adapters/registry';
import { applyScrapeFiltersToUrl, filterProducts, findNextPageUrl } from './filters';

function notifyBackground(type: string, payload?: unknown): void {
  chrome.runtime.sendMessage({ type, payload }).catch(() => {});
}

function findCardForUrl(document: Document, productUrl: string): Element | null {
  const asin = productUrl.match(/\/dp\/([A-Z0-9]{10})/i)?.[1];
  if (asin) {
    const card = document.querySelector(`[data-asin="${asin}"]`);
    if (card) return card;
  }

  const itemId =
    productUrl.match(/\/(?:item|i)\/(\d+)/i)?.[1] ??
    productUrl.match(/\/product\/[^?\s]*?-p-([A-Za-z0-9-]+)\.html/i)?.[1];
  if (itemId) {
    const byHref = document.querySelector(
      `a[href*="/item/${itemId}"], a[href*="/i/${itemId}"], a[href*="productId=${itemId}"], a[href*="-p-${itemId}"], a[href*="/product/"][href*="${itemId}"]`,
    );
    if (byHref) {
      return (
        byHref.closest(
          '[class*="card"], [class*="Card"], [class*="item"], [class*="product"], li, article, div',
        ) ?? byHref
      );
    }
  }

  const anchors = document.querySelectorAll(
    'a[href*="/dp/"], a[href*="/gp/product/"], a[href*="/products/"], a[href*="/itm/"], a[href*="/listing/"], a[href*="/item/"], a[href*="/i/"], a[href*="/product/"], a[href*="-p-"]',
  );
  for (const anchor of anchors) {
    if (anchor instanceof HTMLAnchorElement) {
      const normalized = anchor.href.split('?')[0];
      const target = productUrl.split('?')[0];
      if (normalized === target || (itemId && anchor.href.includes(itemId))) {
        return (
          anchor.closest(
            '[data-asin], .product-card, .product-item, .s-result-item, [data-product-id], [class*="card"], [class*="search-item"], li, article',
          ) ?? anchor
        );
      }
    }
  }
  return null;
}

function extractFromGenericCard(card: Element, productUrl: string, pageUrl: string, platform: Product['platform']): Product {
  const title =
    card.querySelector('h2, h3, h1, [class*="title"], [class*="Title"], a span')?.textContent?.trim() ||
    card.querySelector('img')?.getAttribute('alt')?.trim() ||
    undefined;

  const priceText =
    card.querySelector('[class*="price"], [class*="Price"], .price, .a-price')?.textContent?.trim() ??
    undefined;

  const img = card.querySelector('img');
  const rawSrc =
    img instanceof HTMLImageElement
      ? img.src || img.dataset['src'] || img.getAttribute('data-src') || ''
      : '';
  const imageUrl = rawSrc ? normalizeImageUrl(rawSrc) : undefined;

  return {
    platform: platform ?? 'generic',
    title: title || undefined,
    price: priceText ? parsePrice(priceText) ?? undefined : undefined,
    productUrl,
    website: new URL(pageUrl).hostname,
    scrapedDate: new Date().toISOString(),
    imageUrls: imageUrl ? [imageUrl] : [],
    images: imageUrl ? [{ url: imageUrl, isCover: true, position: 0 }] : [],
    imageCount: imageUrl ? 1 : 0,
  };
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

  if (adapter instanceof AliExpressAdapter && card) {
    return adapter.extractFromCard(card, productUrl, pageUrl);
  }

  if (adapter instanceof CjDropshippingAdapter && card) {
    return adapter.extractFromCard(card, productUrl, pageUrl);
  }

  if (card) {
    // Never call adapter.extract() on a listing page — that steals the page H1
    return extractFromGenericCard(card, productUrl, pageUrl, adapter.platform);
  }

  // Minimal stub — enrichment will fetch the product page later
  return {
    platform: adapter.platform,
    productUrl,
    website: new URL(pageUrl).hostname,
    scrapedDate: new Date().toISOString(),
    title: undefined,
    imageUrls: [],
    images: [],
    imageCount: 0,
  };
}

async function scrollPage(steps = 4): Promise<void> {
  for (let i = 0; i < steps; i++) {
    window.scrollTo({ top: document.body.scrollHeight * ((i + 1) / steps), behavior: 'smooth' });
    await delay(800);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await delay(400);
}

async function waitForProductLinks(adapter: IAdapter, pageUrl: string, attempts = 8): Promise<string[]> {
  for (let i = 0; i < attempts; i++) {
    const urls = adapter.findProducts(document, pageUrl);
    if (urls.length > 0) return urls;
    await scrollPage(2);
    await delay(700);
  }
  return adapter.findProducts(document, pageUrl);
}

export async function scrapeCurrentPage(
  payload: StartScrapePayload & { sessionId: string; pageNumber?: number },
): Promise<void> {
  const pageUrl = window.location.href;
  const adapter = adapterRegistry.detect(document, pageUrl);
  const pageNumber = payload.pageNumber ?? 1;

  try {
    if (payload.mode === 'entire_website' || payload.mode === 'current_collection') {
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
      let productUrls = await waitForProductLinks(adapter, pageUrl);
      let products = productUrls.map((url) =>
        extractListingProduct(adapter, document, pageUrl, url),
      );

      products = filterProducts(products, {
        sortFilter: payload.sortFilter,
        minRating: payload.minRating,
        minReviews: payload.minReviews,
        categoryName: payload.categoryName,
        subcategoryName: payload.subcategoryName,
      });

      products = products.map((p) => ({
        ...p,
        imageUrls: p.imageUrls?.map(normalizeImageUrl).filter(Boolean),
        images: p.images?.map((img) => ({ ...img, url: normalizeImageUrl(img.url) })),
        category: payload.categoryName ?? p.category,
        subcategory: payload.subcategoryName ?? p.subcategory,
      }));

      if ((payload.subcategoryName || payload.categoryName) && products.length === 0) {
        notifyBackground('SCRAPE_LOG', {
          id: Date.now().toString(),
          level: 'warning',
          message: `No products matched "${payload.subcategoryName ?? payload.categoryName}" on this page — select the subcategory (not only the parent), then Start again.`,
          timestamp: new Date().toISOString(),
        });
      }

      if (productUrls.length === 0) {
        notifyBackground('SCRAPE_LOG', {
          id: Date.now().toString(),
          level: 'warning',
          message: `No product links found on ${adapter.name} (${adapter.platform}). Scroll the page or try Current Collection after results load.`,
          timestamp: new Date().toISOString(),
        });
      }

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

export function getSortedStartUrl(
  url: string,
  sortFilter?: StartScrapePayload['sortFilter'],
  categoryName?: string,
  subcategoryName?: string,
): string {
  return applyScrapeFiltersToUrl(url, { sortFilter, categoryName, subcategoryName });
}
