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
    this.register(
      new ShopifyAdapter(),
      new WooCommerceAdapter(),
      new AmazonAdapter(),
      new EbayAdapter(),
      new EtsyAdapter(),
      new AliExpressAdapter(),
      new BigCommerceAdapter(),
      new MagentoAdapter(),
      new TemuAdapter(),
      new AlibabaAdapter(),
      new PrestaShopAdapter(),
      new OpenCartAdapter(),
      new CjDropshippingAdapter(),
      new SpocketAdapter(),
      new WalmartAdapter(),
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
    for (const adapter of this.adapters) {
      if (adapter.detect(document, url)) return adapter;
    }

    const platform = detectPlatformFromDocument(document, url);
    const match = this.adapters.find((a) => a.platform === platform);
    return match ?? this.generic;
  }

  getByPlatform(platform: Platform): IAdapter {
    return this.adapters.find((a) => a.platform === platform) ?? this.generic;
  }

  getAll(): IAdapter[] {
    return [...this.adapters, this.generic];
  }
}

export const adapterRegistry = new AdapterRegistry();
