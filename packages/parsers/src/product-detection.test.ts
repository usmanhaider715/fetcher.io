import { describe, it, expect } from 'vitest';
import { SchemaOrgParser, OpenGraphParser } from './product-detection.js';

describe('SchemaOrgParser', () => {
  it('parses JSON-LD product', () => {
    const doc = new DOMParser().parseFromString(
      `<html><head>
        <script type="application/ld+json">
          {"@type":"Product","name":"Test Product","sku":"ABC123","offers":{"price":"29.99","priceCurrency":"USD"}}
        </script>
      </head><body></body></html>`,
      'text/html',
    );
    const parser = new SchemaOrgParser();
    const product = parser.parse(doc, 'https://example.com/product');
    expect(product?.title).toBe('Test Product');
    expect(product?.sku).toBe('ABC123');
    expect(product?.price).toBe(29.99);
  });
});

describe('OpenGraphParser', () => {
  it('parses og meta tags', () => {
    const doc = new DOMParser().parseFromString(
      `<html><head>
        <meta property="og:title" content="OG Product" />
        <meta property="og:type" content="product" />
        <meta property="og:image" content="https://example.com/img.jpg" />
        <meta property="product:price:amount" content="49.99" />
      </head><body></body></html>`,
      'text/html',
    );
    const parser = new OpenGraphParser();
    const product = parser.parse(doc, 'https://example.com/product');
    expect(product?.title).toBe('OG Product');
    expect(product?.price).toBe(49.99);
    expect(product?.imageUrls).toContain('https://example.com/img.jpg');
  });
});
