import type { LogLevel } from '@fetcher/shared';
import { prisma } from '../lib/prisma.js';

export class LoggerService {
  async log(
    level: LogLevel,
    message: string,
    sessionId?: string,
    metadata?: Record<string, unknown>,
  ) {
    const entry = await prisma.log.create({
      data: {
        level,
        message,
        sessionId: sessionId ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    const prefix = `[${level.toUpperCase()}]`;
    console.log(`${prefix} ${message}`);

    return entry;
  }

  async getLogs(sessionId?: string, limit = 100) {
    return prisma.log.findMany({
      where: sessionId ? { sessionId } : undefined,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}

export const logger = new LoggerService();
