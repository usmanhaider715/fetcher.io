import type { ScrapeCheckpoint } from '@fetcher/shared';
import { STORAGE_KEYS } from '@fetcher/shared';

export async function saveCheckpoint(checkpoint: ScrapeCheckpoint): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.CHECKPOINT]: { ...checkpoint, updatedAt: new Date().toISOString() },
  });
}

export async function loadCheckpoint(): Promise<ScrapeCheckpoint | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CHECKPOINT);
  return (result[STORAGE_KEYS.CHECKPOINT] as ScrapeCheckpoint) ?? null;
}

export async function clearCheckpoint(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.CHECKPOINT);
}
