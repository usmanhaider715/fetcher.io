import type { AppSettings, ExportFormat, Product, ScrapeProgress, StartScrapePayload } from '@fetcher/shared';
import { API_ENDPOINTS, DEFAULT_BACKEND_URL, STORAGE_KEYS } from '@fetcher/shared';

class BackendApi {
  private baseUrl = DEFAULT_BACKEND_URL;

  async init(): Promise<void> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    const settings = result[STORAGE_KEYS.SETTINGS] as AppSettings | undefined;
    if (settings?.backendUrl) this.baseUrl = settings.backendUrl;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error((error as { error?: string }).error ?? `Request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.request('/health');
      return true;
    } catch {
      return false;
    }
  }

  async startScrape(
    payload: StartScrapePayload & { websiteUrl: string; products?: Product[]; folderName?: string },
  ) {
    return this.request<{ sessionId: string; productsSaved: number; folderName?: string }>(
      API_ENDPOINTS.SCRAPE,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  async saveProduct(
    product: Product,
    sessionId: string,
    categoryId?: string,
    subcategoryId?: string,
  ) {
    return this.request<{ saved: boolean; uniqueId?: string; reason?: string; imagesDownloaded?: number; imagesPending?: number }>(
      '/scrape/download',
      {
        method: 'POST',
        body: JSON.stringify({ product, sessionId, categoryId, subcategoryId }),
      },
    );
  }

  async getProgress(sessionId: string): Promise<ScrapeProgress> {
    return this.request<ScrapeProgress>(`${API_ENDPOINTS.PROGRESS}/${sessionId}`);
  }

  async resumeSession(sessionId: string) {
    return this.request(API_ENDPOINTS.RESUME, {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  async pauseSession(sessionId: string) {
    return this.request(`/scrape/pause/${sessionId}`, { method: 'POST' });
  }

  async stopSession(sessionId: string) {
    return this.request(`/scrape/stop/${sessionId}`, { method: 'POST' });
  }

  async saveSelectors(domain: string, name: string, selectors: Record<string, unknown>) {
    return this.request(API_ENDPOINTS.SELECTORS, {
      method: 'POST',
      body: JSON.stringify({ domain, name, selectors }),
    });
  }

  async export(format: ExportFormat, sessionId?: string) {
    return this.request<{ path: string; count: number; filename?: string; downloadUrl?: string }>(
      API_ENDPOINTS.EXPORT,
      {
        method: 'POST',
        body: JSON.stringify({ format, sessionId }),
      },
    );
  }

  async downloadExport(downloadUrl: string, filename: string): Promise<Blob> {
    const path = downloadUrl.startsWith('/') ? downloadUrl : `/${downloadUrl}`;
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
    return res.blob();
  }

  async purgeSession(sessionId: string) {
    return this.request<{ deletedProducts: number }>(`/scrape/session/${sessionId}/purge`, {
      method: 'DELETE',
    });
  }

  async getCategories() {
    return this.request<Array<{ id: string; name: string; slug: string; subcategories: Array<{ id: string; name: string }> }>>(
      API_ENDPOINTS.CATEGORIES,
    );
  }

  async createCategory(name: string) {
    return this.request(API_ENDPOINTS.CATEGORIES, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async createSubcategory(categoryId: string, name: string) {
    return this.request(`${API_ENDPOINTS.CATEGORIES}/${categoryId}/subcategories`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getSettings(): Promise<AppSettings> {
    return this.request('/settings');
  }

  async updateSettings(settings: Partial<AppSettings>) {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async validateLicense() {
    try {
      return await this.request<{ valid: boolean; plan: string }>(API_ENDPOINTS.LICENSE);
    } catch {
      return { valid: true, plan: 'local' };
    }
  }

  async getLogs(sessionId?: string, limit = 50) {
    const params = new URLSearchParams();
    if (sessionId) params.set('sessionId', sessionId);
    params.set('limit', String(limit));
    return this.request(`/logs?${params}`);
  }

  async getProducts(sessionId?: string, limit = 50) {
    const params = new URLSearchParams();
    if (sessionId) params.set('sessionId', sessionId);
    params.set('limit', String(limit));
    return this.request<{ products: unknown[]; total: number }>(`/products?${params}`);
  }

  async getConnectorStatus() {
    return this.request<{
      shopify: { available: boolean; configured: boolean };
      woocommerce: { available: boolean; configured: boolean };
    }>(`${API_ENDPOINTS.CONNECTORS}/status`);
  }

  async pushSessionToShopify(sessionId: string, limit = 50) {
    return this.request<{ pushed: number; failed: number; total: number; errors?: string[] }>(
      `${API_ENDPOINTS.CONNECTORS}/shopify/push-session`,
      { method: 'POST', body: JSON.stringify({ sessionId, limit }) },
    );
  }

  async pushSessionToWooCommerce(sessionId: string, limit = 50) {
    return this.request<{ pushed: number; failed: number; total: number; errors?: string[] }>(
      `${API_ENDPOINTS.CONNECTORS}/woocommerce/push-session`,
      { method: 'POST', body: JSON.stringify({ sessionId, limit }) },
    );
  }
}

export const backendApi = new BackendApi();
