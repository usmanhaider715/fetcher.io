import express from 'express';
import cors from 'cors';
import { mkdir } from 'node:fs/promises';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { scrapeRouter, exportRouter } from './routes/scrape.routes.js';
import { categoryRouter } from './routes/category.routes.js';
import {
  settingsRouter,
  logsRouter,
  healthRouter,
  productsRouter,
} from './routes/settings.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { selectorRouter } from './routes/selector.routes.js';
import { enrichmentRouter } from './routes/enrichment.routes.js';
import { connectorsRouter } from './routes/connectors.routes.js';
import { fileService } from './services/file.service.js';
import { logger } from './services/logger.service.js';
import { prisma } from './lib/prisma.js';

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: '50mb' }));

app.use('/auth', authRouter);
app.use('/selectors', selectorRouter);
app.use('/enrichment', enrichmentRouter);
app.use('/connectors', connectorsRouter);
app.use('/health', healthRouter);
app.use('/scrape', scrapeRouter);
app.use('/export', exportRouter);
app.use('/categories', categoryRouter);
app.use('/settings', settingsRouter);
app.use('/logs', logsRouter);
app.use('/products', productsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

async function bootstrap() {
  await mkdir(config.productsDir, { recursive: true });
  await fileService.ensureBaseDir();

  try {
    await prisma.$connect();
    await logger.log('success', 'Database connected');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  app.listen(config.port, config.host, () => {
    console.log(`Fetcher.io backend running at http://${config.host}:${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
