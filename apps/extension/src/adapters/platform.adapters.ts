import type { Product, Platform, ProductImage } from '@fetcher/shared';
import { getDomain, normalizeImageUrl, parsePrice } from '@fetcher/shared';
import { findNextPageUrl } from '../content/filters';
import { BaseAdapter } from './base.adapter';

function normalizeAmazonUrl(url: string, href: string): string | null {
  try {
    const base = new URL(url).origin;
    const full = href.startsWith('http') ? href : new URL(href, base).href;
    const asinMatch = full.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (asinMatch?.[1]) {
      return `${base}/dp/${asinMatch[1]}`;
    }
  } catch {
    // Invalid URL
  }
  return null;
}

export class GenericAdapter extends BaseAdapter {
  readonly platform: Platform = 'generic';
  readonly name = 'Generic Adapter';
  readonly domains = ['*'];

  detect(_document: Document, _url: string): boolean {
    return true;
  }

  override findProducts(document: Document, url: string): string[] {
    const fromBase = super.findProducts(document, url);
    if (fromBase.length > 0) return fromBase;

    const links = new Set<string>();
    const patterns = [
      'a[href*="/product"]',
      'a[href*="/products/"]',
      'a[href*="/item/"]',
      'a[href*="/p/"]',
      'a[href*="/dp/"]',
      'a[href*="/itm/"]',
      'a[href*="/listing/"]',
      'a[href*="/goods/"]',
      '[data-product-id] a[href]',
      '.product a[href]',
      '.product-card a[href]',
      '.product-item a[href]',
    ];
    document.querySelectorAll(patterns.join(', ')).forEach((a) => {
      if (!(a instanceof HTMLAnchorElement) || !a.href) return;
      if (a.href.startsWith('javascript:')) return;
      if (/\/(cart|checkout|account|login|help|policy)/i.test(a.href)) return;
      links.add(a.href.split('?')[0] ?? a.href);
    });
    return Array.from(links);
  }
}

export class ShopifyAdapter extends BaseAdapter {
  readonly platform: Platform = 'shopify';
  readonly name = 'Shopify';
  readonly domains = ['myshopify.com', 'shopify.com'];

  detect(document: Document, url: string): boolean {
    if (
      /aliexpress\.|amazon\.|ebay\.|etsy\.|temu\.|alibaba\.|cjdropshipping\.|walmart\.|spocket\./i.test(
        url,
      )
    ) {
      return false;
    }
    const html = document.documentElement.outerHTML;
    return (
      /cdn\.shopify\.com/i.test(html) ||
      /Shopify\.theme/i.test(html) ||
      (url.includes('/products/') && /shopify/i.test(html))
    );
  }

  override findProducts(document: Document, _url: string): string[] {
    const links = new Set<string>();
    document.querySelectorAll('a[href*="/products/"]').forEach((a) => {
      if (a instanceof HTMLAnchorElement) links.add(a.href.split('?')[0] ?? a.href);
    });
    return Array.from(links);
  }

  override parseImages(document: Document, product: Product) {
    const images = super.parseImages(document, product);
    document.querySelectorAll('[data-product-image], .product__media img').forEach((img) => {
      if (img instanceof HTMLImageElement && img.src) {
        if (!images.find((i) => i.url === img.src)) {
          images.push({ url: img.src, position: images.length });
        }
      }
    });
    return images;
  }
}

export class WooCommerceAdapter extends BaseAdapter {
  readonly platform: Platform = 'woocommerce';
  readonly name = 'WooCommerce';
  readonly domains = [];

  detect(document: Document, url: string): boolean {
    // Marketplaces often mention WooCommerce in footer/marketing copy
    if (
      /aliexpress\.|amazon\.|ebay\.|etsy\.|temu\.|alibaba\.|cjdropshipping\.|walmart\.|spocket\./i.test(
        url,
      )
    ) {
      return false;
    }
    return /woocommerce|wc-product|wp-content\/plugins\/woocommerce/i.test(
      document.documentElement.outerHTML,
    );
  }

  override findProducts(document: Document, _url: string): string[] {
    const links = new Set<string>();
    document
      .querySelectorAll('.woocommerce-LoopProduct-link, .product a.woocommerce-loop-product__link')
      .forEach((a) => {
        if (a instanceof HTMLAnchorElement) links.add(a.href);
      });
    return Array.from(links);
  }
}

