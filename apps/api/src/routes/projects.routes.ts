import { Router } from 'express';
import { z } from 'zod';
import { Project, ScrapeJob, ApiKey } from '../models/index.js';
import { generateApiKey } from '../lib/crypto.js';
import { asyncHandler, validateBody } from '../middleware/validate.js';
import { requireAuth, requireOrgMember } from '../middleware/auth.js';

export const projectsRouter = Router();

projectsRouter.get(
  '/',
  requireAuth,
  requireOrgMember,
  asyncHandler(async (req, res) => {
    const projects = await Project.find({ organizationId: req.user!.organizationId }).sort({ updatedAt: -1 });
    res.json({ projects });
  }),
);

projectsRouter.post(
  '/',
  requireAuth,
  requireOrgMember,
  validateBody(z.object({ name: z.string().min(1), description: z.string().optional(), tags: z.array(z.string()).optional() })),
  asyncHandler(async (req, res) => {
    const project = await Project.create({
      organizationId: req.user!.organizationId,
      name: req.body.name,
      description: req.body.description,
      tags: req.body.tags ?? [],
    });
    res.status(201).json({ success: true, project });
  }),
);

export const jobsRouter = Router();

jobsRouter.get(
  '/',
  requireAuth,
  requireOrgMember,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query['limit'] as string) || 50, 100);
    const jobs = await ScrapeJob.find({ organizationId: req.user!.organizationId })
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ jobs, total: jobs.length });
  }),
);

jobsRouter.post(
  '/',
  requireAuth,
  requireOrgMember,
  validateBody(
    z.object({
      mode: z.string(),
      websiteUrl: z.string().url().optional(),
      projectId: z.string().optional(),
      productsFound: z.number().optional(),
      productsSaved: z.number().optional(),
      status: z.enum(['running', 'completed', 'failed', 'interrupted']).optional(),
      metadata: z.record(z.unknown()).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const job = await ScrapeJob.create({
      organizationId: req.user!.organizationId,
      userId: req.user!.id,
      projectId: req.body.projectId,
      mode: req.body.mode,
      websiteUrl: req.body.websiteUrl,
      productsFound: req.body.productsFound ?? 0,
      productsSaved: req.body.productsSaved ?? 0,
      status: req.body.status ?? 'running',
      metadata: req.body.metadata,
    });
    res.status(201).json({ success: true, job });
  }),
);

jobsRouter.patch(
  '/:id',
  requireAuth,
  requireOrgMember,
  validateBody(
    z.object({
      status: z.enum(['running', 'completed', 'failed', 'interrupted']).optional(),
      productsFound: z.number().optional(),
      productsSaved: z.number().optional(),
      errors: z.number().optional(),
      durationMs: z.number().optional(),
      metadata: z.record(z.unknown()).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const jobId = Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'];
    const job = await ScrapeJob.findOneAndUpdate(
      { _id: jobId, organizationId: req.user!.organizationId },
      { $set: req.body },
      { new: true },
    );
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json({ success: true, job });
  }),
);

export const apiKeysRouter = Router();

apiKeysRouter.get(
  '/',
  requireAuth,
  requireOrgMember,
  asyncHandler(async (req, res) => {
    const keys = await ApiKey.find({
      organizationId: req.user!.organizationId,
      revokedAt: null,
    }).select('-keyHash');
    res.json({ keys });
  }),
);

apiKeysRouter.post(
  '/',
  requireAuth,
  requireOrgMember,
  validateBody(z.object({ name: z.string().min(1), scopes: z.array(z.enum(['read', 'publish', 'admin'])).optional() })),
  asyncHandler(async (req, res) => {
    const { key, prefix, hash } = generateApiKey();
    const record = await ApiKey.create({
      organizationId: req.user!.organizationId,
      userId: req.user!.id,
      name: req.body.name,
      prefix,
      keyHash: hash,
      scopes: req.body.scopes ?? ['read'],
    });
    res.status(201).json({
      success: true,
      key,
      apiKey: { id: record._id, name: record.name, prefix: record.prefix, scopes: record.scopes },
      warning: 'Store this key securely — it will not be shown again.',
    });
  }),
);
