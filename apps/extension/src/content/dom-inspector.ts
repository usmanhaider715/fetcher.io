import type { StartScrapePayload } from '@fetcher/shared';
import { extractJsonLdProducts, getMetaContent } from '@fetcher/shared';

export class DomInspector {
  private isScrapingActive = false;
  private observer: MutationObserver | null = null;

  startScrape(_payload: StartScrapePayload): void {
    if (this.isScrapingActive) return;
    this.isScrapingActive = true;

    const productCount = this.countProducts();
    this.notifyProgress({
      productsFound: productCount,
      message: `Found ${productCount} product(s) on page`,
    });

    this.setupLazyImageObserver();
    this.setupInfiniteScrollObserver();
  }

  stopScrape(): void {
    this.isScrapingActive = false;
    this.observer?.disconnect();
    this.observer = null;
  }

  countProducts(): number {
    const jsonLdProducts = extractJsonLdProducts(document);
    if (jsonLdProducts.length > 0) return jsonLdProducts.length;

    const productCards = this.findProductCards();
    if (productCards.length > 0) return productCards.length;

    const isProductPage = this.isSingleProductPage();
    return isProductPage ? 1 : 0;
  }

  private isSingleProductPage(): boolean {
    const hasJsonLd = extractJsonLdProducts(document).length > 0;
    const hasOgProduct = getMetaContent(document, 'og:type') === 'product';
    const hasProductSchema = !!document.querySelector('[itemtype*="Product"]');

    return hasJsonLd || hasOgProduct || hasProductSchema;
  }

  private findProductCards(): Element[] {
    const selectors = [
      '[data-product-id]',
      '.product-card',
      '.product-item',
      '.grid-product',
      '.woocommerce-LoopProduct-link',
      'article.product',
      '[class*="product-card"]',
      '[class*="ProductCard"]',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    }

    return [];
  }

  private setupLazyImageObserver(): void {
    const images = document.querySelectorAll('img[data-src], img[loading="lazy"]');
    images.forEach((img) => {
      const dataSrc = img.getAttribute('data-src');
      if (dataSrc && img instanceof HTMLImageElement && !img.src) {
        img.src = dataSrc;
      }
    });
  }

  private setupInfiniteScrollObserver(): void {
    this.observer = new MutationObserver(() => {
      if (!this.isScrapingActive) return;
      const count = this.countProducts();
      this.notifyProgress({ productsFound: count });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private notifyProgress(data: { productsFound?: number; message?: string }): void {
    chrome.runtime.sendMessage({
      type: 'SCRAPE_PROGRESS',
      payload: data,
    }).catch(() => {});
  }

  extractPageMetadata(): Record<string, unknown> {
    const jsonLd = extractJsonLdProducts(document);

    return {
      url: window.location.href,
      title: document.title,
      metaTitle: getMetaContent(document, 'og:title') ?? document.title,
      metaDescription:
        getMetaContent(document, 'og:description') ??
        getMetaContent(document, 'description'),
      canonicalUrl:
        document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ??
        window.location.href,
      jsonLdProductCount: jsonLd.length,
      productCardCount: this.findProductCards().length,
    };
  }
}