function getAmazonImageId(url: string): string {
  const match = url.match(/\/images\/I\/([^./?]+)/);
  return match?.[1] ?? url;
}

function estimateAmazonImageSize(url: string): number {
  const patterns = [/_AC_SL(\d+)/, /_SL(\d+)/, /_AC_UL(\d+)/, /_SX(\d+)/, /_SY(\d+)/];
  let max = 0;
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) max = Math.max(max, parseInt(match[1], 10));
  }
  return max || 500;
}

function unescapeAmazonScriptUrl(raw: string): string {
  return raw.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
}

function addBestAmazonUrl(urlsById: Map<string, string>, url: string): void {
  const normalized = normalizeImageUrl(url);
  if (!normalized.includes('media-amazon.com/images/I/')) return;
  const id = getAmazonImageId(normalized);
  const existing = urlsById.get(id);
  if (!existing || estimateAmazonImageSize(normalized) > estimateAmazonImageSize(existing)) {
    urlsById.set(id, normalized);
  }
}

function extractAmazonGalleryUrls(document: Document): string[] {
  const urlsById = new Map<string, string>();

  document.querySelectorAll('script').forEach((script) => {
    const text = script.textContent ?? '';
    const patterns = [
      /"hiRes"\s*:\s*"(https?:\\?\/\\?\/[^"]+)"/g,
      /"large"\s*:\s*"(https?:\\?\/\\?\/[^"]+)"/g,
      /"mainUrl"\s*:\s*"(https?:\\?\/\\?\/[^"]+)"/g,
    ];
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        if (match[1]) addBestAmazonUrl(urlsById, unescapeAmazonScriptUrl(match[1]));
      }
    }
  });

  document
    .querySelectorAll(
      '#altImages img, #imageBlock img, #imgTagWrapperId img, #landingImage, .imgTagWrapper img',
    )
    .forEach((img) => {
      if (!(img instanceof HTMLImageElement)) return;

      const dynamic = img.getAttribute('data-a-dynamic-image');
      if (dynamic) {
        try {
          const parsed = JSON.parse(dynamic) as Record<string, unknown>;
          for (const url of Object.keys(parsed)) {
            addBestAmazonUrl(urlsById, url);
          }
        } catch {
          // ignore
        }
      }

      const src =
        img.getAttribute('data-old-hires') || img.dataset['src'] || img.src;
      if (src && src.includes('http')) {
        addBestAmazonUrl(urlsById, src);
      }
    });

  return Array.from(urlsById.values());
}

export class AmazonAdapter extends BaseAdapter {
  readonly platform: Platform = 'amazon';
  readonly name = 'Amazon';
  readonly domains = ['amazon.com', 'amazon.co.uk', 'amazon.de'];

  detect(_document: Document, url: string): boolean {
    return /amazon\./i.test(url);
  }

  override findProducts(document: Document, url: string): string[] {
    const urls = new Set<string>();

    document.querySelectorAll('[data-asin]').forEach((card) => {
      const asin = card.getAttribute('data-asin');
      if (!asin || asin.length < 10) return;
      // Skip empty / non-product result widgets
      if (card.getAttribute('data-component-type') === 's-empty-result') return;
      if (card.querySelector('.s-result-item') === null && !card.classList.contains('s-result-item') && !card.querySelector('h2')) {
        // still allow cards with h2 or s-result-item class
      }
      const titleHint =
        card.querySelector('h2')?.textContent?.trim() ??
        card.querySelector('img')?.getAttribute('alt')?.trim() ??
        '';
      if (/\bresults for\b/i.test(titleHint) || /^\d+[\s\-–]+\d+\s+of\b/i.test(titleHint)) return;
      const normalized = normalizeAmazonUrl(url, `/dp/${asin}`);
      if (normalized) urls.add(normalized);
    });

    document
      .querySelectorAll('a[href*="/dp/"], a[href*="/gp/product/"]')
      .forEach((anchor) => {
        if (anchor instanceof HTMLAnchorElement) {
          const normalized = normalizeAmazonUrl(url, anchor.href);
          if (normalized) urls.add(normalized);
        }
      });

    return Array.from(urls);
  }

