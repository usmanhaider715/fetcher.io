import type { SelectorMap } from '@fetcher/shared';
import { STORAGE_KEYS, getDomain } from '@fetcher/shared';

type SelectorStore = Record<string, SelectorMap>;

const cache: SelectorStore = {};

export function getDomainSelectorMap(url: string): SelectorMap | null {
  const domain = getDomain(url);
  return cache[domain] ?? null;
}

export async function loadDomainSelectors(url: string): Promise<SelectorMap | null> {
  const domain = getDomain(url);
  if (cache[domain]) return cache[domain]!;

  const result = await chrome.storage.local.get(STORAGE_KEYS.SELECTORS);
  const store = (result[STORAGE_KEYS.SELECTORS] as SelectorStore) ?? {};
  const map = store[domain] ?? null;
  if (map) cache[domain] = map;
  return map;
}

export async function saveDomainSelectors(url: string, selectors: SelectorMap): Promise<string> {
  const domain = getDomain(url);
  cache[domain] = selectors;

  const result = await chrome.storage.local.get(STORAGE_KEYS.SELECTORS);
  const store = (result[STORAGE_KEYS.SELECTORS] as SelectorStore) ?? {};
  store[domain] = selectors;
  await chrome.storage.local.set({ [STORAGE_KEYS.SELECTORS]: store });
  return domain;
}

export function clearSelectorCache(): void {
  for (const key of Object.keys(cache)) delete cache[key];
}
