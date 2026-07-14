import { Router } from 'express';
import { z } from 'zod';
import { stripeService } from '../services/stripe.service.js';
import { Organization } from '../models/index.js';
import { config } from '../config/index.js';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { requireAuth, requireOrgMember } from '../middleware/auth.js';

export const billingRouter = Router();

billingRouter.post(
  '/checkout',
  requireAuth,
  requireOrgMember,
  validateBody(z.object({ plan: z.enum(['starter', 'pro', 'team']) })),
  asyncHandler(async (req, res) => {
    const priceMap = {
      starter: config.stripe.prices.starter,
      pro: config.stripe.prices.pro,
      team: config.stripe.prices.team,
    };
    const priceId = priceMap[req.body.plan as keyof typeof priceMap];
    if (!priceId) {
      res.status(400).json({ error: 'Plan not configured in Stripe' });
      return;
    }
    const session = await stripeService.createCheckoutSession(
      req.user!.organizationId!,
      priceId,
      req.user!.email,
    );
    res.json({ success: true, ...session });
  }),
);

billingRouter.post(
  '/portal',
  requireAuth,
  requireOrgMember,
  asyncHandler(async (req, res) => {
    const org = await Organization.findById(req.user!.organizationId);
    if (!org?.stripeCustomerId) {
      res.status(400).json({ error: 'No billing account found' });
      return;
    }
    const session = await stripeService.createPortalSession(org.stripeCustomerId);
    res.json({ success: true, ...session });
  }),
);

billingRouter.get(
  '/usage',
  requireAuth,
  requireOrgMember,
  asyncHandler(async (req, res) => {
    const org = await Organization.findById(req.user!.organizationId);
    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }
    res.json({
      plan: org.plan,
      aiCallsUsed: org.aiCallsUsed,
      aiCallsLimit: org.aiCallsLimit,
      seats: org.seats,
      connectorLimit: org.connectorLimit,
    });
  }),
);

export const webhooksRouter = Router();

webhooksRouter.post(
  '/stripe',
  asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'] as string;
    const result = await stripeService.handleWebhook(req.body as Buffer, signature);
    res.json(result);
  }),
);
