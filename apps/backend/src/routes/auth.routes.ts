import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { authService } from '../services/auth.service.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body.email, req.body.password, req.body.name);
    res.status(201).json({ success: true, ...result });
  }),
);

authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body.email, req.body.password);
    res.json({ success: true, ...result });
  }),
);

authRouter.get(
  '/license/validate',
  asyncHandler(async (req, res) => {
    const key = req.query['key'] as string | undefined;
    const result = await authService.validateLicense(key);
    res.json(result);
  }),
);
