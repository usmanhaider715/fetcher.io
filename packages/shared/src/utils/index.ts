import type { Platform } from '../types/index.js';
import { PLATFORM_DETECTION_PATTERNS } from '../constants/index.js';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function sanitizeFilename(name: string): string {
  const invalidChars = /[<>:"/\\|?*]/g;
  const cleaned = name
    .replace(invalidChars, '_')
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 0 && code <= 31 ? '_' : char;
    })
    .join('')
    .replace(/\.\./g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 255);
  return cleaned;
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function detectPlatformFromDocument(document: Document, url: string): Platform {
  const html = document.documentElement.outerHTML;
  const domain = getDomain(url);

  const domainMap: Record<string, Platform> = {
    'aliexpress.com': 'aliexpress',
    'alibaba.com': 'alibaba',
    'cjdropshipping.com': 'cj_dropshipping',
    'spocket.co': 'spocket',
    'temu.com': 'temu',
    'amazon.com': 'amazon',
    'ebay.com': 'ebay',
    'etsy.com': 'etsy',
    'walmart.com': 'walmart',
  };

  for (const [pattern, platform] of Object.entries(domainMap)) {
    if (domain.includes(pattern)) {
      return platform;
    }
  }

  for (const [platform, patterns] of Object.entries(PLATFORM_DETECTION_PATTERNS)) {
    if (platform === 'generic') continue;
    for (const pattern of patterns) {
      if (pattern.test(html) || pattern.test(url)) {
        return platform as Platform;
      }
    }
  }

  return 'generic';
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(baseMs: number, variance = 0.3): number {
  const min = baseMs * (1 - variance);
  const max = baseMs * (1 + variance);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

export function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, '').replace(/,/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

export function extractJsonLdProducts(document: Document): unknown[] {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  const products: unknown[] = [];

  scripts.forEach((script) => {
    try {
      const data = JSON.parse(script.textContent ?? '');
      if (Array.isArray(data)) {
        data.forEach((item) => {
          if (item['@type'] === 'Product') products.push(item);
        });
      } else if (data['@type'] === 'Product') {
        products.push(data);
      } else if (data['@graph']) {
        data['@graph'].forEach((item: { '@type'?: string }) => {
          if (item['@type'] === 'Product') products.push(item);
        });
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  });

  return products;
}

export function getMetaContent(document: Document, property: string): string | null {
  const og = document.querySelector(`meta[property="${property}"]`);
  if (og) return og.getAttribute('content');

  const name = document.querySelector(`meta[name="${property}"]`);
  if (name) return name.getAttribute('content');

  return null;
}

export function upgradeAmazonImageUrl(url: string): string {
  if (!url || !url.includes('media-amazon.com')) return url;
  return url
    .replace(/\._[A-Z]{2}_[A-Z0-9_,]+_\./g, '._AC_SL1500_.')
    .replace(/\._SX\d+_SY\d+_/g, '._SL1500_')
    .replace(/\._AC_UL\d+_\./g, '._AC_SL1500_.')
    .replace(/\._AC_SR\d+,\d+_\./g, '._AC_SL1500_.')
    .replace(/\._CR,\d+,\d+,\d+,\d+_\./g, '.');
}

export function normalizeImageUrl(url: string): string {
  if (!url || url.startsWith('data:')) return '';
  if (url.startsWith('//')) return `https:${url}`;
  return upgradeAmazonImageUrl(url);
}
