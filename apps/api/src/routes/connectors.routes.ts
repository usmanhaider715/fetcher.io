import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { getRedis } from '../lib/redis.js';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { requireAuth, requireOrgMember } from '../middleware/auth.js';
import { Organization } from '../models/index.js';

export const connectorsRouter = Router();

connectorsRouter.post(
  '/upload-token',
  requireAuth,
  requireOrgMember,
  validateBody(
    z.object({
      platform: z.enum(['shopify', 'woocommerce', 'bigcommerce', 'magento']),
      productCount: z.number().min(1).max(100).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const org = await Organization.findById(req.user!.organizationId);
    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }
    if (org.connectorLimit <= 0 && org.plan === 'free') {
      res.status(402).json({ error: 'Connectors require a paid plan' });
      return;
    }

    const token = randomBytes(24).toString('hex');
    const redis = getRedis();
    const payload = {
      orgId: org._id.toString(),
      userId: req.user!.id,
      platform: req.body.platform,
      productCount: req.body.productCount ?? 1,
      issuedAt: new Date().toISOString(),
    };
    await redis.setex(`upload:${token}`, 300, JSON.stringify(payload));

    res.json({
      success: true,
      uploadToken: token,
      expiresIn: 300,
      platform: req.body.platform,
    });
  }),
);

connectorsRouter.post(
  '/report',
  requireAuth,
  requireOrgMember,
  validateBody(
    z.object({
      platform: z.string(),
      status: z.enum(['success', 'failed']),
      productId: z.string().optional(),
      error: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      logged: true,
      message: 'Publish outcome recorded for history',
      outcome: req.body,
    });
  }),
);