  extractFromCard(card: Element, productUrl: string, pageUrl: string): Product {
    const titleEl = card.querySelector(
      'h2 a span.a-text-normal, h2 a span, h2 span.a-text-normal, .a-size-base-plus, .a-size-medium.a-color-base.a-text-normal',
    );
    let title = titleEl?.textContent?.trim() ?? card.querySelector('img')?.getAttribute('alt')?.trim();

    // Reject Amazon UI chrome mistaken as product titles
    if (
      title &&
      (/results for/i.test(title) ||
        /^\d+[\s\-–]+\d+\s+of\b/i.test(title) ||
        /^sort by:/i.test(title) ||
        title.length > 280)
    ) {
      title = card.querySelector('img')?.getAttribute('alt')?.trim() ?? undefined;
    }

    const priceText =
      card.querySelector('.a-price .a-offscreen')?.textContent ??
      card.querySelector('.a-price-whole')?.textContent;

    const img =
      card.querySelector('img.s-image, img[src*="images/I"], img[data-image-latency]') ??
      card.querySelector('img');

    const rawImage =
      img instanceof HTMLImageElement
        ? img.src || img.dataset['src'] || img.getAttribute('data-a-dynamic-image')
        : undefined;

    let imageUrl: string | undefined;
    if (rawImage?.startsWith('{')) {
      try {
        const dynamic = JSON.parse(rawImage) as Record<string, unknown>;
        imageUrl = normalizeImageUrl(Object.keys(dynamic)[0] ?? '');
      } catch {
        imageUrl = undefined;
      }
    } else {
      imageUrl = rawImage ? normalizeImageUrl(rawImage) : undefined;
    }

    const ratingText = card.querySelector('.a-icon-alt, [aria-label*="stars"]')?.textContent;
    const ratingMatch = ratingText?.match(/([\d.]+)\s*out of/i);
    const rating = ratingMatch?.[1] ? parseFloat(ratingMatch[1]) : undefined;

    const reviewText =
      card.querySelector('a[href*="customerReviews"] span, .a-size-base.s-underline-text')?.textContent ??
      card.querySelector('[aria-label*="ratings"]')?.getAttribute('aria-label');
    const reviewMatch = reviewText?.replace(/,/g, '').match(/(\d+)/);
    const reviewCount = reviewMatch?.[1] ? parseInt(reviewMatch[1], 10) : undefined;

    const asin = card.getAttribute('data-asin') ?? productUrl.match(/\/dp\/([A-Z0-9]{10})/i)?.[1];

    return {
      platform: this.platform,
      title: title || undefined,
      price: priceText ? (parsePrice(priceText) ?? undefined) : undefined,
      rating,
      reviewCount,
      sku: asin ?? undefined,
      productUrl,
      website: getDomain(pageUrl),
      imageUrls: imageUrl ? [imageUrl] : [],
      images: imageUrl ? [{ url: imageUrl, isCover: true }] : [],
      imageCount: imageUrl ? 1 : 0,
      scrapedDate: new Date().toISOString(),
    };
  }

  override parseImages(document: Document, _product: Product): ProductImage[] {
    const galleryUrls = extractAmazonGalleryUrls(document);

    if (galleryUrls.length > 0) {
      return galleryUrls.map((url, i) => ({
        url,
        position: i,
        isCover: i === 0,
      }));
    }

    const urls = new Set<string>();

    const dynamicAttr = document.querySelector('#imgTagWrapperId img, #landingImage')
      ?.getAttribute('data-a-dynamic-image');
    if (dynamicAttr) {
      try {
        const dynamic = JSON.parse(dynamicAttr) as Record<string, unknown>;
        Object.keys(dynamic).forEach((url) => urls.add(normalizeImageUrl(url)));
      } catch {
        // ignore
      }
    }

    document
      .querySelectorAll('#altImages img, #imageBlock img, #imgTagWrapperId img, .imgTagWrapper img')
      .forEach((img) => {
        if (!(img instanceof HTMLImageElement)) return;
        const src =
          img.getAttribute('data-old-hires') ||
          img.dataset['src'] ||
          img.src;
        if (src && !src.includes('data:image') && src.includes('http')) {
          urls.add(normalizeImageUrl(src));
        }
      });

    if (urls.size === 0) {
      return super
        .parseImages(document, _product)
        .filter((img) => img.url.includes('media-amazon.com'))
        .map((img) => ({
          ...img,
          url: normalizeImageUrl(img.url),
        }));
    }

    return Array.from(urls).map((url, i) => ({
      url,
      position: i,
      isCover: i === 0,
    }));
  }

