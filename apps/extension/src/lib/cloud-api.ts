import { API_ENDPOINTS, DEFAULT_CLOUD_API_URL } from '@fetcher/shared';

export interface CloudMeResponse {
  success: boolean;
  user: { id: string; email: string; name?: string | null };
  organization: { id: string; name: string; plan: string; slug: string } | null;
}

export interface CloudJobPayload {
  mode: string;
  websiteUrl?: string;
  projectId?: string;
  platform?: string;
  categoryName?: string;
  subcategoryName?: string;
  sortFilter?: string;
  maxProducts?: number;
  productsFound?: number;
  productsSaved?: number;
  imagesDownloaded?: number;
  status?: 'running' | 'completed' | 'failed' | 'interrupted';
  metadata?: Record<string, unknown>;
}

export interface CloudProductPayload {
  title?: string;
  price?: number;
  currency?: string;
  productUrl?: string;
  imageUrls?: string[];
  imageCount?: number;
  category?: string;
  subcategory?: string;
  sku?: string;
  platform?: string;
  scrapedAt?: string;
}

export class CloudApiClient {
  private baseUrl = DEFAULT_CLOUD_API_URL;
  private accessToken: string | null = null;

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string>),
    };
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `Cloud API error ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  async validateLicense(key?: string) {
    const qs = key ? `?key=${encodeURIComponent(key)}` : '';
    return this.request<{
      valid: boolean;
      plan: string;
      features: string[];
      userId?: string;
      organizationId?: string;
      error?: string;
    }>(`${API_ENDPOINTS.CLOUD_AUTH}/license/validate${qs}`);
  }

  async getMe() {
    return this.request<CloudMeResponse>(`${API_ENDPOINTS.CLOUD_AUTH}/me`);
  }

  async generateAi(task: string, product: { title?: string; description?: string; brand?: string; price?: number }) {
    return this.request<{ content: string; provider: string; provenance: Record<string, string> }>(
      API_ENDPOINTS.CLOUD_AI,
      { method: 'POST', body: JSON.stringify({ task, product }) },
    );
  }

  async getUploadToken(platform: 'shopify' | 'woocommerce', productCount = 1) {
    return this.request<{ uploadToken: string; expiresIn: number }>(
      `${API_ENDPOINTS.CLOUD_CONNECTORS}/upload-token`,
      { method: 'POST', body: JSON.stringify({ platform, productCount }) },
    );
  }

  async logJob(payload: CloudJobPayload) {
    return this.request<{ success: boolean; job: { _id: string } }>('/v1/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateJob(jobId: string, payload: Partial<CloudJobPayload> & Record<string, unknown>) {
    return this.request<{ success: boolean; job: { _id: string } }>(`/v1/jobs/${jobId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async getJob(jobId: string) {
    return this.request<{
      job: Record<string, unknown> & { _id: string };
      products: CloudProductPayload[];
      productCount: number;
    }>(`/v1/jobs/${jobId}`);
  }

  async appendProducts(jobId: string, products: CloudProductPayload[]) {
    return this.request<{ success: boolean; saved: number }>(`/v1/jobs/${jobId}/products`, {
      method: 'POST',
      body: JSON.stringify({ products }),
    });
  }

  async deleteJob(jobId: string) {
    return this.request<{ success: boolean; deleted: boolean }>(`/v1/jobs/${jobId}`, {
      method: 'DELETE',
    });
  }

  async exportJob(jobId: string, format: 'json' | 'csv' = 'json'): Promise<{ blob: Blob; filename: string }> {
    const headers: Record<string, string> = {};
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;

    const res = await fetch(`${this.baseUrl}/v1/jobs/${jobId}/export?format=${format}`, {
      headers,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const filename =
      format === 'csv' ? `fetcher-run-${jobId}.csv` : `fetcher-run-${jobId}.json`;
    return { blob, filename };
  }

  async getProjects() {
    return this.request<{ projects: Array<{ _id: string; name: string; description?: string }> }>(
      '/v1/projects',
    );
  }

  async createProject(name: string, description?: string) {
    return this.request<{ project: { _id: string; name: string } }>('/v1/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  async ensureDefaultProject(): Promise<string> {
    const { projects } = await this.getProjects();
    const first = projects[0];
    if (first) return first._id;
    const { project } = await this.createProject('Project 1', 'Auto-created workspace');
    return project._id;
  }
}

export const cloudApi = new CloudApiClient();
