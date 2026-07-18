import type { Product } from '@fetcher/shared';
import { sanitizeFilename } from '@fetcher/shared';

function guessExt(url: string): string {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\.(jpe?g|png|webp|gif|avif)$/i);
    if (match?.[1]) return match[1].toLowerCase().replace('jpeg', 'jpg');
  } catch {
    // ignore
  }
  return 'jpg';
}

/** Download product images to the user's Downloads folder (never uploaded to VPS). */
export async function downloadProductImagesLocally(
  folderName: string,
  product: Product,
): Promise<number> {
  const urls = [...new Set((product.imageUrls ?? []).filter(Boolean))];
  if (urls.length === 0) return 0;

  const slug = sanitizeFilename((product.title ?? product.sku ?? 'product').slice(0, 48)) || 'product';
  let saved = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    const ext = guessExt(url);
    try {
      await chrome.downloads.download({
        url,
        filename: `fetcher-io/${folderName}/${slug}/image-${String(i + 1).padStart(2, '0')}.${ext}`,
        conflictAction: 'uniquify',
        saveAs: false,
      });
      saved++;
    } catch {
      // skip failed image
    }
  }

  return saved;
}

export async function downloadTextFile(
  filename: string,
  content: string,
  mime = 'application/json',
): Promise<number> {
  const blob = new Blob([content], { type: mime });
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return chrome.downloads.download({
    url: dataUrl,
    filename: `fetcher-io/${filename}`,
    saveAs: true,
  });
}

export async function downloadBlobFile(filename: string, blob: Blob): Promise<number> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return chrome.downloads.download({
    url: dataUrl,
    filename: `fetcher-io/${filename}`,
    saveAs: true,
  });
}
