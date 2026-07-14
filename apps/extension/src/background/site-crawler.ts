import { isValidUrl } from '@fetcher/shared';
import { fetchRobotsRules, isPathAllowed, type RobotsRules } from '../lib/robots';

const PRODUCT_PATH_PATTERNS = [
  /\/products\//i,
  /\/product\//i,
  /\/dp\//i,
  /\/itm\//i,
  /\/listing\//i,
  /\/item\//i,
  /\/p\//i,
];

function extractLocs(xml: string): string[] {
  const urls: string[] = [];
  const re = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const url = match[1]?.trim();
    if (url && isValidUrl(url)) urls.push(url);
  }
  return urls;
}

function isProductUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return PRODUCT_PATH_PATTERNS.some((p) => p.test(path));
  } catch {
    return false;
  }
}

function isCollectionUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return (
      path.includes('/collections/') ||
      path.includes('/category/') ||
      path.includes('/shop/') ||
      path.includes('/s?k=') ||
      path.includes('/s?')
    );
  } catch {
    return false;
  }
}

export interface CrawlDiscoveryResult {
  productUrls: string[];
  method: 'sitemap' | 'bfs' | 'listing';
  pagesDiscovered: number;
  robotsDelayMs: number;
}

export async function discoverProductUrls(
  startUrl: string,
  options: { maxPages?: number; respectRobots?: boolean; maxProducts?: number },
): Promise<CrawlDiscoveryResult> {
  const origin = new URL(startUrl).origin;
  const maxPages = options.maxPages ?? 20;
  const maxProducts = options.maxProducts ?? 500;
  const respectRobots = options.respectRobots !== false;

  const robots = respectRobots ? await fetchRobotsRules(origin) : { disallowed: [], crawlDelayMs: 1000, allowed: true };

  if (!isPathAllowed(new URL(startUrl).pathname, robots)) {
    return { productUrls: [], method: 'listing', pagesDiscovered: 0, robotsDelayMs: robots.crawlDelayMs };
  }

  const sitemapUrls = await trySitemap(origin, maxProducts);
  if (sitemapUrls.length > 0) {
    return {
      productUrls: sitemapUrls.slice(0, maxProducts),
      method: 'sitemap',
      pagesDiscovered: sitemapUrls.length,
      robotsDelayMs: robots.crawlDelayMs,
    };
  }

  const bfsUrls = await bfsDiscover(startUrl, maxPages, maxProducts, robots);
  return {
    productUrls: bfsUrls,
    method: 'bfs',
    pagesDiscovered: bfsUrls.length,
    robotsDelayMs: robots.crawlDelayMs,
  };
}

async function trySitemap(origin: string, maxProducts: number): Promise<string[]> {
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap_products_1.xml`,
  ];

  const productUrls = new Set<string>();

  for (const sitemapUrl of candidates) {
    try {
      const res = await fetch(sitemapUrl, { credentials: 'omit' });
      if (!res.ok) continue;
      const xml = await res.text();
      const locs = extractLocs(xml);

      const childSitemaps = locs.filter((u) => u.endsWith('.xml'));
      if (childSitemaps.length > 0) {
        for (const child of childSitemaps.slice(0, 10)) {
          try {
            const childRes = await fetch(child, { credentials: 'omit' });
            if (!childRes.ok) continue;
            const childXml = await childRes.text();
            for (const loc of extractLocs(childXml)) {
              if (isProductUrl(loc)) productUrls.add(loc.split('?')[0] ?? loc);
            }
          } catch {
            // skip child sitemap
          }
          if (productUrls.size >= maxProducts) break;
        }
      } else {
        for (const loc of locs) {
          if (isProductUrl(loc)) productUrls.add(loc.split('?')[0] ?? loc);
        }
      }

      if (productUrls.size > 0) break;
    } catch {
      // try next candidate
    }
  }

  return Array.from(productUrls);
}

async function bfsDiscover(
  startUrl: string,
  maxPages: number,
  maxProducts: number,
  robots: RobotsRules,
): Promise<string[]> {
  const origin = new URL(startUrl).origin;
  const visited = new Set<string>();
  const queue: string[] = [startUrl];
  const productUrls = new Set<string>();

  while (queue.length > 0 && visited.size < maxPages && productUrls.size < maxProducts) {
    const pageUrl = queue.shift()!;
    if (visited.has(pageUrl)) continue;
    visited.add(pageUrl);

    try {
      const path = new URL(pageUrl).pathname;
      if (!isPathAllowed(path, robots)) continue;

      const res = await fetch(pageUrl, { credentials: 'omit' });
      if (!res.ok) continue;
      const html = await res.text();

      const linkRe = /href=["']([^"']+)["']/gi;
      let match: RegExpExecArray | null;
      while ((match = linkRe.exec(html)) !== null) {
        const href = match[1];
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;

        let absolute: string;
        try {
          absolute = new URL(href, pageUrl).href.split('#')[0] ?? href;
        } catch {
          continue;
        }

        if (!absolute.startsWith(origin)) continue;
        if (visited.has(absolute) || queue.includes(absolute)) continue;

        if (isProductUrl(absolute)) {
          productUrls.add(absolute.split('?')[0] ?? absolute);
        } else if (isCollectionUrl(absolute) && visited.size + queue.length < maxPages) {
          queue.push(absolute);
        }
      }
    } catch {
      // skip page
    }
  }

  return Array.from(productUrls);
}
