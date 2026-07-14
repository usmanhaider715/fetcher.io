import type { Platform, Product } from './index.js';

export interface IAdapter {
  readonly platform: Platform;
  readonly name: string;
  readonly domains: string[];

  detect(document: Document, url: string): boolean;
  findProducts(document: Document, url: string): string[];
  findProduct(document: Document, url: string): Product | null;
  extract(document: Document, url: string): Product;
  parseImages(document: Document, product: Product): ProductImage[];
  parseVariants(document: Document, product: Product): ProductVariant[];
  parseDescription(document: Document, product: Product): string;
  parseSpecifications(document: Document, product: Product): Record<string, string>;
}

export interface ProductImage {
  url: string;
  alt?: string;
  position?: number;
  isCover?: boolean;
}

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

export interface AdapterContext {
  document: Document;
  url: string;
  html?: string;
}

export interface AdapterDetectionResult {
  platform: Platform;
  confidence: number;
  adapterId: string;
}
