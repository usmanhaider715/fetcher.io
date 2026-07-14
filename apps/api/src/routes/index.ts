import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { billingRouter, webhooksRouter } from './billing.routes.js';
import { aiRouter } from './ai.routes.js';
import { projectsRouter, jobsRouter, apiKeysRouter } from './projects.routes.js';
import { adminRouter } from './admin.routes.js';
import { connectorsRouter } from './connectors.routes.js';
import { trendsRouter } from './trends.routes.js';
import { openapiRouter } from './openapi.routes.js';
import { mongoStatus } from '../lib/mongo.js';
import { getRedis } from '../lib/redis.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    const redis = getRedis();
    await redis.ping();
    res.json({
      status: 'ok',
      service: 'fetcherio-api',
      version: '1.0.0',
      mongo: mongoStatus(),
      redis: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/billing', billingRouter);
v1Router.use('/ai', aiRouter);
v1Router.use('/projects', projectsRouter);
v1Router.use('/jobs', jobsRouter);
v1Router.use('/api-keys', apiKeysRouter);

v1Router.use('/connectors', connectorsRouter);
v1Router.use('/trends', trendsRouter);
v1Router.use(openapiRouter);

export { webhooksRouter, adminRouter };
