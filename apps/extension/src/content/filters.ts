import type { Product, ProductSortFilter } from '@fetcher/shared';

const AMAZON_SORT_PARAMS: Partial<Record<ProductSortFilter, string>> = {
  top_rated: 'review-rank',
  top_reviews: 'review-rank',
  best_selling: 'exact-aware-popularity-rank',
  price_low: 'price-asc-rank',
  price_high: 'price-desc-rank',
  newest: 'date-desc-rank',
};

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

    return parsed.toString();
  } catch {
    return url;
  }
}

export function filterProducts(
  products: Product[],
  options: { sortFilter?: ProductSortFilter; minRating?: number; minReviews?: number },
): Product[] {
  let result = [...products];

  if (options.minRating && options.minRating > 0) {
    result = result.filter((p) => (p.rating ?? 0) >= options.minRating!);
  }

  if (options.minReviews && options.minReviews > 0) {
    result = result.filter((p) => (p.reviewCount ?? 0) >= options.minReviews!);
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
    case 'best_selling':
    case 'newest':
    case 'default':
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

  // Amazon page number pagination
  const currentPage = document.querySelector('.s-pagination-selected');
  if (currentPage) {
    const next = currentPage.parentElement?.nextElementSibling?.querySelector('a');
    if (next instanceof HTMLAnchorElement && next.href) return next.href;
  }

  return null;
}
