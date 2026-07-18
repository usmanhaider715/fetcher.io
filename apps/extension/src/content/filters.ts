import type { Product, ProductSortFilter } from '@fetcher/shared';

const AMAZON_SORT_PARAMS: Partial<Record<ProductSortFilter, string>> = {
  top_rated: 'review-rank',
  top_reviews: 'review-rank',
  best_selling: 'exact-aware-popularity-rank',
  price_low: 'price-asc-rank',
  price_high: 'price-desc-rank',
  newest: 'date-desc-rank',
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'set',
  'pack',
  'pcs',
  'piece',
  'pieces',
]);

/** Build the marketplace search query from subcategory (preferred) or category. */
export function buildTargetSearchQuery(options: {
  categoryName?: string;
  subcategoryName?: string;
}): string | null {
  const sub = options.subcategoryName?.trim();
  const cat = options.categoryName?.trim();
  // Exact subcategory when selected — do not fall back to parent
  if (sub) return sub;
  if (cat) return cat;
  return null;
}

export function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s/,&+\-_]+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function stemWord(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('ses')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function wordInHaystack(word: string, haystack: string): boolean {
  const stem = stemWord(word);
  return haystack.includes(word) || (stem !== word && haystack.includes(stem));
}

export function isJunkProductTitle(title?: string): boolean {
  if (!title) return true;
  const t = title.replace(/\s+/g, ' ').trim();
  if (t.length < 8) return true;
  if (/^\d+[\s\-–]+\d+\s+of\b/i.test(t)) return true; // "49-96 of over 3,000 results"
  if (/\bresults for\b/i.test(t)) return true;
  if (/^sort by:/i.test(t)) return true;
  if (/\b(featured|best sellers|customer review)\b/i.test(t) && t.length < 80) return true;
  if (/a-button|aria-hidden|type="submit"/i.test(t)) return true;
  if ((t.match(/\n/g) ?? []).length > 3) return true;
  if (/aliexpress|shop now|sign in|download app/i.test(t) && t.length < 40) return true;
  return false;
}

export function applySortToUrl(url: string, sortFilter: ProductSortFilter): string {
  if (sortFilter === 'default') return url;

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes('amazon.')) {
      const param = AMAZON_SORT_PARAMS[sortFilter];
      if (param) parsed.searchParams.set('s', param);
    }

    if (parsed.hostname.includes('ebay.')) {
      const ebaySort: Partial<Record<ProductSortFilter, string>> = {
        top_rated: '15',
        price_low: '15',
        price_high: '16',
        newest: '10',
      };
      const param = ebaySort[sortFilter];
      if (param) parsed.searchParams.set('_sop', param);
    }

    if (parsed.hostname.includes('aliexpress.')) {
      const aliSort: Partial<Record<ProductSortFilter, string>> = {
        price_low: 'price_asc',
        price_high: 'price_desc',
        newest: 'newest',
        best_selling: 'orders',
        top_rated: 'ratings',
      };
      const param = aliSort[sortFilter];
      if (param) parsed.searchParams.set('SortType', param);
    }

    if (parsed.hostname.includes('cjdropshipping.com')) {
      // Do NOT add extra &orderBy=&sort= params — CJ bot redirects strip everything after the first &
      // Keep/normalize to a single keyWord param only.
      const keyWord =
        parsed.searchParams.get('keyWord') ??
        parsed.searchParams.get('keyWords') ??
        parsed.searchParams.get('q');
      if (
        parsed.pathname.includes('list.html') ||
        parsed.pathname.includes('/404') ||
        !parsed.pathname.includes('/list/') ||
        keyWord
      ) {
        if (!keyWord && !parsed.pathname.includes('/list/')) return parsed.toString();
        const fixed = new URL(`https://${parsed.hostname}/list/wholesale-all-categories-l-all.html`);
        if (keyWord) fixed.searchParams.set('keyWord', keyWord);
        return fixed.toString();
      }
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

function isAliExpressHost(hostname: string): boolean {
  return /aliexpress\./i.test(hostname);
}

/** Force listing URL to search for subcategory (or category). */
export function applyCategoryTargetToUrl(
  url: string,
  options: { categoryName?: string; subcategoryName?: string },
): string {
  const target = buildTargetSearchQuery(options);
  if (!target) return url;

  try {
    const parsed = new URL(url);

    // Already on a search results page for this exact query — keep it
    const existing =
      parsed.searchParams.get('keyWord') ??
      parsed.searchParams.get('keyWords') ??
      parsed.searchParams.get('keyword') ??
      parsed.searchParams.get('searchValue') ??
      parsed.searchParams.get('k') ??
      parsed.searchParams.get('q') ??
      parsed.searchParams.get('query') ??
      parsed.searchParams.get('SearchText') ??
      parsed.searchParams.get('search_key') ??
      parsed.searchParams.get('_nkw');
    if (existing && existing.trim().toLowerCase() === target.toLowerCase()) {
      return url;
    }

    const host = parsed.hostname;

    if (host.includes('amazon.')) {
      const search = new URL(`https://${host}/s`);
      search.searchParams.set('k', target);
      const existingSort = parsed.searchParams.get('s');
      if (existingSort) search.searchParams.set('s', existingSort);
      return search.toString();
    }

    if (host.includes('ebay.')) {
      parsed.pathname = '/sch/i.html';
      parsed.search = '';
      parsed.searchParams.set('_nkw', target);
      return parsed.toString();
    }

    if (isAliExpressHost(host)) {
      // Prefer wholesale search — works across regional AliExpress hosts
      const search = new URL(`https://${host}/w/wholesale.html`);
      search.searchParams.set('SearchText', target);
      return search.toString();
    }

    if (host.includes('temu.com')) {
      const search = new URL(`https://${host}/search_result.html`);
      search.searchParams.set('search_key', target);
      return search.toString();
    }

    if (host.includes('walmart.com')) {
      const search = new URL(`https://${host}/search`);
      search.searchParams.set('q', target);
      return search.toString();
    }

    if (host.includes('etsy.com')) {
      const search = new URL(`https://${host}/search`);
      search.searchParams.set('q', target);
      return search.toString();
    }

    if (host.includes('alibaba.com')) {
      const search = new URL(`https://${host}/trade/search`);
      search.searchParams.set('SearchText', target);
      return search.toString();
    }

    if (host.includes('cjdropshipping.com')) {
      // Use a SINGLE query param. CJ's bot redirect (`?rd=url&other=`) strips params after &.
      // Their SPA reads `keyWord` (singular).
      const search = new URL(`https://${host}/list/wholesale-all-categories-l-all.html`);
      search.searchParams.set('keyWord', target);
      return search.toString();
    }

    // Shopify / Woo / generic storefronts
    if (
      parsed.searchParams.has('q') ||
      parsed.searchParams.has('query') ||
      parsed.searchParams.has('search') ||
      parsed.searchParams.has('s')
    ) {
      if (parsed.searchParams.has('q')) parsed.searchParams.set('q', target);
      else if (parsed.searchParams.has('query')) parsed.searchParams.set('query', target);
      else if (parsed.searchParams.has('search')) parsed.searchParams.set('search', target);
      else parsed.searchParams.set('s', target);
      return parsed.toString();
    }

    // Common storefront search paths
    if (/\/(collections|catalog|category|shop)\b/i.test(parsed.pathname)) {
      parsed.pathname = '/search';
      parsed.search = '';
      parsed.searchParams.set('q', target);
      return parsed.toString();
    }

    parsed.searchParams.set('q', target);
    return parsed.toString();
  } catch {
    return url;
  }
}

export function applyScrapeFiltersToUrl(
  url: string,
  options: {
    sortFilter?: ProductSortFilter;
    categoryName?: string;
    subcategoryName?: string;
  },
): string {
  let next = applyCategoryTargetToUrl(url, {
    categoryName: options.categoryName,
    subcategoryName: options.subcategoryName,
  });
  if (options.sortFilter) {
    next = applySortToUrl(next, options.sortFilter);
  }
  return next;
}

/**
 * Subcategory: require strong relevance (phrase or all stemmed words).
 * Category-only: looser overlap.
 * Always reject junk titles.
 */
export function matchesCategoryTarget(
  product: Product,
  options: { categoryName?: string; subcategoryName?: string },
): boolean {
  const hasSub = Boolean(options.subcategoryName?.trim());
  const target = buildTargetSearchQuery(options)?.toLowerCase();
  if (!target) return true;

  // Title not scraped yet (SPA listing) — allow through; save-time filter runs after enrichment
  if (!product.title?.trim()) return Boolean(product.productUrl);

  if (isJunkProductTitle(product.title)) return false;

  const haystack = [product.title, product.category, product.subcategory, ...(product.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Exact phrase (e.g. "artificial plants")
  if (haystack.includes(target)) return true;

  const words = significantWords(target);
  if (words.length === 0) return true;

  if (hasSub) {
    // Exact phrase wins (e.g. "artificial plants")
    // Prefer concrete nouns: "plants" must match; "artificial" alone is too broad (fur, silk, lashes)
    const adjectives = new Set(['artificial', 'fake', 'faux', 'synthetic', 'imitation']);
    const nouns = words.filter((w) => !adjectives.has(w));
    if (nouns.length > 0) {
      return nouns.every((w) => wordInHaystack(w, haystack));
    }
    return words.every((w) => wordInHaystack(w, haystack));
  }

  const needed = Math.max(1, Math.ceil(words.length / 2));
  return words.filter((w) => wordInHaystack(w, haystack)).length >= needed;
}

export function filterProducts(
  products: Product[],
  options: {
    sortFilter?: ProductSortFilter;
    minRating?: number;
    minReviews?: number;
    categoryName?: string;
    subcategoryName?: string;
  },
): Product[] {
  let result = products.filter((p) => {
    if (!p.title?.trim()) return Boolean(p.productUrl);
    return !isJunkProductTitle(p.title);
  });

  if (options.minRating && options.minRating > 0) {
    result = result.filter((p) => (p.rating ?? 0) >= options.minRating!);
  }

  if (options.minReviews && options.minReviews > 0) {
    result = result.filter((p) => (p.reviewCount ?? 0) >= options.minReviews!);
  }

  if (options.subcategoryName || options.categoryName) {
    result = result.filter((p) =>
      matchesCategoryTarget(p, {
        categoryName: options.categoryName,
        subcategoryName: options.subcategoryName,
      }),
    );
  }

  switch (options.sortFilter) {
    case 'top_rated':
      result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case 'top_reviews':
      result.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
      break;
    case 'price_low':
      result.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
      break;
    case 'price_high':
      result.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      break;
    default:
      break;
  }

  return result;
}

export function findNextPageUrl(document: Document, currentUrl: string): string | null {
  const selectors = [
    'a.s-pagination-next:not(.s-pagination-disabled)',
    '.s-pagination-next:not(.s-pagination-disabled) a',
    'a[aria-label="Go to next page"]',
    'a[rel="next"]',
    '.pagination__next a',
    'a.next',
    'a[aria-label="Next"]',
    '.woocommerce-pagination .next',
    // AliExpress
    'button[ae_button_type="nextPage"]:not([disabled])',
    'a[aria-label="Next page"]',
    '.comet-pagination-next:not(.comet-pagination-disabled) a',
    '[class*="pagination"] [class*="next"]:not([disabled])',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLAnchorElement && el.href) {
      return el.href;
    }
    if (el) {
      const link = el.querySelector('a') ?? (el.closest('a') as HTMLAnchorElement | null);
      if (link?.href) return link.href;
    }
  }

  const currentPage = document.querySelector('.s-pagination-selected');
  if (currentPage) {
    const next = currentPage.parentElement?.nextElementSibling?.querySelector('a');
    if (next instanceof HTMLAnchorElement && next.href) return next.href;
  }

  // AliExpress page param bump / CJ pageNum
  try {
    const parsed = new URL(currentUrl);
    if (isAliExpressHost(parsed.hostname)) {
      const page = parseInt(parsed.searchParams.get('page') ?? '1', 10);
      parsed.searchParams.set('page', String(page + 1));
      return parsed.toString();
    }
    if (/cjdropshipping\.com/i.test(parsed.hostname)) {
      const page = parseInt(
        parsed.searchParams.get('pageNum') ?? parsed.searchParams.get('page') ?? '1',
        10,
      );
      parsed.searchParams.set('pageNum', String(page + 1));
      return parsed.toString();
    }
  } catch {
    // ignore
  }

  return null;
}