  override extract(document: Document, url: string): Product {
    const product = super.extract(document, url);
    const images = this.parseImages(document, product);
    if (images.length > 0) {
      product.images = images;
      product.imageUrls = [...new Set(images.map((img) => normalizeImageUrl(img.url)).filter(Boolean))];
      product.imageCount = product.imageUrls.length;
    }
    return product;
  }

  findNextPage(document: Document, url: string): string | null {
    return findNextPageUrl(document, url);
  }

  protected override parseTitle(document: Document): string | undefined {
    return (
      document.querySelector('#productTitle')?.textContent?.trim() ??
      super.parseTitle(document)
    );
  }

  protected override parsePriceValue(document: Document): number | null {
    const priceEl =
      document.querySelector('.a-price .a-offscreen') ??
      document.querySelector('#priceblock_ourprice');
    if (priceEl?.textContent) return parsePrice(priceEl.textContent);
    return super.parsePriceValue(document);
  }
}

export class EbayAdapter extends BaseAdapter {
  readonly platform: Platform = 'ebay';
  readonly name = 'eBay';
  readonly domains = ['ebay.com', 'ebay.co.uk'];

  detect(_document: Document, url: string): boolean {
    return /ebay\./i.test(url);
  }

  override findProducts(document: Document, _url: string): string[] {
    const links = new Set<string>();
    document.querySelectorAll('a[href*="/itm/"]').forEach((a) => {
      if (a instanceof HTMLAnchorElement) links.add(a.href.split('?')[0] ?? a.href);
    });
    return Array.from(links);
  }
}

export class EtsyAdapter extends BaseAdapter {
  readonly platform: Platform = 'etsy';
  readonly name = 'Etsy';
  readonly domains = ['etsy.com'];

  detect(_document: Document, url: string): boolean {
    return url.includes('etsy.com');
  }

  override findProducts(document: Document, _url: string): string[] {
    const links = new Set<string>();
    document.querySelectorAll('a[href*="/listing/"]').forEach((a) => {
      if (a instanceof HTMLAnchorElement) links.add(a.href.split('?')[0] ?? a.href);
    });
    return Array.from(links);
  }
}

export class AliExpressAdapter extends BaseAdapter {
  readonly platform: Platform = 'aliexpress';
  readonly name = 'AliExpress';
  readonly domains = [
    'aliexpress.com',
    'aliexpress.us',
    'aliexpress.ru',
    'aliexpress.fr',
    'aliexpress.es',
  ];

  detect(_document: Document, url: string): boolean {
    return /aliexpress\./i.test(url);
  }

  private normalizeItemUrl(href: string, pageUrl: string): string | null {
    try {
      const full = href.startsWith('http') ? href : new URL(href, pageUrl).href;
      const match = full.match(/\/(?:item|i)\/(\d+)\.html/i) ?? full.match(/[?&]productId=(\d+)/i);
      if (!match?.[1]) return null;
      const origin = new URL(pageUrl).origin;
      return `${origin}/item/${match[1]}.html`;
    } catch {
      return null;
    }
  }

  override findProducts(document: Document, url: string): string[] {
    const links = new Set<string>();

    const add = (href: string) => {
      const normalized = this.normalizeItemUrl(href, url);
      if (normalized) links.add(normalized);
    };

    document
      .querySelectorAll(
        'a[href*="/item/"], a[href*="/i/"], a[href*="productId="], [data-product-id] a, .search-card-item a, .list--gallery--C2f2tvm a, .product-snippet a, .manhattan--container--1lP57Ag a',
      )
      .forEach((a) => {
        if (a instanceof HTMLAnchorElement && a.href) add(a.href);
      });

    // Fallback: any anchor whose href looks like a product id
    if (links.size === 0) {
      document.querySelectorAll('a[href]').forEach((a) => {
        if (a instanceof HTMLAnchorElement) add(a.href);
      });
    }

    return Array.from(links);
  }

