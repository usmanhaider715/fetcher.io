import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { prisma } from '../lib/prisma.js';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const attempt = scryptSync(password, salt, 64).toString('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
  } catch {
    return false;
  }
}

function generateLicenseKey(): string {
  return `FETCHER-${randomBytes(12).toString('hex').toUpperCase()}`;
}

export class AuthService {
  async register(email: string, password: string, name?: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error('Email already registered');

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        name: name ?? null,
        plan: 'free',
      },
    });

    const license = await prisma.license.create({
      data: {
        userId: user.id,
        key: generateLicenseKey(),
        plan: 'free',
        features: JSON.stringify(['scraping', 'export', 'categories']),
      },
    });

    return { user: { id: user.id, email: user.email, plan: user.plan }, licenseKey: license.key };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { licenses: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new Error('Invalid email or password');
    }

    const license = user.licenses[0];
    return {
      user: { id: user.id, email: user.email, plan: user.plan, name: user.name },
      licenseKey: license?.key,
      plan: license?.plan ?? user.plan,
    };
  }

  async validateLicense(key?: string) {
    if (!key) {
      return { valid: true, plan: 'local', features: ['scraping', 'export', 'categories', 'resume'] };
    }

    const license = await prisma.license.findUnique({ where: { key } });
    if (!license) return { valid: false, plan: 'none', features: [] };

    if (license.validUntil && license.validUntil < new Date()) {
      return { valid: false, plan: license.plan, features: [], expired: true };
    }

    const features = license.features ? (JSON.parse(license.features) as string[]) : [];
    return { valid: true, plan: license.plan, features, expiresAt: license.validUntil };
  }
}

export const authService = new AuthService();
