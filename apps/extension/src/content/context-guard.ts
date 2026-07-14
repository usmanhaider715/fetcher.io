const BANNER_ID = 'fetcher-io-context-banner';

function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function showRefreshBanner(): void {
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
  banner.innerHTML =
    '<strong>Fetcher.io was updated.</strong> Refresh this page (F5) before scraping again.';

  document.documentElement.prepend(banner);
}

export function initContextGuard(): void {
  if (!isExtensionContextValid()) {
    showRefreshBanner();
    return;
  }

  setInterval(() => {
    if (!isExtensionContextValid()) {
      showRefreshBanner();
    }
  }, 3000);
}
