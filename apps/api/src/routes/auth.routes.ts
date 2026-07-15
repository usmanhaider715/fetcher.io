import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyAccessToken, verifyApiKey } from '../lib/crypto.js';
import { User, Organization, ApiKey } from '../models/index.js';
import { getPlanFeatures, type PlanId } from '../config/plans.js';
import { config } from '../config/index.js';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(config.isProd ? { domain: '.productfetcher.online' } : {}),
  };
}

export const authRouter = Router();

authRouter.post(
  '/register',
  rateLimit({ windowSec: 3600, max: 10, keyPrefix: 'auth-register' }),
  validateBody(z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body.email, req.body.password, req.body.name);
    res.status(201).json({ success: true, ...result });
  }),
);

authRouter.post(
  '/login',
  rateLimit({ windowSec: 900, max: 20, keyPrefix: 'auth-login' }),
  validateBody(z.object({ email: z.string().email(), password: z.string(), deviceFingerprint: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body.email, req.body.password, req.body.deviceFingerprint);
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions());
    res.json({ success: true, ...result });
  }),
);

authRouter.post(
  '/refresh',
  validateBody(z.object({ refreshToken: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const token = req.body.refreshToken ?? req.cookies?.['refreshToken'];
    if (!token) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }
    const result = await authService.refresh(token);
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions());
    res.json({ success: true, ...result });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.body?.refreshToken ?? req.cookies?.['refreshToken'];
    if (token) await authService.logout(token);
    res.clearCookie('refreshToken', refreshCookieOptions());
    res.json({ success: true });
  }),
);

authRouter.post(
  '/verify-email',
  validateBody(z.object({ token: z.string() })),
  asyncHandler(async (req, res) => {
    const result = await authService.verifyEmail(req.body.token);
    res.json({ success: true, ...result });
  }),
);

authRouter.post(
  '/forgot-password',
  rateLimit({ windowSec: 3600, max: 5, keyPrefix: 'auth-forgot' }),
  validateBody(z.object({ email: z.string().email() })),
  asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.body.email);
    res.json({ success: true, ...result });
  }),
);

authRouter.post(
  '/reset-password',
  validateBody(z.object({ token: z.string(), password: z.string().min(8) })),
  asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.body.token, req.body.password);
    res.json({ success: true, ...result });
  }),
);

authRouter.get(
  '/devices',
  requireAuth,
  asyncHandler(async (req, res) => {
    const devices = await authService.listDevices(req.user!.id);
    res.json({ devices });
  }),
);

authRouter.delete(
  '/devices/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const deviceId = Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'];
    if (!deviceId) {
      res.status(400).json({ error: 'Device id required' });
      return;
    }
    const result = await authService.revokeDevice(req.user!.id, deviceId);
    res.json({ success: true, ...result });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id).select('name emailVerified');
    const org = req.user!.organizationId
      ? await Organization.findById(req.user!.organizationId).select('name slug plan')
      : null;

    res.json({
      success: true,
      user: {
        id: req.user!.id,
        email: req.user!.email,
        name: user?.name ?? null,
        emailVerified: user?.emailVerified ?? false,
        role: req.user!.role,
      },
      organization: org
        ? {
            id: org._id.toString(),
            name: org.name,
            slug: org.slug,
            plan: org.plan,
          }
        : null,
    });
  }),
);

authRouter.get(
  '/license/validate',
  asyncHandler(async (req, res) => {
    const key = req.query['key'] as string | undefined;
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (bearer) {
      try {
        const payload = verifyAccessToken(bearer);
        const user = await User.findById(payload.sub);
        if (!user) {
          res.json({ valid: false, plan: 'none', features: [] });
          return;
        }
        const org = payload['orgId'] ? await Organization.findById(payload['orgId']) : null;
        const plan = (org?.plan ?? 'free') as PlanId;
        res.json({
          valid: true,
          plan,
          features: getPlanFeatures(plan),
          userId: user._id.toString(),
          organizationId: org?._id.toString(),
        });
        return;
      } catch {
        res.json({ valid: false, plan: 'none', features: [] });
        return;
      }
    }

    if (key) {
      const prefix = key.slice(0, 12);
      const record = await ApiKey.findOne({ prefix, revokedAt: null });
      if (!record || !verifyApiKey(key, record.keyHash)) {
        res.json({ valid: false, plan: 'none', features: [], error: 'Invalid license key' });
        return;
      }
      const org = await Organization.findById(record.organizationId);
      const plan = (org?.plan ?? 'free') as PlanId;
      await ApiKey.updateOne({ _id: record._id }, { lastUsedAt: new Date() });
      res.json({
        valid: true,
        plan,
        features: getPlanFeatures(plan),
        organizationId: org?._id.toString(),
      });
      return;
    }

    res.json({
      valid: false,
      plan: 'none',
      features: [],
      error: 'Sign in to Fetcher.io or provide an API key from the dashboard',
    });
  }),
);
