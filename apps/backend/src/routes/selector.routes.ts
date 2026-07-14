import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { prisma } from '../lib/prisma.js';
import { paramId } from '../lib/params.js';

const selectorRuleSchema = z.object({
  type: z.enum(['css', 'xpath', 'attribute', 'regex', 'text']),
  value: z.string(),
  attribute: z.string().optional(),
  parent: z.string().optional(),
});

const selectorMapSchema = z.record(selectorRuleSchema);

export const selectorRouter = Router();

selectorRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const domain = req.query['domain'] as string | undefined;
    const selectors = await prisma.selector.findMany({
      where: domain ? { domain } : undefined,
      orderBy: { updatedAt: 'desc' },
    });
    res.json(
      selectors.map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        selectors: JSON.parse(s.selectors) as Record<string, unknown>,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    );
  }),
);

selectorRouter.post(
  '/',
  validateBody(
    z.object({
      name: z.string().min(1),
      domain: z.string().min(1),
      selectors: selectorMapSchema,
    }),
  ),
  asyncHandler(async (req, res) => {
    const { name, domain, selectors } = req.body;
    const existing = await prisma.selector.findFirst({ where: { domain, name } });

    const record = existing
      ? await prisma.selector.update({
          where: { id: existing.id },
          data: { selectors: JSON.stringify(selectors) },
        })
      : await prisma.selector.create({
          data: { name, domain, selectors: JSON.stringify(selectors) },
        });

    res.status(existing ? 200 : 201).json({
      success: true,
      selector: {
        id: record.id,
        name: record.name,
        domain: record.domain,
        selectors: JSON.parse(record.selectors),
      },
    });
  }),
);

selectorRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.selector.delete({ where: { id: paramId(req.params['id']) } });
    res.json({ success: true });
  }),
);
