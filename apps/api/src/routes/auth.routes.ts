import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { requireAuth } from '../middleware/auth.js';

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
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
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
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ success: true, ...result });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.body?.refreshToken ?? req.cookies?.['refreshToken'];
    if (token) await authService.logout(token);
    res.clearCookie('refreshToken');
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
    res.json({ success: true, user: req.user });
  }),
);

authRouter.get(
  '/license/validate',
  asyncHandler(async (req, res) => {
    const key = req.query['key'] as string | undefined;
    res.json({
      valid: true,
      plan: key ? 'pro' : 'local',
      features: ['scraping', 'export', 'ai', 'connectors', 'api'],
    });
  }),
);
