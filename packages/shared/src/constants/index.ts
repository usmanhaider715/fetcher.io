import type {
  AppSettings,
  ExportFormat,
  Platform,
  ProductIdFormat,
  ScrapingMode,
  ThemeMode,
} from '../types/index.js';

export const APP_NAME = 'Fetcher.io';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION =
  'Professional e-commerce scraping platform with local storage and image management';

export const DEFAULT_BACKEND_URL = 'http://localhost:3847';
export const DEFAULT_CLOUD_API_URL = 'https://api.fetcherio.dev';

export const STORAGE_KEYS = {
  SETTINGS: 'fetcher_settings',
  SESSION: 'fetcher_session',
  CHECKPOINT: 'fetcher_checkpoint',
  LOGS: 'fetcher_logs',
  CATEGORIES: 'fetcher_categories',
  SELECTORS: 'fetcher_selectors',
  ADAPTERS: 'fetcher_adapters',
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  backendUrl: DEFAULT_BACKEND_URL,
  cloudApiUrl: DEFAULT_CLOUD_API_URL,
  licenseKey: '',
  productsFolder: 'Products',
  concurrentDownloads: 3,
  asyncImageDownloads: true,
  retryCount: 3,
  delayMs: 1000,
  randomizeDelay: true,
  productIdFormat: 'category_based',
  compressionEnabled: true,
  resizeImages: false,
  maxImageWidth: 1920,
  createThumbnails: true,
  exportFormats: ['txt', 'json'] as ExportFormat[],
  autoResume: true,
  duplicateDetection: {
    sku: true,
    url: true,
    hash: true,
    imageHash: true,
    titleSimilarity: true,
  },
  aiEnrichmentEnabled: false,
  connectors: {},
};

export const SCRAPING_MODES: Array<{ value: ScrapingMode; label: string; description: string }> = [
  {
    value: 'current_product',
    label: 'Current Product',
    description: 'Scrape the product on the current page',
  },
  {
    value: 'current_collection',
    label: 'Current Collection',
    description: 'Scrape all products in the current collection/category',
  },
  {
    value: 'entire_website',
    label: 'Entire Website',
    description: 'Crawl and scrape the entire website',
  },
  {
    value: 'selected_urls',
    label: 'Selected URLs',
    description: 'Scrape a list of manually selected URLs',
  },
  {
    value: 'import_csv',
    label: 'Import CSV',
    description: 'Import product URLs from a CSV file',
  },
  {
    value: 'resume_session',
    label: 'Resume Session',
    description: 'Resume a previously interrupted scraping session',
  },
];

export const SUPPORTED_PLATFORMS: Array<{ value: Platform; label: string }> = [
  { value: 'shopify', label: 'Shopify' },
  { value: 'woocommerce', label: 'WooCommerce' },
  { value: 'magento', label: 'Magento' },
  { value: 'bigcommerce', label: 'BigCommerce' },
  { value: 'prestashop', label: 'PrestaShop' },
  { value: 'opencart', label: 'OpenCart' },
  { value: 'aliexpress', label: 'AliExpress' },
  { value: 'alibaba', label: 'Alibaba' },
  { value: 'cj_dropshipping', label: 'CJ Dropshipping' },
  { value: 'spocket', label: 'Spocket' },
  { value: 'temu', label: 'Temu' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'ebay', label: 'eBay' },
  { value: 'etsy', label: 'Etsy' },
  { value: 'walmart', label: 'Walmart Marketplace' },
  { value: 'generic', label: 'Generic' },
];

export const THEME_MODES: Array<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export const PRODUCT_ID_FORMATS: Array<{ value: ProductIdFormat; label: string }> = [
  { value: 'category_based', label: 'Category-Based (EL-PH-000001)' },
  { value: 'uuid', label: 'UUID' },
];

export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'] as const;

export const API_ENDPOINTS = {
  SCRAPE: '/scrape',
  DOWNLOAD: '/download',
  EXPORT: '/export',
  RESUME: '/resume',
  PROGRESS: '/progress',
  CATEGORIES: '/categories',
  AUTH: '/auth',
  LICENSE: '/auth/license/validate',
  CLOUD_AUTH: '/v1/auth',
  CLOUD_AI: '/v1/ai/generate',
  CLOUD_CONNECTORS: '/v1/connectors',
  SELECTORS: '/selectors',
  ENRICHMENT: '/enrichment',
  CONNECTORS: '/connectors',
} as const;

/** Feature flags for platform adapters — false = experimental/disabled */
export const ADAPTER_FLAGS: Partial<Record<Platform, boolean>> = {
  magento: true,
  bigcommerce: true,
  temu: true,
  alibaba: true,
  walmart: true,
};

export const PLATFORM_DETECTION_PATTERNS: Record<Platform, RegExp[]> = {
  shopify: [/cdn\.shopify\.com/i, /Shopify\.theme/i, /shopify-section/i],
  woocommerce: [/woocommerce/i, /wc-product/i, /wp-content\/plugins\/woocommerce/i],
  magento: [/magento/i, /Mage\.Cookies/i, /catalog-product-view/i],
  bigcommerce: [/bigcommerce/i, /stencil/i],
  prestashop: [/prestashop/i, /presta/i],
  opencart: [/opencart/i, /route=product/i],
  aliexpress: [/aliexpress\.com/i],
  alibaba: [/alibaba\.com/i],
  cj_dropshipping: [/cjdropshipping\.com/i],
  spocket: [/spocket\.co/i],
  temu: [/temu\.com/i],
  amazon: [/amazon\./i, /a-state/i],
  ebay: [/ebay\./i],
  etsy: [/etsy\.com/i],
  walmart: [/walmart\.com/i],
  generic: [],
};

export const PRODUCT_SORT_FILTERS: Array<{
  value: import('../types/index.js').ProductSortFilter;
  label: string;
  description: string;
}> = [
  { value: 'default', label: 'Default', description: 'No sorting applied' },
  { value: 'top_rated', label: 'Top Rated', description: 'Highest average customer rating' },
  { value: 'top_reviews', label: 'Most Reviews', description: 'Most customer reviews' },
  { value: 'best_selling', label: 'Best Selling', description: 'Best selling products' },
  { value: 'price_low', label: 'Price: Low to High', description: 'Lowest price first' },
  { value: 'price_high', label: 'Price: High to Low', description: 'Highest price first' },
  { value: 'newest', label: 'Newest', description: 'Newest arrivals first' },
];
