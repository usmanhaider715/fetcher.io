import type { Request, Response, NextFunction } from 'express';
import { getRedis } from '../lib/redis.js';

export function rateLimit(options: { windowSec: number; max: number; keyPrefix?: string }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedis();
      const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
      const userId = req.user?.id ?? 'anon';
      const prefix = options.keyPrefix ?? 'rl';
      const key = `${prefix}:${ip}:${userId}`;

      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, options.windowSec);
      }

      res.setHeader('X-RateLimit-Limit', String(options.max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.max - count)));

      if (count > options.max) {
        res.status(429).json({ error: 'Too many requests' });
        return;
      }
      next();
    } catch {
      next();
    }
  };
}
