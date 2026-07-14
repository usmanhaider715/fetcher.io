export interface RobotsRules {
  disallowed: string[];
  crawlDelayMs: number;
  allowed: boolean;
}

export function parseRobotsTxt(text: string, userAgent = '*'): RobotsRules {
  const lines = text.split(/\r?\n/);
  const groups: Array<{ agents: string[]; rules: RobotsRules }> = [];
  let current: { agents: string[]; rules: RobotsRules } | null = null;

  for (const raw of lines) {
    const line = raw.split('#')[0]?.trim() ?? '';
    if (!line) continue;

    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const k = key?.trim().toLowerCase();

    if (k === 'user-agent') {
      if (current) groups.push(current);
      current = { agents: [value.toLowerCase()], rules: { disallowed: [], crawlDelayMs: 1000, allowed: true } };
    } else if (current && k === 'disallow' && value) {
      current.rules.disallowed.push(value);
    } else if (current && k === 'crawl-delay') {
      const delay = parseFloat(value);
      if (!Number.isNaN(delay)) current.rules.crawlDelayMs = Math.max(delay * 1000, 500);
    }
  }
  if (current) groups.push(current);

  const match =
    groups.find((g) => g.agents.includes(userAgent.toLowerCase())) ??
    groups.find((g) => g.agents.includes('*'));

  return match?.rules ?? { disallowed: [], crawlDelayMs: 1000, allowed: true };
}

export function isPathAllowed(path: string, rules: RobotsRules): boolean {
  if (rules.disallowed.some((d) => d === '/' && path !== '/')) return false;
  return !rules.disallowed.some((d) => d && d !== '/' && path.startsWith(d));
}

export async function fetchRobotsRules(origin: string): Promise<RobotsRules> {
  try {
    const res = await fetch(`${origin}/robots.txt`, { credentials: 'omit' });
    if (!res.ok) return { disallowed: [], crawlDelayMs: 1000, allowed: true };
    const text = await res.text();
    return parseRobotsTxt(text);
  } catch {
    return { disallowed: [], crawlDelayMs: 1000, allowed: true };
  }
}
