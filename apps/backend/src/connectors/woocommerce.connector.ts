import type { Product } from '@fetcher/shared';

export interface WooConfig {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface PushResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export class WooCommerceConnector {
  async pushProduct(product: Product, config: WooConfig): Promise<PushResult> {
    if (!config.storeUrl || !config.consumerKey || !config.consumerSecret) {
      return { success: false, error: 'WooCommerce credentials not configured' };
    }

    const base = config.storeUrl.replace(/\/$/, '');
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    const payload = {
      name: product.title ?? 'Untitled',
      type: 'simple',
      regular_price: String(product.price ?? 0),
      sale_price: product.salePrice ? String(product.salePrice) : undefined,
      description: product.description ?? '',
      short_description: product.shortDescription ?? '',
      sku: product.sku ?? undefined,
      images: (product.imageUrls ?? []).map((src) => ({ src })),
    };

    try {
      const response = await fetch(`${base}/wp-json/wc/v3/products`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `WooCommerce API ${response.status}: ${text.slice(0, 200)}` };
      }

      const data = (await response.json()) as { id?: number };
      return { success: true, externalId: String(data.id ?? '') };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'WooCommerce push failed',
      };
    }
  }
}

export const wooCommerceConnector = new WooCommerceConnector();