  extractFromCard(card: Element, productUrl: string, pageUrl: string): Product {
    const title =
      card.querySelector(
        'h1, h2, h3, [class*="title"], [class*="Title"], a[title], .multi--titleText--nXeOvyr',
      )?.textContent?.trim() ||
      card.querySelector('a[href*="/item/"]')?.getAttribute('title')?.trim() ||
      card.querySelector('img')?.getAttribute('alt')?.trim() ||
      undefined;

    const priceText =
      card.querySelector(
        '[class*="price"], [class*="Price"], .multi--price-sale--u-YQbCW, .uniform-banner-box-price',
      )?.textContent?.trim() ?? undefined;

    const img = card.querySelector('img');
    const rawSrc =
      img instanceof HTMLImageElement
        ? img.src || img.dataset['src'] || img.getAttribute('data-src') || ''
        : '';
    const imageUrl = rawSrc ? normalizeImageUrl(rawSrc) : undefined;

    const ordersText = card.querySelector('[class*="trade"], [class*="sold"], [class*="order"]')
      ?.textContent;
    const reviewMatch = ordersText?.replace(/,/g, '').match(/(\d+)/);
    const reviewCount = reviewMatch?.[1] ? parseInt(reviewMatch[1], 10) : undefined;

    return {
      platform: this.platform,
      title: title || undefined,
      price: priceText ? parsePrice(priceText) ?? undefined : undefined,
      currency: 'USD',
      productUrl,
      website: getDomain(pageUrl),
      scrapedDate: new Date().toISOString(),
      imageUrls: imageUrl ? [imageUrl] : [],
      images: imageUrl ? [{ url: imageUrl, isCover: true, position: 0 }] : [],
      imageCount: imageUrl ? 1 : 0,
      reviewCount,
    };
  }

  protected override parseTitle(document: Document): string | undefined {
    return (
      document.querySelector('h1[data-pl="product-title"], h1.title, .product-title-text, h1')
        ?.textContent?.trim() ?? super.parseTitle(document)
    );
  }

  override parseImages(document: Document, product: Product) {
    const images = super.parseImages(document, product);
    document
      .querySelectorAll(
        '.images-view-item img, .slider--img--kD4mIg7 img, [class*="gallery"] img, [class*="image-view"] img',
      )
      .forEach((img) => {
        if (!(img instanceof HTMLImageElement)) return;
        const src = normalizeImageUrl(img.src || img.dataset['src'] || '');
        if (src && !images.find((i) => i.url === src)) {
          images.push({ url: src, position: images.length, isCover: images.length === 0 });
        }
      });
    return images;
  }
}

export class BigCommerceAdapter extends BaseAdapter {
  readonly platform: Platform = 'bigcommerce';
  readonly name = 'BigCommerce';
  readonly domains = ['mybigcommerce.com'];

  detect(document: Document, url: string): boolean {
    return (
      /bigcommerce|stencil/i.test(document.documentElement.outerHTML) ||
      url.includes('/products/')
    );
  }

  override findProducts(document: Document, _url: string): string[] {
    const links = new Set<string>();
    document.querySelectorAll('a[href*="/products/"], .card-figure a').forEach((a) => {
      if (a instanceof HTMLAnchorElement) links.add(a.href.split('?')[0] ?? a.href);
    });
    return Array.from(links);
  }

  override parseImages(document: Document, product: Product) {
    const images = super.parseImages(document, product);
    document.querySelectorAll('.productView-image img, .productView-thumbnail-link img').forEach((img) => {
      if (img instanceof HTMLImageElement && img.src) {
        if (!images.find((i) => i.url === img.src)) {
          images.push({ url: img.src, position: images.length });
        }
      }
    });
    return images;
  }
}

export class MagentoAdapter extends BaseAdapter {
  readonly platform: Platform = 'magento';
  readonly name = 'Magento';
  readonly domains = [];

  detect(document: Document, _url: string): boolean {
    return /magento|Mage\.Cookies|catalog-product-view/i.test(document.documentElement.outerHTML);
  }

  override findProducts(document: Document, _url: string): string[] {
    const links = new Set<string>();
    document
      .querySelectorAll('.product-item-link, a.product-item-photo, a[href*=".html"]')
      .forEach((a) => {
        if (a instanceof HTMLAnchorElement && a.href.includes('.html')) {
          links.add(a.href.split('?')[0] ?? a.href);
        }
      });
    return Array.from(links);
  }

