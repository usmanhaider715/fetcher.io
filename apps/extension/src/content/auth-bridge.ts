/** Bridges web login token → extension background (no extension ID needed). */
const FETCHER_HOSTS = ['productfetcher.online', 'app.productfetcher.online', 'localhost', '127.0.0.1'];

function isFetcherWebApp(): boolean {
  const host = window.location.hostname;
  return FETCHER_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
}

let lastLinkedToken: string | null = null;

function readAccessToken(): string | null {
  return (
    localStorage.getItem('fetcher_access') ??
    sessionStorage.getItem('fetcher_access')
  );
}

function pushTokenToExtension(token: string): void {
  if (token === lastLinkedToken) return;
  chrome.runtime
    .sendMessage({ type: 'SET_ACCESS_TOKEN', payload: { accessToken: token } })
    .then((res) => {
      const result = res as { signedIn?: boolean; error?: string };
      if (result?.signedIn || !result?.error) {
        lastLinkedToken = token;
      }
    })
    .catch(() => {});
}

function tryLinkFromPage(): void {
  if (!isFetcherWebApp()) return;
  const token = readAccessToken();
  if (token) pushTokenToExtension(token);
}

export function initAuthBridge(): void {
  if (!isFetcherWebApp()) return;

  tryLinkFromPage();

  window.addEventListener('fetcher-auth', () => tryLinkFromPage());
  window.addEventListener('storage', (e) => {
    if (e.key === 'fetcher_access') tryLinkFromPage();
  });

  // Retry while user completes login in this tab
  const interval = window.setInterval(tryLinkFromPage, 1500);
  window.setTimeout(() => window.clearInterval(interval), 120_000);
}
