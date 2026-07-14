import { Worker } from 'bullmq';
import { config } from './config/index.js';
import { connectMongo } from './lib/mongo.js';

const connection = { url: config.redisUrl };

const worker = new Worker(
  'connector-publish',
  async (job) => {
    console.log(`[worker] Processing publish job ${job.id}`, job.data);
    await new Promise((r) => setTimeout(r, 1000));
    return { success: true, productId: job.data.productId };
  },
  { connection },
);

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message);
});

async function start() {
  await connectMongo();
  console.log('Fetcher.io connector worker started');
}

start().catch(console.error);
