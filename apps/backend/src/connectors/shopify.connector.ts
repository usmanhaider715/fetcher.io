import type { Product } from '@fetcher/shared';

export interface ConnectorConfig {
  storeUrl: string;
  accessToken: string;
}

export interface PushResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export class ShopifyConnector {
  async pushProduct(product: Product, config: ConnectorConfig): Promise<PushResult> {
    if (!config.storeUrl || !config.accessToken) {
      return { success: false, error: 'Shopify credentials not configured' };
    }

    const base = config.storeUrl.replace(/\/$/, '');
    const payload = {
      product: {
        title: product.title ?? 'Untitled',
        body_html: product.description ?? '',
        vendor: product.brand ?? '',
        product_type: product.category ?? '',
        variants: [
          {
            price: String(product.salePrice ?? product.price ?? 0),
            sku: product.sku ?? undefined,
          },
        ],
        images: (product.imageUrls ?? []).map((src) => ({ src })),
      },
    };

    try {
      const response = await fetch(`${base}/admin/api/2024-01/products.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': config.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `Shopify API ${response.status}: ${text.slice(0, 200)}` };
      }

      const data = (await response.json()) as { product?: { id?: number } };
      return { success: true, externalId: String(data.product?.id ?? '') };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Shopify push failed',
      };
    }
  }
}

export const shopifyConnector = new ShopifyConnector();
