import { Router } from 'express';
import { z } from 'zod';
import { aiService } from '../services/ai.service.js';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { requireAuth, requireOrgMember } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';

export const aiRouter = Router();

aiRouter.post(
  '/generate',
  requireAuth,
  requireOrgMember,
  rateLimit({ windowSec: 60, max: 30, keyPrefix: 'ai' }),
  validateBody(
    z.object({
      task: z.enum(['title', 'description', 'seo_keywords', 'marketing_copy', 'category_recommendation', 'listing_review']),
      product: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        brand: z.string().optional(),
        price: z.number().optional(),
      }),
    }),
  ),
  asyncHandler(async (req, res) => {
    const result = await aiService.generate({
      task: req.body.task,
      product: req.body.product,
      organizationId: req.user!.organizationId!,
      userId: req.user!.id,
    });
    res.json({ success: true, ...result });
  }),
);
