import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { paramId } from '../lib/params.js';
import { categoryService } from '../services/category.service.js';

export const categoryRouter = Router();

categoryRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categories = await categoryService.getAll();
    res.json(categories);
  }),
);

categoryRouter.post(
  '/',
  validateBody(z.object({ name: z.string().min(1).max(100) })),
  asyncHandler(async (req, res) => {
    const category = await categoryService.create(req.body.name);
    res.status(201).json(category);
  }),
);

categoryRouter.post(
  '/:categoryId/subcategories',
  validateBody(z.object({ name: z.string().min(1).max(100) })),
  asyncHandler(async (req, res) => {
    const subcategory = await categoryService.createSubcategory(
      paramId(req.params['categoryId']),
      req.body.name,
    );
    res.status(201).json(subcategory);
  }),
);

categoryRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await categoryService.delete(paramId(req.params['id']));
    res.json({ success: true });
  }),
);
