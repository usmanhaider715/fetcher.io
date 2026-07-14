import { isValidUrl } from '@fetcher/shared';

export function parseUrlsFromCsv(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const urls = new Set<string>();

  for (const line of lines) {
    const cells = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    const header = cells[0]?.toLowerCase();

    if (urls.size === 0 && (header === 'url' || header === 'link' || header === 'product_url')) {
      continue;
    }

    for (const cell of cells) {
      if (isValidUrl(cell)) urls.add(cell);
    }
  }

  return Array.from(urls);
}

export function parseUrlsFromText(text: string): string[] {
  const urls = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (isValidUrl(trimmed)) urls.add(trimmed);
  }
  return Array.from(urls);
}
