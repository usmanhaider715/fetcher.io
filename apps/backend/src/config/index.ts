import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnv({ path: resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env['PORT'] ?? '3847', 10),
  host: process.env['HOST'] ?? '127.0.0.1',
  productsDir: resolve(__dirname, '../../', process.env['PRODUCTS_DIR'] ?? './data/products'),
  databaseUrl: process.env['DATABASE_URL'] ?? 'file:./data/fetcher.db',
  concurrentDownloads: parseInt(process.env['CONCURRENT_DOWNLOADS'] ?? '3', 10),
  retryCount: parseInt(process.env['RETRY_COUNT'] ?? '3', 10),
  delayMs: parseInt(process.env['DELAY_MS'] ?? '500', 10),
  maxImageWidth: parseInt(process.env['MAX_IMAGE_WIDTH'] ?? '1920', 10),
  compressionQuality: parseInt(process.env['COMPRESSION_QUALITY'] ?? '85', 10),
};