  protected override parseTitle(document: Document): string | undefined {
    return (
      document.querySelector('.page-title span, h1.page-title')?.textContent?.trim() ??
      super.parseTitle(document)
    );
  }
}

export class TemuAdapter extends BaseAdapter {
  readonly platform: Platform = 'temu';
  readonly name = 'Temu';
  readonly domains = ['temu.com'];

  detect(_document: Document, url: string): boolean {
    return url.includes('temu.com');
  }

  override findProducts(document: Document, _url: string): string[] {
    const links = new Set<string>();
    document.querySelectorAll('a[href*="-g-"], a[href*="/goods/"]').forEach((a) => {
      if (a instanceof HTMLAnchorElement) links.add(a.href.split('?')[0] ?? a.href);
    });
    return Array.from(links);
  }
}

export class AlibabaAdapter extends BaseAdapter {
  readonly platform: Platform = 'alibaba';
  readonly name = 'Alibaba';
  readonly domains = ['alibaba.com'];

  detect(_document: Document, url: string): boolean {
    return url.includes('alibaba.com');
  }

  override findProducts(document: Document, _url: string): string[] {
    const links = new Set<string>();
    document.querySelectorAll('a[href*="/product-detail/"], a[href*="/offer/"]').forEach((a) => {
      if (a instanceof HTMLAnchorElement) links.add(a.href.split('?')[0] ?? a.href);
    });
    return Array.from(links);
  }
}

export class PrestaShopAdapter extends BaseAdapter {
  readonly platform: Platform = 'prestashop';
  readonly name = 'PrestaShop';
  readonly domains = [];

  detect(document: Document, _url: string): boolean {
    return /prestashop|presta/i.test(document.documentElement.outerHTML);
  }

  override findProducts(document: Document, _url: string): string[] {
    const links = new Set<string>();
    document.querySelectorAll('.product-title a, .thumbnail a, a[href*="/product/"]').forEach((a) => {
      if (a instanceof HTMLAnchorElement) links.add(a.href.split('?')[0] ?? a.href);
    });
    return Array.from(links);
  }
}

export class OpenCartAdapter extends BaseAdapter {
  readonly platform: Platform = 'opencart';
  readonly name = 'OpenCart';
  readonly domains = [];

  detect(document: Document, url: string): boolean {
    return /opencart/i.test(document.documentElement.outerHTML) || url.includes('route=product');
  }

  override findProducts(document: Document, _url: string): string[] {
    const links = new Set<string>();
    document.querySelectorAll('.product-thumb a, a[href*="route=product/product"]').forEach((a) => {
      if (a instanceof HTMLAnchorElement) links.add(a.href);
    });
    return Array.from(links);
  }
}

export class CjDropshippingAdapter extends BaseAdapter {
  readonly platform: Platform = 'cj_dropshipping';
  readonly name = 'CJ Dropshipping';
  readonly domains = ['cjdropshipping.com'];

  detect(_document: Document, url: string): boolean {
    return /cjdropshipping\.com/i.test(url);
  }

