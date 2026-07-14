import { delay } from '@fetcher/shared';

async function injectContentScript(tabId: number): Promise<void> {
  const manifest = chrome.runtime.getManifest();
  const scripts = manifest.content_scripts?.[0]?.js;
  if (!scripts?.length) return;

  for (const file of scripts) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [file],
    });
  }
}

export async function ensureContentScriptReady(tabId: number, maxRetries = 6): Promise<boolean> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = (await chrome.tabs.sendMessage(tabId, { type: 'PING' })) as
        | { ok?: boolean }
        | undefined;
      if (response?.ok) return true;
    } catch {
      if (attempt === 0) {
        try {
          await injectContentScript(tabId);
        } catch {
          // Injection may fail on restricted pages
        }
      }
      await delay(1000);
    }
  }
  return false;
}
