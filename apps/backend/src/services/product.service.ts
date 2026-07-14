import { createHash } from 'node:crypto';
import type { Product, ProductIdFormat } from '@fetcher/shared';
import { normalizeImageUrl, sanitizeFilename } from '@fetcher/shared';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { settingsService } from './settings.service.js';

export class ProductIdService {
  private counters = new Map<string, number>();

  async generate(
    categorySlug?: string,
    subcategorySlug?: string,
    format?: ProductIdFormat,
  ): Promise<string> {
    const settings = await settingsService.get();
    const idFormat = format ?? settings.productIdFormat;

    if (idFormat === 'uuid') {
      return uuidv4();
    }

    const catCode = (categorySlug ?? 'GEN').slice(0, 2).toUpperCase();
    const subCode = (subcategorySlug ?? 'PR').slice(0, 2).toUpperCase();
    const key = `${catCode}-${subCode}`;

    if (!this.counters.has(key)) {
      const count = await prisma.product.count({
        where: { uniqueId: { startsWith: key } },
      });
      this.counters.set(key, count);
    }

    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);

    return `${key}-${String(next).padStart(6, '0')}`;
  }
}

export class DuplicateService {
  async isDuplicate(
    product: Product,
    settings: {
      sku: boolean;
      url: boolean;
      hash: boolean;
      imageHash: boolean;
      titleSimilarity: boolean;
    },
    sessionId?: string,
  ): Promise<{ isDuplicate: boolean; reason?: string; existingId?: string }> {
    const sessionScope = sessionId ? { sessionId } : {};

    if (settings.sku && product.sku) {
      const existing = await prisma.product.findFirst({
        where: { sku: product.sku, ...sessionScope },
      });
      if (existing) return { isDuplicate: true, reason: 'sku', existingId: existing.id };
    }

    if (settings.url && product.productUrl) {
      const existing = await prisma.product.findFirst({
        where: { productUrl: product.productUrl, ...sessionScope },
      });
      if (existing) return { isDuplicate: true, reason: 'url', existingId: existing.id };
    }

    if (settings.hash && product.hash) {
      const existing = await prisma.product.findFirst({
        where: { hash: product.hash, ...sessionScope },
      });
      if (existing) return { isDuplicate: true, reason: 'hash', existingId: existing.id };
    }

    if (settings.imageHash && product.imageUrls?.length) {
      const primaryUrl = normalizeImageUrl(product.imageUrls[0]!);
      const sessionProducts = await prisma.product.findMany({
        where: sessionScope,
        select: { id: true },
      });
      if (sessionProducts.length > 0 && primaryUrl) {
        const match = await prisma.image.findFirst({
          where: {
            url: primaryUrl,
            productId: { in: sessionProducts.map((p) => p.id) },
          },
        });
        if (match) {
          return { isDuplicate: true, reason: 'imageHash', existingId: match.productId };
        }
      }
    }

    if (settings.titleSimilarity && product.title) {
      const candidates = await prisma.product.findMany({
        where: { title: { not: null }, ...sessionScope },
        select: { id: true, title: true },
        take: 200,
      });
      for (const candidate of candidates) {
        if (!candidate.title) continue;
        if (titleSimilarityScore(product.title, candidate.title) >= 0.85) {
          return { isDuplicate: true, reason: 'titleSimilarity', existingId: candidate.id };
        }
      }
    }

    return { isDuplicate: false };
  }
}

