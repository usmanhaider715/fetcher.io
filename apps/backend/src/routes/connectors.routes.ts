import { Router } from 'express';
import { z } from 'zod';
import type { Product } from '@fetcher/shared';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { shopifyConnector } from '../connectors/shopify.connector.js';
import { wooCommerceConnector } from '../connectors/woocommerce.connector.js';
import { prisma } from '../lib/prisma.js';
import { settingsService } from '../services/settings.service.js';
import { dbProductToProduct } from '../services/product.service.js';
import { logger } from '../services/logger.service.js';

const productSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  price: z.number().optional(),
  salePrice: z.number().optional(),
  sku: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
});

export const connectorsRouter = Router();

connectorsRouter.post(
  '/shopify/push',
  validateBody(
    z.object({
      product: productSchema,
      config: z.object({
        storeUrl: z.string().url(),
        accessToken: z.string().min(1),
      }),
    }),
  ),
  asyncHandler(async (req, res) => {
    const result = await shopifyConnector.pushProduct(req.body.product as Product, req.body.config);
    res.json(result);
  }),
);

connectorsRouter.post(
  '/woocommerce/push',
  validateBody(
    z.object({
      product: productSchema,
      config: z.object({
        storeUrl: z.string().url(),
        consumerKey: z.string().min(1),
        consumerSecret: z.string().min(1),
      }),
    }),
  ),
  asyncHandler(async (req, res) => {
    const result = await wooCommerceConnector.pushProduct(req.body.product as Product, req.body.config);
    res.json(result);
  }),
);

connectorsRouter.post(
  '/shopify/push-session',
  validateBody(
    z.object({
      sessionId: z.string(),
      limit: z.number().min(1).max(100).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const settings = await settingsService.get();
    const config = settings.connectors?.shopify;
    if (!config?.storeUrl || !config.accessToken) {
      res.status(400).json({ error: 'Shopify not configured in settings' });
      return;
    }

    const products = await prisma.product.findMany({
      where: { sessionId: req.body.sessionId },
      include: { images: true },
      take: req.body.limit ?? 50,
      orderBy: { createdAt: 'asc' },
    });

    let pushed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const record of products) {
      const product = dbProductToProduct(record);
      const result = await shopifyConnector.pushProduct(product, config);
      if (result.success) pushed++;
      else {
        failed++;
        if (result.error) errors.push(result.error);
      }
    }

    await logger.log('info', `Shopify push: ${pushed} ok, ${failed} failed`, req.body.sessionId);
    res.json({ success: true, pushed, failed, total: products.length, errors: errors.slice(0, 5) });
  }),
);

connectorsRouter.post(
  '/woocommerce/push-session',
  validateBody(
    z.object({
      sessionId: z.string(),
      limit: z.number().min(1).max(100).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const settings = await settingsService.get();
    const config = settings.connectors?.woocommerce;
    if (!config?.storeUrl || !config.consumerKey || !config.consumerSecret) {
      res.status(400).json({ error: 'WooCommerce not configured in settings' });
      return;
    }

    const products = await prisma.product.findMany({
      where: { sessionId: req.body.sessionId },
      include: { images: true },
      take: req.body.limit ?? 50,
      orderBy: { createdAt: 'asc' },
    });

    let pushed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const record of products) {
      const product = dbProductToProduct(record);
      const result = await wooCommerceConnector.pushProduct(product, config);
      if (result.success) pushed++;
      else {
        failed++;
        if (result.error) errors.push(result.error);
      }
    }

    await logger.log('info', `WooCommerce push: ${pushed} ok, ${failed} failed`, req.body.sessionId);
    res.json({ success: true, pushed, failed, total: products.length, errors: errors.slice(0, 5) });
  }),
);

connectorsRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const settings = await settingsService.get();
    res.json({
      shopify: {
        available: true,
        configured: !!(settings.connectors?.shopify?.storeUrl && settings.connectors.shopify.accessToken),
      },
      woocommerce: {
        available: true,
        configured: !!(
          settings.connectors?.woocommerce?.storeUrl &&
          settings.connectors.woocommerce.consumerKey &&
          settings.connectors.woocommerce.consumerSecret
        ),
      },
    });
  }),
);
