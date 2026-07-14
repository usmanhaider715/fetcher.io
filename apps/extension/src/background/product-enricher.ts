import type { Product } from '@fetcher/shared';
import { delay } from '@fetcher/shared';
import { ensureContentScriptReady } from './content-script';

function mergeProduct(listing: Product, detail?: Product): Product {
  if (!detail) return listing;

  const imageUrls =
    detail.imageUrls && detail.imageUrls.length > 0
      ? detail.imageUrls
      : listing.imageUrls;
  const images =
    detail.images && detail.images.length > 0 ? detail.images : listing.images;

  return {
    ...listing,
    ...detail,
    title: listing.title ?? detail.title,
    price: listing.price ?? detail.price,
    salePrice: listing.salePrice ?? detail.salePrice,
    rating: listing.rating ?? detail.rating,
    reviewCount: listing.reviewCount ?? detail.reviewCount,
    sku: listing.sku ?? detail.sku,
    brand: detail.brand ?? listing.brand,
    description: detail.description || listing.description,
    shortDescription: detail.shortDescription || listing.shortDescription,
    specifications:
      detail.specifications && Object.keys(detail.specifications).length > 0
        ? detail.specifications
        : listing.specifications,
    productUrl: listing.productUrl ?? detail.productUrl,
    imageUrls,
    images,
    imageCount: imageUrls?.length ?? images?.length ?? 0,
  };
}

function waitForTabComplete(tabId: number, timeoutMs = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Product page load timeout'));
    }, timeoutMs);

    const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

export class ProductEnricher {
  async enrichFromProductPage(product: Product): Promise<Product> {
    if (!product.productUrl) return product;

    let tab: chrome.tabs.Tab | undefined;
    try {
      tab = await chrome.tabs.create({ url: product.productUrl, active: false });
      if (!tab.id) return product;

      await waitForTabComplete(tab.id);
      await delay(2000);

      const ready = await ensureContentScriptReady(tab.id);
      if (!ready) return product;

      const response = (await chrome.tabs.sendMessage(tab.id, {
        type: 'SCRAPE_PRODUCT_PAGE',
      })) as { product?: Product } | undefined;

      return mergeProduct(product, response?.product);
    } catch {
      return product;
    } finally {
      if (tab?.id) {
        chrome.tabs.remove(tab.id).catch(() => {});
      }
    }
  }
}

export const productEnricher = new ProductEnricher();
