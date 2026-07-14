import type { SelectorRule } from '@fetcher/shared';

function escapeCss(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

export class SelectorEngine {
  query(document: Document, rule: SelectorRule, context?: Element): string | null {
    const chain = [rule, ...(rule.fallbacks ?? [])];

    for (const r of chain) {
      const result = this.executeRule(document, r, context);
      if (result) return result;
    }

    return null;
  }

  queryAll(document: Document, rule: SelectorRule, context?: Element): string[] {
    const chain = [rule, ...(rule.fallbacks ?? [])];

    for (const r of chain) {
      const results = this.executeRuleAll(document, r, context);
      if (results.length > 0) return results;
    }

    return [];
  }

  queryElements(document: Document, rule: SelectorRule, context?: Element): Element[] {
    const chain = [rule, ...(rule.fallbacks ?? [])];

    for (const r of chain) {
      const elements = this.executeElements(document, r, context);
      if (elements.length > 0) return elements;
    }

    return [];
  }

  private executeRule(document: Document, rule: SelectorRule, context?: Element): string | null {
    const elements = this.executeElements(document, rule, context);
    if (elements.length === 0) return null;

    const el = elements[0];
    if (!el) return null;

    return this.extractValue(el, rule);
  }

  private executeRuleAll(document: Document, rule: SelectorRule, context?: Element): string[] {
    return this.executeElements(document, rule, context)
      .map((el) => this.extractValue(el, rule))
      .filter((v): v is string => v !== null && v !== '');
  }

  private executeElements(document: Document, rule: SelectorRule, context?: Element): Element[] {
    const root = context ?? document;

    switch (rule.type) {
      case 'css': {
        const scope = rule.parent
          ? root.querySelector(rule.parent)
          : root;
        if (!scope) return [];
        return Array.from(scope.querySelectorAll(rule.value));
      }

      case 'xpath': {
        const scope = context ?? document;
        const result = document.evaluate(
          rule.value,
          scope,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null,
        );
        const elements: Element[] = [];
        for (let i = 0; i < result.snapshotLength; i++) {
          const node = result.snapshotItem(i);
          if (node instanceof Element) elements.push(node);
        }
        return elements;
      }

      case 'attribute': {
        const elements = Array.from(root.querySelectorAll('*'));
        return elements.filter((el) => {
          const attr = rule.attribute ?? 'class';
          const val = el.getAttribute(attr);
          if (!val) return false;
          if (rule.value.startsWith('/') && rule.value.endsWith('/')) {
            const regex = new RegExp(rule.value.slice(1, -1));
            return regex.test(val);
          }
          return val.includes(rule.value);
        });
      }

      case 'regex':
      case 'text': {
        const elements = Array.from(root.querySelectorAll('*'));
        const regex = new RegExp(rule.value, 'i');
        return elements.filter((el) => {
          const text = el.textContent?.trim() ?? '';
          return regex.test(text) && el.children.length === 0;
        });
      }

      default:
        return [];
    }
  }

  private extractValue(element: Element, rule: SelectorRule): string | null {
    if (rule.attribute) {
      if (rule.attribute === 'text' || rule.attribute === 'textContent') {
        return element.textContent?.trim() ?? null;
      }
      if (rule.attribute === 'html' || rule.attribute === 'innerHTML') {
        return element.innerHTML.trim();
      }
      if (rule.attribute === 'src' && element instanceof HTMLImageElement) {
        return element.src || element.dataset['src'] || null;
      }
      if (rule.attribute === 'href' && element instanceof HTMLAnchorElement) {
        return element.href;
      }
      return element.getAttribute(rule.attribute);
    }

    if (element instanceof HTMLImageElement) {
      return element.src || element.dataset['src'] || element.getAttribute('srcset')?.split(' ')[0] || null;
    }

    if (element instanceof HTMLAnchorElement) {
      return element.href;
    }

    if (element instanceof HTMLInputElement) {
      return element.value;
    }

    const text = element.textContent?.trim();
    if (text) return text;

    return element.getAttribute('content') ?? element.getAttribute('value') ?? null;
  }

  generateCssSelector(element: Element): string {
    if (element.id) return `#${escapeCss(element.id)}`;

    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(Boolean).slice(0, 2);
        if (classes.length) selector += '.' + classes.map((c) => escapeCss(c)).join('.');
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === current!.tagName);
        if (siblings.length > 1) {
          selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }
}

export const selectorEngine = new SelectorEngine();
