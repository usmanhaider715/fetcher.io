const BANNER_ID = 'fetcher-io-extension-banner';

function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function showBanner(): void {
  if (document.getElementById(BANNER_ID)) return;

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.setAttribute('role', 'alert');
  Object.assign(banner.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '2147483647',
    background: '#dc2626',
    color: '#fff',
    padding: '12px 16px',
    fontSize: '14px',
    fontFamily: 'system-ui, sans-serif',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  });
  banner.textContent =
    'Fetcher.io was updated — refresh this page to continue scraping.';
  document.documentElement.prepend(banner);
}

export function initInvalidationWatcher(): void {
  if (!isExtensionContextValid()) {
    showBanner();
    return;
  }

  setInterval(() => {
    if (!isExtensionContextValid()) {
      showBanner();
    }
  }, 3000);

  window.addEventListener('pagehide', () => {
    if (!isExtensionContextValid()) showBanner();
  });
}
