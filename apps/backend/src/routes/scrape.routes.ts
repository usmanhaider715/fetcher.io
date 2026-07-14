import { Router } from 'express';
import { z } from 'zod';
import type { Product } from '@fetcher/shared';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { scrapeService, sessionService } from '../services/scrape.service.js';
import { exportService } from '../services/export.service.js';
import { paramId } from '../lib/params.js';
import { logger } from '../services/logger.service.js';

const productSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  htmlDescription: z.string().optional(),
  shortDescription: z.string().optional(),
  price: z.number().optional(),
  salePrice: z.number().optional(),
  currency: z.string().optional(),
  discount: z.number().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  stock: z.number().optional(),
  availability: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  brand: z.string().optional(),
  website: z.string().optional(),
  supplier: z.string().optional(),
  productUrl: z.string().optional(),
  platform: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  images: z.array(z.object({ url: z.string(), alt: z.string().optional() })).optional(),
  tags: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
  variants: z.array(z.record(z.unknown())).optional(),
  colors: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  specifications: z.record(z.string()).optional(),
  attributes: z.record(z.string()).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  canonicalUrl: z.string().optional(),
  breadcrumbs: z.array(z.string()).optional(),
  weight: z.string().optional(),
  dimensions: z.string().optional(),
  material: z.string().optional(),
  country: z.string().optional(),
  shipping: z.string().optional(),
  hash: z.string().optional(),
});

const scrapeSchema = z.object({
  mode: z.enum([
    'current_product',
    'current_collection',
    'entire_website',
    'selected_urls',
    'import_csv',
    'resume_session',
  ]),
  websiteUrl: z.string().url(),
  urls: z.array(z.string().url()).optional(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  products: z.array(productSchema).optional(),
  sessionId: z.string().optional(),
  folderName: z.string().optional(),
});

export const scrapeRouter = Router();

scrapeRouter.post(
  '/',
  validateBody(scrapeSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof scrapeSchema>;
    const result = await scrapeService.startScrape({
      ...body,
      products: body.products as Product[] | undefined,
    });
    res.status(201).json({ success: true, ...result });
  }),
);

scrapeRouter.post(
  '/download',
  validateBody(
    z.object({
      product: productSchema,
      sessionId: z.string(),
      categoryId: z.string().optional(),
      subcategoryId: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { product, sessionId, categoryId, subcategoryId } = req.body;
    const result = await scrapeService.processProduct(
      product as Product,
      sessionId,
      categoryId,
      subcategoryId,
    );
    res.json({ success: true, ...result });
  }),
);

scrapeRouter.post(
  '/resume',
  validateBody(z.object({ sessionId: z.string() })),
  asyncHandler(async (req, res) => {
    const session = await sessionService.resume(req.body.sessionId);
    await logger.log('info', 'Session resumed', session.id);
    res.json({ success: true, session });
  }),
);

scrapeRouter.get(
  '/progress/:sessionId',
  asyncHandler(async (req, res) => {
    const progress = await sessionService.getProgress(paramId(req.params['sessionId']));
    if (!progress) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(progress);
  }),
);

scrapeRouter.post(
  '/pause/:sessionId',
  asyncHandler(async (req, res) => {
    const session = await sessionService.pause(paramId(req.params['sessionId']));
    res.json({ success: true, session });
  }),
);

scrapeRouter.post(
  '/stop/:sessionId',
  asyncHandler(async (req, res) => {
    const session = await sessionService.stop(paramId(req.params['sessionId']));
    res.json({ success: true, session });
  }),
);

const exportSchema = z.object({
  format: z.enum(['txt', 'json', 'csv', 'excel', 'zip']),
  sessionId: z.string().optional(),
  productIds: z.array(z.string()).optional(),
});

export const exportRouter = Router();

exportRouter.post(
  '/',
  validateBody(exportSchema),
  asyncHandler(async (req, res) => {
    const result = await exportService.exportProducts(
      req.body.format,
      req.body.sessionId,
      req.body.productIds,
    );
    res.json({ success: true, ...result });
  }),
);
