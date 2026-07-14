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
}

export class ShopifyAdapter extends BaseAdapter {
  readonly platform: Platform = 'shopify';
  readonly name = 'Shopify';
  readonly domains = ['myshopify.com', 'shopify.com'];

  detect(document: Document, url: string): boolean {
    const html = document.documentElement.outerHTML;
    return (
      /cdn\.shopify\.com/i.test(html) ||
      /Shopify\.theme/i.test(html) ||
      url.includes('/products/')
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

  detect(document: Document, _url: string): boolean {
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
    const title =
      card.querySelector('h2 a span, h2 span, .a-size-base-plus, .a-text-normal, .a-link-normal span')
        ?.textContent?.trim() ??
      card.querySelector('img')?.getAttribute('alt')?.trim();

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
  readonly domains = ['aliexpress.com'];

  detect(_document: Document, url: string): boolean {
    return url.includes('aliexpress.com');
  }

  override findProducts(document: Document, _url: string): string[] {
    const links = new Set<string>();
    document.querySelectorAll('a[href*="/item/"]').forEach((a) => {
      if (a instanceof HTMLAnchorElement) links.add(a.href.split('?')[0] ?? a.href);
    });
    return Array.from(links);
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
    return url.includes('cjdropshipping.com');
  }

  override findProducts(document: Document, _url: string): string[] {
    const links = new Set<string>();
    document.querySelectorAll('a[href*="/product/"], a[href*="/p/"]').forEach((a) => {
      if (a instanceof HTMLAnchorElement) links.add(a.href.split('?')[0] ?? a.href);
    });
    return Array.from(links);
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
