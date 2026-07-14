import { describe, it, expect } from 'vitest';
import { slugify, sanitizeFilename, isValidUrl, parsePrice, getDomain } from './index.js';

describe('shared utils', () => {
  it('slugify converts text to slug', () => {
    expect(slugify('Electronics & Phones')).toBe('electronics-phones');
  });

  it('sanitizeFilename removes invalid chars', () => {
    expect(sanitizeFilename('test<>file.txt')).toBe('test__file.txt');
  });

  it('isValidUrl validates URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('not-a-url')).toBe(false);
  });

  it('parsePrice extracts numbers', () => {
    expect(parsePrice('$29.99')).toBe(29.99);
    expect(parsePrice('1,299.00')).toBe(1299);
  });

  it('getDomain extracts hostname', () => {
    expect(getDomain('https://www.shopify.com/products/test')).toBe('shopify.com');
  });
});
