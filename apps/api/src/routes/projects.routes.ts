import { Router } from 'express';
import { z } from 'zod';
import { Project, ScrapeJob, ScrapeProduct, ApiKey } from '../models/index.js';
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

const productInputSchema = z.object({
  title: z.string().optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
  productUrl: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  imageCount: z.number().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  sku: z.string().optional(),
  platform: z.string().optional(),
  scrapedAt: z.string().optional(),
});

function paramId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function productsToCsv(
  products: Array<{
    title?: string | null;
    price?: number | null;
    currency?: string | null;
    productUrl?: string | null;
    category?: string | null;
    subcategory?: string | null;
    sku?: string | null;
    platform?: string | null;
    imageUrls?: string[] | null;
  }>,
): string {
  const header = [
    'title',
    'price',
    'currency',
    'productUrl',
    'category',
    'subcategory',
    'sku',
    'platform',
    'imageCount',
    'imageUrls',
  ];
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = products.map((p) =>
    [
      p.title ?? '',
      p.price ?? '',
      p.currency ?? '',
      p.productUrl ?? '',
      p.category ?? '',
      p.subcategory ?? '',
      p.sku ?? '',
      p.platform ?? '',
      p.imageUrls?.length ?? 0,
      (p.imageUrls ?? []).join(' | '),
    ]
      .map(escape)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

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
      platform: z.string().optional(),
      categoryName: z.string().optional(),
      subcategoryName: z.string().optional(),
      sortFilter: z.string().optional(),
      maxProducts: z.number().optional(),
      productsFound: z.number().optional(),
      productsSaved: z.number().optional(),
      imagesDownloaded: z.number().optional(),
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
      platform: req.body.platform,
      categoryName: req.body.categoryName,
      subcategoryName: req.body.subcategoryName,
      sortFilter: req.body.sortFilter,
      maxProducts: req.body.maxProducts,
      productsFound: req.body.productsFound ?? 0,
      productsSaved: req.body.productsSaved ?? 0,
      imagesDownloaded: req.body.imagesDownloaded ?? 0,
      status: req.body.status ?? 'running',
      metadata: req.body.metadata,
    });
    res.status(201).json({ success: true, job });
  }),
);

jobsRouter.get(
  '/:id',
  requireAuth,
  requireOrgMember,
  asyncHandler(async (req, res) => {
    const jobId = paramId(req.params['id']);
    const job = await ScrapeJob.findOne({ _id: jobId, organizationId: req.user!.organizationId });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const products = await ScrapeProduct.find({ jobId: job._id }).sort({ createdAt: 1 }).limit(2000);
    res.json({ job, products, productCount: products.length });
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
      imagesDownloaded: z.number().optional(),
      errors: z.number().optional(),
      errorMessages: z.array(z.string()).optional(),
      durationMs: z.number().optional(),
      platform: z.string().optional(),
      categoryName: z.string().optional(),
      subcategoryName: z.string().optional(),
      sortFilter: z.string().optional(),
      maxProducts: z.number().optional(),
      metadata: z.record(z.unknown()).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const jobId = paramId(req.params['id']);
    const updates = { ...req.body } as Record<string, unknown>;
    if (Array.isArray(updates['errorMessages'])) {
      updates['errorMessages'] = (updates['errorMessages'] as string[]).slice(-50);
    }
    const job = await ScrapeJob.findOneAndUpdate(
      { _id: jobId, organizationId: req.user!.organizationId },
      { $set: updates },
      { new: true },
    );
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json({ success: true, job });
  }),
);

jobsRouter.post(
  '/:id/products',
  requireAuth,
  requireOrgMember,
  validateBody(
    z.object({
      products: z.array(productInputSchema).min(1).max(100),
    }),
  ),
  asyncHandler(async (req, res) => {
    const jobId = paramId(req.params['id']);
    const job = await ScrapeJob.findOne({ _id: jobId, organizationId: req.user!.organizationId });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const docs = (req.body.products as z.infer<typeof productInputSchema>[]).map((p) => ({
      jobId: job._id,
      organizationId: req.user!.organizationId,
      title: p.title,
      price: p.price,
      currency: p.currency,
      productUrl: p.productUrl,
      imageUrls: (p.imageUrls ?? []).slice(0, 50),
      imageCount: p.imageCount ?? p.imageUrls?.length ?? 0,
      category: p.category,
      subcategory: p.subcategory,
      sku: p.sku,
      platform: p.platform,
      scrapedAt: p.scrapedAt ? new Date(p.scrapedAt) : new Date(),
    }));

    let savedCount = 0;
    try {
      const inserted = await ScrapeProduct.insertMany(docs, { ordered: false });
      savedCount = inserted.length;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'insertedDocs' in err) {
        savedCount = ((err as { insertedDocs: unknown[] }).insertedDocs ?? []).length;
      } else if (err && typeof err === 'object' && 'result' in err) {
        const result = (err as { result?: { nInserted?: number } }).result;
        savedCount = result?.nInserted ?? docs.length;
      } else {
        throw err;
      }
    }

    const imageBump = docs.reduce((n, d) => n + (d.imageCount || 0), 0);
    const updated = await ScrapeJob.findByIdAndUpdate(
      job._id,
      {
        $inc: {
          productsSaved: savedCount,
          imagesDownloaded: imageBump,
        },
      },
      { new: true },
    );

    res.status(201).json({
      success: true,
      saved: savedCount,
      job: updated,
    });
  }),
);

jobsRouter.delete(
  '/:id',
  requireAuth,
  requireOrgMember,
  asyncHandler(async (req, res) => {
    const jobId = paramId(req.params['id']);
    const job = await ScrapeJob.findOneAndDelete({
      _id: jobId,
      organizationId: req.user!.organizationId,
    });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    await ScrapeProduct.deleteMany({ jobId: job._id });
    res.json({ success: true, deleted: true, jobId });
  }),
);

jobsRouter.get(
  '/:id/export',
  requireAuth,
  requireOrgMember,
  asyncHandler(async (req, res) => {
    const jobId = paramId(req.params['id']);
    const format = String(req.query['format'] ?? 'json').toLowerCase();
    const job = await ScrapeJob.findOne({ _id: jobId, organizationId: req.user!.organizationId });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const products = await ScrapeProduct.find({ jobId: job._id }).sort({ createdAt: 1 }).limit(5000);

    if (format === 'csv') {
      const csv = productsToCsv(products);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="fetcher-run-${jobId}.csv"`);
      res.send(csv);
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="fetcher-run-${jobId}.json"`);
    res.json({
      job: {
        id: job._id,
        mode: job.mode,
        status: job.status,
        websiteUrl: job.websiteUrl,
        platform: job.platform,
        categoryName: job.categoryName,
        subcategoryName: job.subcategoryName,
        sortFilter: job.sortFilter,
        maxProducts: job.maxProducts,
        productsFound: job.productsFound,
        productsSaved: job.productsSaved,
        imagesDownloaded: job.imagesDownloaded,
        errors: job.errors,
        durationMs: job.durationMs,
        createdAt: job.createdAt,
      },
      products,
    });
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
