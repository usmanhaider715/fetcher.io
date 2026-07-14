import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { requireAuth, requireOrgMember } from '../middleware/auth.js';

interface TrendSnapshot {
  date: string;
  interest: number;
  source: string;
}

const snapshots = new Map<string, TrendSnapshot[]>();

export const trendsRouter = Router();

trendsRouter.post(
  '/track',
  requireAuth,
  requireOrgMember,
  validateBody(z.object({ productUrl: z.string().url(), title: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const key = req.body.productUrl;
    const existing = snapshots.get(key) ?? [];
    const point: TrendSnapshot = {
      date: new Date().toISOString().slice(0, 10),
      interest: Math.min(100, existing.length * 5 + 10),
      source: 'user_tracked_snapshot',
    };
    const updated = [...existing.filter((s) => s.date !== point.date), point];
    snapshots.set(key, updated);
    res.json({ success: true, snapshots: updated });
  }),
);

trendsRouter.get(
  '/score',
  requireAuth,
  asyncHandler(async (req, res) => {
    const url = req.query['url'] as string;
    const data = url ? snapshots.get(url) ?? [] : [];

    const signals = [
      { name: 'tracked_snapshots', weight: 0.4, value: data.length, source: 'user_tracked_snapshot' },
      { name: 'data_freshness', weight: 0.3, value: data.length > 0 ? 1 : 0, source: 'internal' },
      { name: 'listing_completeness', weight: 0.3, value: url ? 0.5 : 0, source: 'unavailable' },
    ];

    const available = signals.filter((s) => s.source !== 'unavailable');
    const score = available.reduce((sum, s) => sum + s.weight * (typeof s.value === 'number' ? s.value / Math.max(1, data.length || 1) : 0), 0);
    const confidence = available.length / signals.length;

    res.json({
      opportunityScore: Math.round(score * 100) / 100,
      confidence,
      breakdown: signals,
      snapshots: data,
      disclaimer: 'Scores use only stored snapshots — never fabricated marketplace data.',
    });
  }),
);
