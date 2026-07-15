import type { IAdapter, Product, StartScrapePayload } from '@fetcher/shared';
import { delay, normalizeImageUrl } from '@fetcher/shared';
import { AmazonAdapter } from '../adapters/platform.adapters';
import { adapterRegistry } from '../adapters/registry';
import { SelectorRecorder } from './selector-recorder';
import { DomInspector } from './dom-inspector';
import { scrapeCurrentPage } from './scrape-page';
import { initInvalidationWatcher } from './invalidation-banner';
import { initAuthBridge } from './auth-bridge';
import { loadDomainSelectors } from '../lib/domain-selectors';

const recorder = new SelectorRecorder();
const inspector = new DomInspector();

function notifyBackground(type: string, payload?: unknown): void {
  chrome.runtime.sendMessage({ type, payload }).catch(() => {});
}

function init(): void {
  initAuthBridge();
  initInvalidationWatcher();
  void loadDomainSelectors(window.location.href);
  const adapter = adapterRegistry.detect(document, window.location.href);
  notifyBackground('CONTENT_SCRIPT_READY', {
    url: window.location.href,
    platform: adapter.platform,
  });
  notifyBackground('PLATFORM_DETECTED', { platform: adapter.platform });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'PING':
      sendResponse({ ok: true, url: window.location.href });
      return true;

    case 'START_SELECTOR_RECORDING':
      recorder.start();
      sendResponse({ ok: true });
      return true;

    case 'STOP_SELECTOR_RECORDING':
      recorder.stop();
      sendResponse({ ok: true, selectors: recorder.getSelectors() });
      return true;

    case 'RELOAD_DOMAIN_SELECTORS':
      void loadDomainSelectors(window.location.href);
      sendResponse({ ok: true });
      return true;

    case 'SCRAPE_PRODUCT_PAGE': {
      const adapter = adapterRegistry.detect(document, window.location.href);
      const product = adapter.extract(document, window.location.href);
      if (product.imageUrls?.length) {
        product.imageUrls = [...new Set(product.imageUrls.map(normalizeImageUrl).filter(Boolean))];
        product.images = product.imageUrls.map((url, i) => ({
          url,
          position: i,
          isCover: i === 0,
        }));
        product.imageCount = product.imageUrls.length;
      }
      sendResponse({ product });
      return true;
    }

    case 'SCRAPE_PAGE': {
      const payload = message.payload as StartScrapePayload & {
        sessionId: string;
        pageNumber?: number;
      };
      scrapeCurrentPage(payload);
      sendResponse({ ok: true });
      return true;
    }

    case 'START_SCRAPE': {
      const payload = message.payload as StartScrapePayload & { sessionId: string };
      scrapeCurrentPage({ ...payload, pageNumber: 1 });
      sendResponse({ ok: true });
      return true;
    }

    case 'PAUSE_SCRAPE':
      sendResponse({ ok: true });
      return true;

    case 'RESUME_SCRAPE':
      sendResponse({ ok: true });
      return true;

    case 'STOP_SCRAPE':
      inspector.stopScrape();
      sendResponse({ ok: true });
      return true;

    case 'DETECT_PLATFORM': {
      const adapter = adapterRegistry.detect(document, window.location.href);
      sendResponse({ platform: adapter.platform });
      return true;
    }

    case 'GET_PAGE_INFO': {
      const adapter = adapterRegistry.detect(document, window.location.href);
      const productUrls = adapter.findProducts(document, window.location.href);
      sendResponse({
        url: window.location.href,
        title: document.title,
        platform: adapter.platform,
        productCount: productUrls.length,
        adapter: adapter.name,
      });
      return true;
    }

    default:
      return false;
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { recorder, inspector };
