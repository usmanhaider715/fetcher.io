import type { Product } from '@fetcher/shared';
import { extractJsonLdProducts, getMetaContent, getDomain, parsePrice } from '@fetcher/shared';

interface JsonLdProduct {
  '@type'?: string;
  name?: string;
  description?: string;
  sku?: string;
  brand?: string | { name?: string };
  image?: string | string[] | { url?: string }[];
  offers?: {
    price?: string | number;
    lowPrice?: string | number;
    highPrice?: string | number;
    priceCurrency?: string;
    availability?: string;
  };
  aggregateRating?: { ratingValue?: string | number; reviewCount?: string | number };
  gtin?: string;
  mpn?: string;
}

export class SchemaOrgParser {
  parse(document: Document, url: string): Product | null {
    const items = extractJsonLdProducts(document) as JsonLdProduct[];
    if (items.length === 0) return null;

    const item = items[0];
    if (!item) return null;

    const brand =
      typeof item.brand === 'string' ? item.brand : item.brand?.name;

    const images = this.parseImages(item.image);
    const offer = item.offers;

    return {
      title: item.name,
      description: item.description,
      sku: item.sku ?? item.gtin ?? item.mpn,
      brand,
      barcode: item.gtin,
      price: offer?.price ? parsePrice(String(offer.price)) ?? undefined : undefined,
      salePrice: offer?.lowPrice ? parsePrice(String(offer.lowPrice)) ?? undefined : undefined,
      currency: offer?.priceCurrency,
      availability: offer?.availability,
      rating: item.aggregateRating?.ratingValue
        ? Number(item.aggregateRating.ratingValue)
        : undefined,
      reviewCount: item.aggregateRating?.reviewCount
        ? Number(item.aggregateRating.reviewCount)
        : undefined,
      imageUrls: images,
      images: images.map((url, i) => ({ url, position: i, isCover: i === 0 })),
      productUrl: url,
      website: getDomain(url),
      scrapedDate: new Date().toISOString(),
    };
  }

  private parseImages(image: JsonLdProduct['image']): string[] {
    if (!image) return [];
    if (typeof image === 'string') return [image];
    if (Array.isArray(image)) {
      return image
        .map((img) => (typeof img === 'string' ? img : img.url))
        .filter((u): u is string => !!u);
    }
    return [];
  }
}

export class OpenGraphParser {
  parse(document: Document, url: string): Product | null {
    const title = getMetaContent(document, 'og:title');
    const type = getMetaContent(document, 'og:type');

    if (!title && type !== 'product') return null;

    const image = getMetaContent(document, 'og:image');
    const price = getMetaContent(document, 'product:price:amount');
    const currency = getMetaContent(document, 'product:price:currency');

    return {
      title: title ?? undefined,
      description: getMetaContent(document, 'og:description') ?? undefined,
      productUrl: getMetaContent(document, 'og:url') ?? url,
      imageUrls: image ? [image] : [],
      images: image ? [{ url: image, isCover: true }] : [],
      price: price ? parsePrice(price) ?? undefined : undefined,
      currency: currency ?? undefined,
      brand: getMetaContent(document, 'product:brand') ?? undefined,
      website: getDomain(url),
      scrapedDate: new Date().toISOString(),
    };
  }
}

export class MetaTagParser {
  parse(document: Document, url: string): Partial<Product> {
    return {
      metaTitle: getMetaContent(document, 'title') ?? document.title,
      metaDescription: getMetaContent(document, 'description') ?? undefined,
      canonicalUrl:
        document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? url,
      productUrl: url,
      website: getDomain(url),
    };
  }
}

export class ProductDetectionPipeline {
  private schemaOrg = new SchemaOrgParser();
  private openGraph = new OpenGraphParser();
  private metaTags = new MetaTagParser();

  detect(document: Document, url: string): Product | null {
    const schema = this.schemaOrg.parse(document, url);
    if (schema?.title) return { ...this.metaTags.parse(document, url), ...schema };

    const og = this.openGraph.parse(document, url);
    if (og?.title) return { ...this.metaTags.parse(document, url), ...og };

    return null;
  }
}

export const productDetectionPipeline = new ProductDetectionPipeline();
