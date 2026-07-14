import { join } from 'node:path';
import { prisma } from '../lib/prisma.js';
import { imageService } from './image.service.js';
import { fileService } from './file.service.js';
import { logger } from './logger.service.js';
import type { Product } from '@fetcher/shared';

interface ImageJob {
  productId: string;
  product: Product;
  imageUrls: string[];
  folderPath: string;
  sessionId: string;
  productUrl?: string;
}

class ImageQueueService {
  private queue: ImageJob[] = [];
  private active = 0;
  private maxConcurrent = 3;
  private pendingBySession = new Map<string, number>();

  getPending(sessionId: string): number {
    return this.pendingBySession.get(sessionId) ?? 0;
  }

  enqueue(job: ImageJob): void {
    this.queue.push(job);
    const current = this.pendingBySession.get(job.sessionId) ?? 0;
    this.pendingBySession.set(job.sessionId, current + job.imageUrls.length);
    void this.drain();
  }

  private async drain(): Promise<void> {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      this.active++;
      void this.process(job)
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Image download failed';
          void logger.log('error', `Async image download failed: ${message}`, job.sessionId, {
            productId: job.productId,
          });
        })
        .finally(() => {
          this.active--;
          const pending = (this.pendingBySession.get(job.sessionId) ?? 0) - job.imageUrls.length;
          this.pendingBySession.set(job.sessionId, Math.max(0, pending));
          void this.drain();
        });
    }
  }

  private async process(job: ImageJob): Promise<void> {
    const { filenames, downloaded } = await imageService.downloadProductImages(
      job.productId,
      job.imageUrls,
      join(job.folderPath, 'images'),
      job.sessionId,
      job.productUrl,
    );

    await prisma.product.update({
      where: { id: job.productId },
      data: { imageCount: filenames.length },
    });

    await fileService.writeDetailsTxt(job.product, job.folderPath, filenames);
    await fileService.writeDetailsJson(job.product, job.folderPath, filenames);

    await prisma.session.update({
      where: { id: job.sessionId },
      data: { imagesDownloaded: { increment: downloaded } },
    });

    await logger.log('info', `Async images downloaded: ${downloaded}`, job.sessionId, {
      productId: job.productId,
      imageCount: filenames.length,
    });
  }
}

export const imageQueueService = new ImageQueueService();