  private normalizeProductUrl(href: string, pageUrl: string): string | null {
    try {
      const full = href.startsWith('http') ? href : new URL(href, pageUrl).href;
      // /product/slug-p-ID.html or /product/-p-ID.html
      const withPid = full.match(/\/product\/[^?\s#]*?-p-([A-Za-z0-9-]+)\.html/i);
      if (withPid?.[1]) {
        const origin = new URL(pageUrl).origin;
        return `${origin}/product/-p-${withPid[1]}.html`;
      }
      // /product/ID.html or path containing pid=
      const plain = full.match(/\/product\/([A-Za-z0-9-]{8,})\.html/i);
      if (plain?.[1] && !/^(list|search|category)$/i.test(plain[1])) {
        return full.split('?')[0] ?? full;
      }
      const pid = full.match(/[?&](?:pid|productId|id)=([A-Za-z0-9-]+)/i);
      if (pid?.[1]) {
        const origin = new URL(pageUrl).origin;
        return `${origin}/product/-p-${pid[1]}.html`;
      }
    } catch {
      // ignore
    }
    return null;
  }

  override findProducts(document: Document, url: string): string[] {
    const links = new Set<string>();

    const addHref = (href: string) => {
      const normalized = this.normalizeProductUrl(href, url);
      if (normalized) links.add(normalized);
    };

    document
      .querySelectorAll(
        'a[href*="/product/"], a[href*="-p-"], a[href*="pid="], a[href*="productId="]',
      )
      .forEach((a) => {
        if (a instanceof HTMLAnchorElement && a.href) addHref(a.href);
      });

    // Cards may expose product id without a clean href
    document
      .querySelectorAll(
        '[data-id], [data-pid], [data-product-id], [data-spu], [productid], [pid]',
      )
      .forEach((el) => {
        const id =
          el.getAttribute('data-id') ||
          el.getAttribute('data-pid') ||
          el.getAttribute('data-product-id') ||
          el.getAttribute('data-spu') ||
          el.getAttribute('productid') ||
          el.getAttribute('pid');
        if (id && id.length >= 8) {
          try {
            links.add(`${new URL(url).origin}/product/-p-${id}.html`);
          } catch {
            // ignore
          }
        }
        const anchorEl = el.querySelector('a[href]') ?? el.closest('a');
        if (anchorEl instanceof HTMLAnchorElement && anchorEl.href) {
          addHref(anchorEl.href);
        }
      });

    // Fallback: any anchor whose path looks like a CJ product
    if (links.size === 0) {
      document.querySelectorAll('a[href]').forEach((a) => {
        if (a instanceof HTMLAnchorElement) addHref(a.href);
      });
    }

    return Array.from(links);
  }

  extractFromCard(card: Element, productUrl: string, pageUrl: string): Product {
    const title =
      card
        .querySelector(
          '[class*="name"], [class*="Name"], [class*="title"], [class*="Title"], h2, h3, a[title]',
        )
        ?.getAttribute('title')
        ?.trim() ||
      card.querySelector(
        '[class*="name"], [class*="Name"], [class*="title"], [class*="Title"], h2, h3, a',
      )?.textContent?.trim() ||
      card.querySelector('img')?.getAttribute('alt')?.trim() ||
      undefined;

    const priceText =
      card.querySelector(
        '[class*="price"], [class*="Price"], [class*="sellPrice"], .price',
      )?.textContent?.trim() ?? undefined;

    const img = card.querySelector('img');
    const rawSrc =
      img instanceof HTMLImageElement
        ? img.src ||
          img.dataset['src'] ||
          img.getAttribute('data-src') ||
          img.getAttribute('data-original') ||
          ''
        : '';
    const imageUrl = rawSrc ? normalizeImageUrl(rawSrc) : undefined;

    return {
      platform: this.platform,
      title: title || undefined,
      price: priceText ? parsePrice(priceText) ?? undefined : undefined,
      currency: 'USD',
      productUrl,
      website: getDomain(pageUrl),
      scrapedDate: new Date().toISOString(),
      imageUrls: imageUrl ? [imageUrl] : [],
      images: imageUrl ? [{ url: imageUrl, isCover: true, position: 0 }] : [],
      imageCount: imageUrl ? 1 : 0,
    };
  }
}

export class SpocketAdapter extends BaseAdapter {
  readonly platform: Platform = 'spocket';
  readonly name = 'Spocket';
  readonly domains = ['spocket.co'];

  detect(_document: Document, url: string): boolean {
    return url.includes('spocket.co');
  }

  override findProducts(document: Document, _url: string): string[] {
    const links = new Set<string>();
    document.querySelectorAll('a[href*="/products/"]').forEach((a) => {
      if (a instanceof HTMLAnchorElement) links.add(a.href.split('?')[0] ?? a.href);
    });
    return Array.from(links);
  }
}

export class WalmartAdapter extends BaseAdapter {
  readonly platform: Platform = 'walmart';
  readonly name = 'Walmart';
  readonly domains = ['walmart.com'];

  detect(_document: Document, url: string): boolean {
    return url.includes('walmart.com');
  }

  override findProducts(document: Document, _url: string): string[] {
    const links = new Set<string>();
    document.querySelectorAll('a[href*="/ip/"]').forEach((a) => {
      if (a instanceof HTMLAnchorElement) links.add(a.href.split('?')[0] ?? a.href);
    });
    return Array.from(links);
  }

  protected override parseTitle(document: Document): string | undefined {
    return (
      document.querySelector('[itemprop="name"], h1')?.textContent?.trim() ??
      super.parseTitle(document)
    );
  }
}
