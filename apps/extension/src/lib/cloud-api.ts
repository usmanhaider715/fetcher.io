import { API_ENDPOINTS, DEFAULT_CLOUD_API_URL } from '@fetcher/shared';

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
      throw new Error(body.error ?? `Cloud API error ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  async validateLicense(key?: string) {
    const qs = key ? `?key=${encodeURIComponent(key)}` : '';
    return this.request<{ valid: boolean; plan: string; features: string[] }>(
      `${API_ENDPOINTS.CLOUD_AUTH}/license/validate${qs}`,
    );
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

  async logJob(metadata: Record<string, unknown>) {
    return this.request<{ success: boolean }>('/v1/jobs', {
      method: 'POST',
      body: JSON.stringify(metadata),
    });
  }
}

export const cloudApi = new CloudApiClient();
