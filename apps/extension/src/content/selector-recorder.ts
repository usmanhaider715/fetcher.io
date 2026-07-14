import type { SelectorMap, SelectorRule } from '@fetcher/shared';

type SelectorField =
  | 'productCard'
  | 'title'
  | 'price'
  | 'salePrice'
  | 'image'
  | 'description'
  | 'sku'
  | 'brand';

const FIELD_LABELS: Record<SelectorField, string> = {
  productCard: 'Product Card',
  title: 'Title',
  price: 'Price',
  salePrice: 'Sale Price',
  image: 'Image',
  description: 'Description',
  sku: 'SKU',
  brand: 'Brand',
};

export class SelectorRecorder {
  private isRecording = false;
  private currentField: SelectorField | null = null;
  private selectors: SelectorMap = {};
  private overlay: HTMLDivElement | null = null;
  private highlight: HTMLDivElement | null = null;
  private panel: HTMLDivElement | null = null;

  start(): void {
    if (this.isRecording) return;
    this.isRecording = true;
    this.selectors = {};
    this.createOverlay();
    this.createPanel();
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true);
  }

  stop(): void {
    this.isRecording = false;
    this.currentField = null;
    this.removeOverlay();
    this.removePanel();
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick, true);
  }

  getSelectors(): SelectorMap {
    return { ...this.selectors };
  }

  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.id = 'fetcher-recorder-overlay';
    Object.assign(this.overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483646',
      pointerEvents: 'none',
    });

    this.highlight = document.createElement('div');
    Object.assign(this.highlight.style, {
      position: 'absolute',
      border: '2px solid #8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.15)',
      borderRadius: '4px',
      transition: 'all 0.1s ease',
      display: 'none',
      pointerEvents: 'none',
    });

    this.overlay.appendChild(this.highlight);
    document.body.appendChild(this.overlay);
  }

  private createPanel(): void {
    this.panel = document.createElement('div');
    this.panel.id = 'fetcher-recorder-panel';
    Object.assign(this.panel.style, {
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: '2147483647',
      background: 'rgba(15, 15, 20, 0.95)',
      color: '#fff',
      padding: '16px',
      borderRadius: '12px',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '13px',
      minWidth: '220px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      border: '1px solid rgba(255,255,255,0.1)',
    });

    const title = document.createElement('div');
    title.textContent = 'Selector Recorder';
    Object.assign(title.style, {
      fontWeight: '600',
      marginBottom: '12px',
      fontSize: '14px',
    });
    this.panel.appendChild(title);

    const fields: SelectorField[] = [
      'productCard',
      'title',
      'price',
      'image',
      'description',
      'sku',
      'brand',
    ];

    fields.forEach((field) => {
      const btn = document.createElement('button');
      btn.textContent = FIELD_LABELS[field];
      btn.dataset['field'] = field;
      Object.assign(btn.style, {
        display: 'block',
        width: '100%',
        padding: '8px 12px',
        marginBottom: '6px',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.05)',
        color: '#fff',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: '12px',
      });

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.currentField = field;
        this.updatePanelActiveState();
      });

      this.panel!.appendChild(btn);
    });

    document.body.appendChild(this.panel);
  }

  private updatePanelActiveState(): void {
    if (!this.panel) return;
    const buttons = this.panel.querySelectorAll('button');
    buttons.forEach((btn) => {
      const field = btn.dataset['field'] as SelectorField;
      if (field === this.currentField) {
        btn.style.background = 'rgba(139, 92, 246, 0.3)';
        btn.style.borderColor = '#8b5cf6';
      } else {
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.borderColor = 'rgba(255,255,255,0.15)';
      }
    });
  }

  private removeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.highlight = null;
  }

  private removePanel(): void {
    this.panel?.remove();
    this.panel = null;
  }

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.isRecording || !this.highlight) return;

    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || this.isFetcherElement(target)) {
      this.highlight.style.display = 'none';
      return;
    }

    const rect = target.getBoundingClientRect();
    Object.assign(this.highlight.style, {
      display: 'block',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  };

  private handleClick = (e: MouseEvent): void => {
    if (!this.isRecording || !this.currentField) return;

    const target = e.target as Element;
    if (this.isFetcherElement(target)) return;

    e.preventDefault();
    e.stopPropagation();

    const selector = this.generateSelector(target);
    const rule: SelectorRule = {
      type: 'css',
      value: selector,
    };

    this.selectors[this.currentField] = rule;
    this.currentField = null;
    this.updatePanelActiveState();

    chrome.runtime.sendMessage({
      type: 'SCRAPE_LOG',
      payload: {
        id: Date.now().toString(),
        level: 'success',
        message: `Recorded selector: ${selector}`,
        timestamp: new Date().toISOString(),
      },
    }).catch(() => {});
  };

  private isFetcherElement(el: Element): boolean {
    return !!el.closest('#fetcher-recorder-overlay, #fetcher-recorder-panel');
  }

  private generateSelector(element: Element): string {
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }

    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.className && typeof current.className === 'string') {
        const classes = current.className
          .trim()
          .split(/\s+/)
          .filter((c) => c && !c.startsWith('fetcher-'))
          .slice(0, 2);
        if (classes.length > 0) {
          selector += '.' + classes.map((c) => CSS.escape(c)).join('.');
        }
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (child) => child.tagName === current!.tagName,
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }
}
