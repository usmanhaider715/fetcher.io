import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[api:error]', err.message);
  const status = (err as { status?: number }).status ?? 500;
  const message = config.isProd && status === 500 ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}
