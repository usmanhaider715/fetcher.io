import type { ExtensionMessage } from '@fetcher/shared';
import { generateRequestId } from '@fetcher/shared';

export function sendMessage<T = unknown, R = unknown>(
  message: ExtensionMessage<T>,
): Promise<R> {
  const requestId = generateRequestId();
  const messageWithId = { ...message, requestId };

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(messageWithId, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response as R);
    });
  });
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

export function onMessage<T = unknown>(
  callback: (message: ExtensionMessage<T>, sender: chrome.runtime.MessageSender) => void,
): () => void {
  const listener = (
    message: ExtensionMessage<T>,
    sender: chrome.runtime.MessageSender,
    _sendResponse: (response?: unknown) => void,
  ) => {
    callback(message, sender);
  };

  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
