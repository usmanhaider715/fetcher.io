import { describe, it, expect } from 'vitest';
import { SelectorEngine } from './engine.js';

describe('SelectorEngine', () => {
  const engine = new SelectorEngine();

  it('generates CSS selector for element', () => {
    const doc = new DOMParser().parseFromString(
      '<html><body><div id="product"><h1 class="title">Test</h1></div></body></html>',
      'text/html',
    );
    const el = doc.querySelector('h1');
    expect(el).toBeTruthy();
    if (el) {
      const selector = engine.generateCssSelector(el);
      expect(selector).toContain('h1');
    }
  });

  it('queries with CSS selector rule', () => {
    const doc = new DOMParser().parseFromString(
      '<html><body><span class="price">$29.99</span></body></html>',
      'text/html',
    );
    const result = engine.query(doc, { type: 'css', value: '.price' });
    expect(result).toBe('$29.99');
  });

  it('uses fallback chain', () => {
    const doc = new DOMParser().parseFromString(
      '<html><body><span class="fallback">Found</span></body></html>',
      'text/html',
    );
    const result = engine.query(doc, {
      type: 'css',
      value: '.missing',
      fallbacks: [{ type: 'css', value: '.fallback' }],
    });
    expect(result).toBe('Found');
  });
});
