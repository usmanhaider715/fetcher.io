import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { connectMongo } from './lib/mongo.js';
import { healthRouter, v1Router, webhooksRouter, adminRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  }),
);

app.use('/webhooks', express.raw({ type: 'application/json' }), webhooksRouter);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use('/health', healthRouter);
app.use('/v1', v1Router);
app.use('/admin', adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

async function bootstrap() {
  await connectMongo();
  app.listen(config.port, config.host, () => {
    console.log(`Fetcher.io API running at http://${config.host}:${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});

export default app;
