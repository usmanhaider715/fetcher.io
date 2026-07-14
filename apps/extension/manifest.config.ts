import { defineManifest } from '@crxjs/vite-plugin';

const APP_NAME = 'Fetcher.io';
const APP_VERSION = '1.0.0';
const APP_DESCRIPTION =
  'Professional e-commerce scraping platform with local storage and image management';

export default defineManifest({
  manifest_version: 3,
  name: APP_NAME,
  version: APP_VERSION,
  description: APP_DESCRIPTION,
  icons: {
    '16': 'public/icons/icon-16.png',
    '32': 'public/icons/icon-32.png',
    '48': 'public/icons/icon-48.png',
    '128': 'public/icons/icon-128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: APP_NAME,
    default_icon: {
      '16': 'public/icons/icon-16.png',
      '32': 'public/icons/icon-32.png',
    },
  },
  options_page: 'src/options/index.html',
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: [
    'storage',
    'tabs',
    'activeTab',
    'scripting',
    'downloads',
    'notifications',
    'sidePanel',
    'offscreen',
  ],
  host_permissions: ['<all_urls>'],
  web_accessible_resources: [
    {
      resources: ['public/icons/*'],
      matches: ['<all_urls>'],
    },
  ],
});
