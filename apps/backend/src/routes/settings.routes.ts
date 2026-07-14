import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { settingsService } from '../services/settings.service.js';
import { logger } from '../services/logger.service.js';
import { paramId } from '../lib/params.js';
import { prisma } from '../lib/prisma.js';

export const settingsRouter = Router();

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const settings = await settingsService.get();
    res.json(settings);
  }),
);

settingsRouter.put(
  '/',
  validateBody(z.record(z.unknown())),
  asyncHandler(async (req, res) => {
    const settings = await settingsService.update(req.body);
    res.json(settings);
  }),
);

export const logsRouter = Router();

logsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sessionId = req.query['sessionId'] as string | undefined;
    const limit = parseInt(req.query['limit'] as string) || 100;
    const logs = await logger.getLogs(sessionId, limit);
    res.json(logs);
  }),
);

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'fetcher-io-backend', version: '1.0.0' });
});

export const productsRouter = Router();

productsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sessionId = req.query['sessionId'] as string | undefined;
    const limit = parseInt(req.query['limit'] as string) || 50;
    const offset = parseInt(req.query['offset'] as string) || 0;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: sessionId ? { sessionId } : undefined,
        include: { images: true, category: true, subcategory: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.product.count({ where: sessionId ? { sessionId } : undefined }),
    ]);

    res.json({ products, total, limit, offset });
  }),
);

productsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: paramId(req.params['id']) },
      include: { images: true, category: true, subcategory: true },
    });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json(product);
  }),
);
