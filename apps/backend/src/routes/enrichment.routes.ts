import { Router } from 'express';
import { z } from 'zod';
import type { Product } from '@fetcher/shared';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { aiEnrichmentService } from '../services/ai-enrichment.service.js';

const productSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  productUrl: z.string().optional(),
  platform: z.string().optional(),
  price: z.number().optional(),
  brand: z.string().optional(),
});

export const enrichmentRouter = Router();

enrichmentRouter.post(
  '/product',
  validateBody(
    z.object({
      product: productSchema,
      sessionId: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { product, sessionId } = req.body;
    const result = await aiEnrichmentService.enrichProduct(product as Product, sessionId);
    res.json({ success: true, ...result });
  }),
);
