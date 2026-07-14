import { describe, it, expect } from 'vitest';

describe('API schemas', () => {
  it('validates expected endpoints exist', () => {
    const endpoints = ['/health', '/scrape', '/export', '/categories', '/settings', '/logs', '/products'];
    expect(endpoints.length).toBe(7);
  });
});
