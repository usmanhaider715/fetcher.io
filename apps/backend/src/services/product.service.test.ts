import { describe, it, expect } from 'vitest';
import { computeProductHash } from './product.service.js';

describe('product service', () => {
  it('computeProductHash generates consistent hash', () => {
    const hash1 = computeProductHash({ title: 'Test', sku: 'ABC', productUrl: 'https://x.com' });
    const hash2 = computeProductHash({ title: 'Test', sku: 'ABC', productUrl: 'https://x.com' });
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(16);
  });
});
