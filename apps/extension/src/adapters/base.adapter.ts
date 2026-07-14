import type { IAdapter, ProductImage, ProductVariant, SelectorRule } from '@fetcher/shared';
import type { Platform, Product } from '@fetcher/shared';
import { getDomain, getMetaContent, parsePrice } from '@fetcher/shared';
import { productDetectionPipeline } from '@fetcher/parsers';
import { SelectorEngine } from '@fetcher/selectors';
import { getDomainSelectorMap } from '../lib/domain-selectors';

const selectorEngine = new SelectorEngine();

export abstract class BaseAdapter implements IAdapter {
  abstract readonly platform: Platform;
  abstract readonly name: string;
  abstract readonly domains: string[];

  abstract detect(document: Document, url: string): boolean;

  findProducts(document: Document, url: string): string[] {
    const custom = getDomainSelectorMap(url);
    if (custom?.productCard) {
      const cards = selectorEngine.queryElements(document, custom.productCard);
      const links = new Set<string>();
      cards.forEach((card) => {
        const anchor = card.querySelector('a[href]');
        if (anchor instanceof HTMLAnchorElement && anchor.href) {
          links.add(anchor.href.split('?')[0] ?? anchor.href);
        }
      });
      if (links.size > 0) return Array.from(links);
    }

    const links = new Set<string>();
    document
      .querySelectorAll(
        'a[href*="/product"], a[href*="/products/"], .product-card a, .product-item a, [data-product-id] a',
      )
      .forEach((a) => {
        if (a instanceof HTMLAnchorElement && a.href) links.add(a.href);
      });
    return Array.from(links);
  }

  findProduct(document: Document, url: string): Product | null {
    if (!this.detect(document, url)) return null;
    return this.extract(document, url);
  }

  extract(document: Document, url: string): Product {
    const detected = productDetectionPipeline.detect(document, url);
    const product: Product = detected ?? { productUrl: url, website: getDomain(url) };

    product.platform = this.platform;
    product.productUrl = url;
    product.website = getDomain(url);
    product.scrapedDate = new Date().toISOString();

    if (!product.title) product.title = this.parseTitle(document);
    if (!product.price) product.price = this.parsePriceValue(document) ?? undefined;
    if (!product.description) product.description = this.parseDescription(document, product);
    if (!product.imageUrls?.length) {
      const images = this.parseImages(document, product);
      product.images = images;
      product.imageUrls = images.map((i) => i.url);
      product.imageCount = images.length;
    }

    product.specifications = this.parseSpecifications(document, product);
    product.variants = this.parseVariants(document, product);
    this.applyCustomSelectors(document, url, product);

    return product;
  }

  protected applyCustomSelectors(document: Document, url: string, product: Product): void {
    const selectors = getDomainSelectorMap(url);
    if (!selectors) return;

    const applyText = (rule: SelectorRule | undefined, field: keyof Product) => {
      if (!rule) return;
      const value = selectorEngine.query(document, rule);
      if (value) (product as Record<string, unknown>)[field] = value;
    };

    applyText(selectors.title, 'title');
    applyText(selectors.description, 'description');
    applyText(selectors.sku, 'sku');
    applyText(selectors.brand, 'brand');

    if (selectors.price) {
      const priceText = selectorEngine.query(document, selectors.price);
      if (priceText) product.price = parsePrice(priceText) ?? product.price;
    }

    if (selectors.image) {
      const imageUrl = selectorEngine.query(document, selectors.image);
      if (imageUrl) {
        product.imageUrls = [imageUrl];
        product.images = [{ url: imageUrl, isCover: true, position: 0 }];
        product.imageCount = 1;
      }
    }
  }

  protected parseTitle(document: Document): string | undefined {
    const h1 = document.querySelector('h1');
    return h1?.textContent?.trim() ?? getMetaContent(document, 'og:title') ?? undefined;
  }

  protected parsePriceValue(document: Document): number | null {
    const selectors = [
      '[itemprop="price"]',
      '.price',
      '.product-price',
      '[data-price]',
      '.current-price',
      '.sale-price',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const content = el.getAttribute('content') ?? el.textContent;
        if (content) {
          const price = parsePrice(content);
          if (price !== null) return price;
        }
      }
    }
    return null;
  }

  parseImages(document: Document, _product: Product): ProductImage[] {
    const urls = new Set<string>();

    document.querySelectorAll('img[src], img[data-src]').forEach((img) => {
      if (!(img instanceof HTMLImageElement)) return;
      const src = img.src || img.dataset['src'];
      if (src && !src.includes('data:image') && src.startsWith('http')) {
        urls.add(src);
      }
    });

    const ogImage = getMetaContent(document, 'og:image');
    if (ogImage) urls.add(ogImage);

    return Array.from(urls).map((url, i) => ({
      url,
      position: i,
      isCover: i === 0,
    }));
  }

  parseVariants(document: Document, _product: Product): ProductVariant[] {
    const variants: ProductVariant[] = [];
    document.querySelectorAll('select option, [data-variant-id]').forEach((el) => {
      const text = el.textContent?.trim();
      if (text && text !== 'Select' && text.length < 100) {
        variants.push({ title: text });
      }
    });
    return variants.slice(0, 50);
  }

  parseDescription(document: Document, _product: Product): string {
    const selectors = [
      '[itemprop="description"]',
      '.product-description',
      '#product-description',
      '.description',
      '[class*="description"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    return getMetaContent(document, 'og:description') ?? '';
  }

  parseSpecifications(document: Document, _product: Product): Record<string, string> {
    const specs: Record<string, string> = {};
    document.querySelectorAll('table tr, dl dt').forEach((el) => {
      if (el.tagName === 'TR') {
        const cells = el.querySelectorAll('td, th');
        if (cells.length >= 2) {
          const key = cells[0]?.textContent?.trim();
          const val = cells[1]?.textContent?.trim();
          if (key && val) specs[key] = val;
        }
      }
    });
    return specs;
  }
}