function titleSimilarityScore(a: string, b: string): number {
  const na = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const nb = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  if (na === nb) return 1;
  const wordsA = new Set(na.split(/\s+/).filter(Boolean));
  const wordsB = new Set(nb.split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

export function computeProductHash(product: Product): string {
  const data = [
    product.title,
    product.sku,
    product.productUrl,
    product.price?.toString(),
  ]
    .filter(Boolean)
    .join('|');
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

export function productToDbFields(product: Product, uniqueId: string, sessionId?: string) {
  return {
    uniqueId,
    website: product.website ?? null,
    supplier: product.supplier ?? null,
    brand: product.brand ?? null,
    title: product.title ?? null,
    subtitle: product.subtitle ?? null,
    description: product.description ?? null,
    htmlDescription: product.htmlDescription ?? null,
    shortDescription: product.shortDescription ?? null,
    price: product.price ?? null,
    salePrice: product.salePrice ?? null,
    currency: product.currency ?? null,
    discount: product.discount ?? null,
    sku: product.sku ?? null,
    barcode: product.barcode ?? null,
    stock: product.stock ?? null,
    availability: product.availability ?? null,
    rating: product.rating ?? null,
    reviewCount: product.reviewCount ?? null,
    tags: product.tags ? JSON.stringify(product.tags) : null,
    collections: product.collections ? JSON.stringify(product.collections) : null,
    variants: product.variants ? JSON.stringify(product.variants) : null,
    colors: product.colors ? JSON.stringify(product.colors) : null,
    sizes: product.sizes ? JSON.stringify(product.sizes) : null,
    weight: product.weight ?? null,
    dimensions: product.dimensions ?? null,
    material: product.material ?? null,
    country: product.country ?? null,
    shipping: product.shipping ?? null,
    videos: product.videos ? JSON.stringify(product.videos) : null,
    documents: product.documents ? JSON.stringify(product.documents) : null,
    faqs: product.faqs ? JSON.stringify(product.faqs) : null,
    metaTitle: product.metaTitle ?? null,
    metaDescription: product.metaDescription ?? null,
    canonicalUrl: product.canonicalUrl ?? null,
    seoKeywords: product.seoKeywords ? JSON.stringify(product.seoKeywords) : null,
    breadcrumbs: product.breadcrumbs ? JSON.stringify(product.breadcrumbs) : null,
    createdDate: product.createdDate ?? null,
    updatedDate: product.updatedDate ?? null,
    productUrl: product.productUrl ?? null,
    imageCount: product.imageUrls?.length ?? product.images?.length ?? 0,
    specifications: product.specifications ? JSON.stringify(product.specifications) : null,
    attributes: product.attributes ? JSON.stringify(product.attributes) : null,
    customFields: product.customFields ? JSON.stringify(product.customFields) : null,
    platform: product.platform ?? null,
    hash: product.hash ?? computeProductHash(product),
    sessionId: sessionId ?? null,
  };
}

export function dbProductToProduct(
  record: {
    title?: string | null;
    description?: string | null;
    shortDescription?: string | null;
    price?: number | null;
    salePrice?: number | null;
    sku?: string | null;
    brand?: string | null;
    productUrl?: string | null;
    platform?: string | null;
    uniqueId?: string;
    images?: Array<{ url: string; alt?: string | null; position?: number; isCover?: boolean }>;
  },
): Product {
  const imageUrls = record.images?.map((i) => i.url) ?? [];
  return {
    uniqueId: record.uniqueId,
    title: record.title ?? undefined,
    description: record.description ?? undefined,
    shortDescription: record.shortDescription ?? undefined,
    price: record.price ?? undefined,
    salePrice: record.salePrice ?? undefined,
    sku: record.sku ?? undefined,
    brand: record.brand ?? undefined,
    productUrl: record.productUrl ?? undefined,
    platform: record.platform as Product['platform'],
    imageUrls,
    images: record.images?.map((img, i) => ({
      url: img.url,
      alt: img.alt ?? undefined,
      position: img.position ?? i,
      isCover: img.isCover ?? i === 0,
    })),
    imageCount: imageUrls.length,
  };
}

export function buildFolderName(uniqueId: string, title?: string): string {
  if (title) {
    const safe = sanitizeFilename(title).slice(0, 50);
    return `${uniqueId}_${safe}`;
  }
  return uniqueId;
}

export const productIdService = new ProductIdService();
export const duplicateService = new DuplicateService();
