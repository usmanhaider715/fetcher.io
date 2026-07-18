import { delay } from '@fetcher/shared';

export interface SiteSearchResult {
  ok: boolean;
  method: 'already' | 'dom-click' | 'dom-enter' | 'location' | 'none';
  url: string;
  query: string;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  proto?.set?.call(input, value);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
}

function findSearchInput(): HTMLInputElement | null {
  const selectors = [
    '#searchImgBox input',
    '.searchInput--rjtq7 input',
    '.searchInputBox--uupzn input',
    'input[placeholder*="Find the product"]',
    'input[placeholder*="Find the product you"]',
    'input[placeholder*="Search" i]',
    '#twotabsearchtextbox',
    'input[name="_nkw"]',
    'input[name="keyword"]',
    'input[name="keyWord"]',
    'input[name="keyWords"]',
    'input[name="q"]',
    'input[type="search"]',
    'header input[type="text"]',
    'form[role="search"] input',
  ];

  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el instanceof HTMLInputElement && el.offsetParent !== null) return el;
    } catch {
      // invalid selector in older browsers
    }
  }
  return null;
}

function findSearchButton(): HTMLElement | null {
  const selectors = [
    '[data-gtag-element="search"]',
    '.searchBtn--DjAWM',
    '#nav-search-submit-button',
    'input.nav-input[type="submit"]',
    'button[type="submit"]',
    'form[role="search"] button',
    '.search-button',
    'button[aria-label*="Search" i]',
  ];
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el instanceof HTMLElement) return el;
    } catch {
      // ignore
    }
  }
  return null;
}

function urlAlreadyHasQuery(query: string): boolean {
  try {
    const decoded = decodeURIComponent(window.location.href).toLowerCase();
    const q = query.toLowerCase();
    if (!decoded.includes(q)) return false;
    return /[?&#](keyword|keywords|searchvalue|k|q|query|searchtext|search_key|_nkw)=/i.test(
      window.location.href,
    );
  } catch {
    return false;
  }
}

/** Drive the site's own search UI so SPA routers apply the exact query. */
export async function performSiteSearch(query: string): Promise<SiteSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, method: 'none', url: window.location.href, query: trimmed };
  }

  if (urlAlreadyHasQuery(trimmed)) {
    // Still sync the visible search box so filters match
    const input = findSearchInput();
    if (input && input.value.trim().toLowerCase() !== trimmed.toLowerCase()) {
      setInputValue(input, trimmed);
    }
    return { ok: true, method: 'already', url: window.location.href, query: trimmed };
  }

  const input = findSearchInput();
  if (input) {
    input.focus();
    setInputValue(input, trimmed);
    await delay(200);

    const btn = findSearchButton();
    if (btn) {
      btn.click();
      await delay(500);
      return { ok: true, method: 'dom-click', url: window.location.href, query: trimmed };
    }

    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
      }),
    );
    input.dispatchEvent(
      new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
      }),
    );
    input.form?.requestSubmit?.();
    await delay(500);
    return { ok: true, method: 'dom-enter', url: window.location.href, query: trimmed };
  }

  // Last resort: single-param navigation (avoid & so bot redirects don't strip the query)
  const host = window.location.hostname;
  if (/cjdropshipping\.com$/i.test(host)) {
    window.location.href = `https://${host}/list/wholesale-all-categories-l-all.html?keyWord=${encodeURIComponent(trimmed)}`;
    return { ok: true, method: 'location', url: window.location.href, query: trimmed };
  }

  if (/amazon\./i.test(host)) {
    window.location.href = `https://${host}/s?k=${encodeURIComponent(trimmed)}`;
    return { ok: true, method: 'location', url: window.location.href, query: trimmed };
  }

  if (/aliexpress\./i.test(host)) {
    window.location.href = `https://${host}/w/wholesale.html?SearchText=${encodeURIComponent(trimmed)}`;
    return { ok: true, method: 'location', url: window.location.href, query: trimmed };
  }

  return { ok: false, method: 'none', url: window.location.href, query: trimmed };
}
