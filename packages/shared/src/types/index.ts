export type ScrapingMode =
  | 'current_product'
  | 'current_collection'
  | 'entire_website'
  | 'selected_urls'
  | 'import_csv'
  | 'resume_session';

export type SessionStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'interrupted'
  | 'completed'
  | 'error';

export type LogLevel = 'error' | 'warning' | 'info' | 'success';

export type Platform =
  | 'shopify'
  | 'woocommerce'
  | 'magento'
  | 'bigcommerce'
  | 'prestashop'
  | 'opencart'
  | 'aliexpress'
  | 'alibaba'
  | 'cj_dropshipping'
  | 'spocket'
  | 'temu'
  | 'amazon'
  | 'ebay'
  | 'etsy'
  | 'walmart'
  | 'generic';

export type ProductIdFormat = 'category_based' | 'uuid';

export type ThemeMode = 'dark' | 'light' | 'system';

export type ExportFormat = 'txt' | 'json' | 'csv' | 'excel' | 'zip';

export interface ProductVariant {
  id?: string;
  title?: string;
  sku?: string;
  price?: number;
  salePrice?: number;
  currency?: string;
  availability?: string;
  stock?: number;
  color?: string;
  size?: string;
  weight?: string;
  dimensions?: string;
  imageUrls?: string[];
  attributes?: Record<string, string>;
}

export interface ProductImage {
  url: string;
  alt?: string;
  position?: number;
  isCover?: boolean;
}

export interface Product {
  id?: string;
  uniqueId?: string;
  website?: string;
  supplier?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  htmlDescription?: string;
  shortDescription?: string;
  price?: number;
  salePrice?: number;
  currency?: string;
  discount?: number;
  sku?: string;
  barcode?: string;
  stock?: number;
  availability?: string;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  collections?: string[];
  variants?: ProductVariant[];
  colors?: string[];
  sizes?: string[];
  weight?: string;
  dimensions?: string;
  material?: string;
  country?: string;
  shipping?: string;
  videos?: string[];
  documents?: string[];
  faqs?: Array<{ question: string; answer: string }>;
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  seoKeywords?: string[];
  breadcrumbs?: string[];
  createdDate?: string;
  updatedDate?: string;
  scrapedDate?: string;
  productUrl?: string;
  imageUrls?: string[];
  images?: ProductImage[];
  imageCount?: number;
  specifications?: Record<string, string>;
  attributes?: Record<string, string>;
  customFields?: Record<string, unknown>;
  platform?: Platform;
  hash?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScrapeSession {
  id: string;
  mode: ScrapingMode;
  status: SessionStatus;
  platform?: Platform;
  websiteUrl: string;
  productsFound: number;
  productsSaved: number;
  imagesDownloaded: number;
  imagesPending?: number;
  pagesDiscovered?: number;
  crawlMethod?: 'sitemap' | 'bfs' | 'listing' | 'pagination';
  errors: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  pausedAt?: string;
  currentUrl?: string;
  productUrls?: string[];
  metadata?: Record<string, unknown>;
}

export interface ScrapeProgress {
  sessionId: string;
  status: SessionStatus;
  productsFound: number;
  productsSaved: number;
  imagesDownloaded: number;
  imagesPending?: number;
  errors: number;
  currentUrl?: string;
  percentComplete: number;
  message?: string;
}

export interface LogEntry {
  id: string;
  sessionId?: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface SelectorDefinition {
  id: string;
  name: string;
  domain: string;
  selectors: SelectorMap;
  createdAt: string;
  updatedAt: string;
}

export interface SelectorMap {
  productCard?: SelectorRule;
  title?: SelectorRule;
  price?: SelectorRule;
  salePrice?: SelectorRule;
  image?: SelectorRule;
  description?: SelectorRule;
  sku?: SelectorRule;
  brand?: SelectorRule;
  variants?: SelectorRule;
  [key: string]: SelectorRule | undefined;
}

export interface SelectorRule {
  type: 'css' | 'xpath' | 'attribute' | 'regex' | 'text';
  value: string;
  attribute?: string;
  parent?: string;
  fallbacks?: SelectorRule[];
}

export interface AdapterConfig {
  id: string;
  name: string;
  platform: Platform;
  domains: string[];
  selectors?: SelectorMap;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  theme: ThemeMode;
  backendUrl: string;
  cloudApiUrl?: string;
  licenseKey?: string;
  accessToken?: string;
  productsFolder: string;
  concurrentDownloads: number;
  asyncImageDownloads: boolean;
  retryCount: number;
  delayMs: number;
  randomizeDelay: boolean;
  productIdFormat: ProductIdFormat;
  compressionEnabled: boolean;
  resizeImages: boolean;
  maxImageWidth: number;
  createThumbnails: boolean;
  exportFormats: ExportFormat[];
  autoResume: boolean;
  duplicateDetection: {
    sku: boolean;
    url: boolean;
    hash: boolean;
    imageHash: boolean;
    titleSimilarity: boolean;
  };
  openAiApiKey?: string;
  aiEnrichmentEnabled?: boolean;
  connectors?: ConnectorSettings;
}

export interface ConnectorSettings {
  shopify?: {
    storeUrl: string;
    accessToken: string;
  };
  woocommerce?: {
    storeUrl: string;
    consumerKey: string;
    consumerSecret: string;
  };
}

export interface DashboardStats {
  sessionId?: string;
  currentUrl: string;
  detectedPlatform: Platform | null;
  productsFound: number;
  productsSaved: number;
  imagesDownloaded: number;
  imagesPending?: number;
  pagesDiscovered?: number;
  crawlMethod?: string;
  errors: number;
  sessionStatus: SessionStatus;
}

export type MessageType =
  | 'GET_DASHBOARD_STATS'
  | 'DASHBOARD_STATS'
  | 'START_SCRAPE'
  | 'PAUSE_SCRAPE'
  | 'RESUME_SCRAPE'
  | 'STOP_SCRAPE'
  | 'NEW_SESSION'
  | 'GET_RESUMABLE_SESSION'
  | 'SCRAPE_PROGRESS'
  | 'SCRAPE_LOG'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'SETTINGS_UPDATED'
  | 'GET_TAB_INFO'
  | 'TAB_INFO'
  | 'DETECT_PLATFORM'
  | 'PLATFORM_DETECTED'
  | 'CONTENT_SCRIPT_READY'
  | 'PING';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  requestId?: string;
}

export interface TabInfo {
  url: string;
  title: string;
  favIconUrl?: string;
}

export interface StartScrapePayload {
  mode: ScrapingMode;
  urls?: string[];
  categoryId?: string;
  subcategoryId?: string;
  sortFilter?: ProductSortFilter;
  maxPages?: number;
  minRating?: number;
  minReviews?: number;
  respectRobots?: boolean;
  maxCrawlPages?: number;
  productConcurrency?: number;
  deferImages?: boolean;
}

export type ProductSortFilter =
  | 'default'
  | 'top_rated'
  | 'top_reviews'
  | 'best_selling'
  | 'price_low'
  | 'price_high'
  | 'newest';

export interface PageScrapeResult {
  products: Product[];
  nextPageUrl: string | null;
  pageNumber: number;
  productsOnPage: number;
}

export interface ScrapeCheckpoint {
  sessionId: string;
  payload: StartScrapePayload;
  tabUrl: string;
  listingUrl: string;
  currentPage: number;
  nextPageUrl: string | null;
  totalFound: number;
  totalSaved: number;
  processedProductUrls: string[];
  updatedAt: string;
}

export * from './adapter.js';
