import type { IAdapter } from '@fetcher/shared';
import type { Platform } from '@fetcher/shared';
import { ADAPTER_FLAGS, detectPlatformFromDocument } from '@fetcher/shared';
import { GenericAdapter } from './platform.adapters';
import {
  ShopifyAdapter,
  WooCommerceAdapter,
  AmazonAdapter,
  EbayAdapter,
  EtsyAdapter,
  AliExpressAdapter,
  BigCommerceAdapter,
  MagentoAdapter,
  TemuAdapter,
  AlibabaAdapter,
  PrestaShopAdapter,
  OpenCartAdapter,
  CjDropshippingAdapter,
  SpocketAdapter,
  WalmartAdapter,
} from './platform.adapters';

export class AdapterRegistry {
  private adapters: IAdapter[] = [];
  private generic = new GenericAdapter();

  constructor() {
    // Domain marketplaces FIRST — CMS detectors (Woo/Shopify) false-positive on
    // sites that merely mention those platforms in marketing HTML.
    this.register(
      new AmazonAdapter(),
      new EbayAdapter(),
      new EtsyAdapter(),
      new AliExpressAdapter(),
      new TemuAdapter(),
      new AlibabaAdapter(),
      new CjDropshippingAdapter(),
      new SpocketAdapter(),
      new WalmartAdapter(),
      new ShopifyAdapter(),
      new WooCommerceAdapter(),
      new BigCommerceAdapter(),
      new MagentoAdapter(),
      new PrestaShopAdapter(),
      new OpenCartAdapter(),
    );
  }

  register(...adapters: IAdapter[]): void {
    for (const adapter of adapters) {
      const flag = ADAPTER_FLAGS[adapter.platform];
      if (flag === false) continue;
      this.adapters.push(adapter);
    }
  }

  detect(document: Document, url: string): IAdapter {
    // Prefer hostname map before any HTML heuristic
    const fromUrl = detectPlatformFromDocument(document, url);
    if (fromUrl !== 'generic') {
      const byPlatform = this.adapters.find((a) => a.platform === fromUrl);
      if (byPlatform) return byPlatform;
    }

    for (const adapter of this.adapters) {
      if (adapter.detect(document, url)) return adapter;
    }

    return this.generic;
  }

  getByPlatform(platform: Platform): IAdapter {
    return this.adapters.find((a) => a.platform === platform) ?? this.generic;
  }

  getAll(): IAdapter[] {
    return [...this.adapters, this.generic];
  }
}

export const adapterRegistry = new AdapterRegistry();
