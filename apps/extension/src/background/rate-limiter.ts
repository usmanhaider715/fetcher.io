import { delay } from '@fetcher/shared';

interface DomainState {
  consecutiveFailures: number;
  backoffMs: number;
  lastRequestAt: number;
  blocked: boolean;
}

export class RateLimiter {
  private domains = new Map<string, DomainState>();
  private defaultDelayMs: number;

  constructor(defaultDelayMs = 1000) {
    this.defaultDelayMs = defaultDelayMs;
  }

  private getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  private state(url: string): DomainState {
    const domain = this.getDomain(url);
    if (!this.domains.has(domain)) {
      this.domains.set(domain, {
        consecutiveFailures: 0,
        backoffMs: this.defaultDelayMs,
        lastRequestAt: 0,
        blocked: false,
      });
    }
    return this.domains.get(domain)!;
  }

  isBlocked(url: string): boolean {
    return this.state(url).blocked;
  }

  async wait(url: string, crawlDelayMs?: number): Promise<void> {
    const s = this.state(url);
    if (s.blocked) {
      throw new Error(`Domain ${this.getDomain(url)} is rate-limited — wait before retrying`);
    }

    const minDelay = crawlDelayMs ?? s.backoffMs;
    const elapsed = Date.now() - s.lastRequestAt;
    if (elapsed < minDelay) {
      await delay(minDelay - elapsed);
    }
    s.lastRequestAt = Date.now();
  }

  recordSuccess(url: string): void {
    const s = this.state(url);
    s.consecutiveFailures = 0;
    s.backoffMs = this.defaultDelayMs;
    s.blocked = false;
  }

  recordFailure(url: string, status?: number): string {
    const s = this.state(url);
    s.consecutiveFailures++;

    if (status === 429 || status === 403) {
      s.backoffMs = Math.min(s.backoffMs * 2, 30000);
    } else {
      s.backoffMs = Math.min(s.backoffMs * 1.5, 15000);
    }

    if (s.consecutiveFailures >= 5) {
      s.blocked = true;
      return `${this.getDomain(url)} blocked after ${s.consecutiveFailures} failures — session paused`;
    }

    return `${this.getDomain(url)} slowing down (${Math.round(s.backoffMs)}ms delay)`;
  }

  unblock(url: string): void {
    const s = this.state(url);
    s.blocked = false;
    s.consecutiveFailures = 0;
    s.backoffMs = this.defaultDelayMs;
  }
}

export const rateLimiter = new RateLimiter(1000);
