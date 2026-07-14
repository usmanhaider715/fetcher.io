import { join } from 'node:path';
import type { Product, ScrapeProgress, StartScrapePayload } from '@fetcher/shared';
import { prisma } from '../lib/prisma.js';
import { logger } from './logger.service.js';
import { settingsService } from './settings.service.js';
import {
  productIdService,
  duplicateService,
  productToDbFields,
  computeProductHash,
} from './product.service.js';
import { fileService } from './file.service.js';
import { imageService } from './image.service.js';
import { imageQueueService } from './image-queue.service.js';
import { aiEnrichmentService } from './ai-enrichment.service.js';

export class SessionService {
  async create(
    mode: string,
    websiteUrl: string,
    productUrls?: string[],
    metadata?: Record<string, unknown>,
  ) {
    const folderName =
      (metadata?.['folderName'] as string | undefined) ??
      `scrape_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

    return prisma.session.create({
      data: {
        mode,
        status: 'running',
        websiteUrl,
        productUrls: productUrls ? JSON.stringify(productUrls) : null,
        metadata: JSON.stringify({ ...metadata, folderName }),
      },
    });
  }

  async getById(id: string) {
    return prisma.session.findUnique({ where: { id } });
  }

  async updateProgress(id: string, data: Partial<ScrapeProgress>) {
    return prisma.session.update({
      where: { id },
      data: {
        status: data.status,
        productsFound: data.productsFound,
        productsSaved: data.productsSaved,
        imagesDownloaded: data.imagesDownloaded,
        errors: data.errors,
        currentUrl: data.currentUrl,
        ...(data.status === 'completed' ? { completedAt: new Date() } : {}),
        ...(data.status === 'paused' ? { pausedAt: new Date() } : {}),
      },
    });
  }

  async pause(id: string) {
    return prisma.session.update({
      where: { id },
      data: { status: 'paused', pausedAt: new Date() },
    });
  }

  async resume(id: string) {
    const session = await this.getById(id);
    if (!session) throw new Error('Session not found');
    return prisma.session.update({
      where: { id },
      data: { status: 'running', pausedAt: null },
    });
  }

  async stop(id: string) {
    return prisma.session.update({
      where: { id },
      data: { status: 'stopped' },
    });
  }

  async getProgress(id: string): Promise<ScrapeProgress | null> {
    const session = await this.getById(id);
    if (!session) return null;

    const percent =
      session.productsFound > 0
        ? Math.round((session.productsSaved / session.productsFound) * 100)
        : 0;

    return {
      sessionId: session.id,
      status: session.status as ScrapeProgress['status'],
      productsFound: session.productsFound,
      productsSaved: session.productsSaved,
      imagesDownloaded: session.imagesDownloaded,
      imagesPending: imageQueueService.getPending(session.id),
      errors: session.errors,
      currentUrl: session.currentUrl ?? undefined,
      percentComplete: percent,
    };
  }
}

export class ScrapeService {
  private sessionService = new SessionService();

  async processProduct(
    product: Product,
    sessionId: string,
    categoryId?: string,
    subcategoryId?: string,
  ) {
    const settings = await settingsService.get();
    await fileService.ensureBaseDir();

    let productToSave = product;
    if (settings.aiEnrichmentEnabled && settings.openAiApiKey) {
      const enriched = await aiEnrichmentService.enrichProduct(product, sessionId);
      if (enriched.enriched) productToSave = enriched.product;
    }

    productToSave.hash = productToSave.hash ?? computeProductHash(productToSave);

    const dup = await duplicateService.isDuplicate(
      productToSave,
      settings.duplicateDetection,
      sessionId,
    );
    if (dup.isDuplicate) {
      await logger.log(
        'warning',
        `Duplicate product skipped (${dup.reason}): ${productToSave.title}`,
        sessionId,
        { productUrl: productToSave.productUrl, reason: dup.reason },
      );
      return { saved: false, reason: 'duplicate', existingId: dup.existingId };
    }

    let categoryName: string | undefined;
    let subcategoryName: string | undefined;
    let categorySlug: string | undefined;
    let subcategorySlug: string | undefined;

    if (categoryId) {
      const cat = await prisma.category.findUnique({
        where: { id: categoryId },
        include: { subcategories: true },
      });
      if (cat) {
        categoryName = cat.name;
        categorySlug = cat.slug;
        if (subcategoryId) {
          const sub = cat.subcategories.find((s) => s.id === subcategoryId);
          if (sub) {
            subcategoryName = sub.name;
            subcategorySlug = sub.slug;
          }
        }
      }
    }

    const uniqueId = await productIdService.generate(categorySlug, subcategorySlug);
    productToSave.uniqueId = uniqueId;
    productToSave.category = categoryName;
    productToSave.subcategory = subcategoryName;

    const session = await this.sessionService.getById(sessionId);
    const sessionMeta = session?.metadata ? (JSON.parse(session.metadata) as Record<string, unknown>) : {};
    const sessionFolder = sessionMeta['folderName'] as string | undefined;

    let folderPath: string | undefined;
    let dbProductId: string | undefined;

    try {
      folderPath = await fileService.createProductFolder(
        uniqueId,
        categoryName,
        subcategoryName,
        productToSave.title,
        sessionFolder,
      );

      const imageUrls = (productToSave.imageUrls ?? productToSave.images?.map((i) => i.url) ?? [])
        .map((url) => url.trim())
        .filter(Boolean);

      const dbProduct = await prisma.product.create({
        data: {
          ...productToDbFields(productToSave, uniqueId, sessionId),
          categoryId: categoryId ?? null,
          subcategoryId: subcategoryId ?? null,
          folderPath,
          imageCount: 0,
        },
      });
      dbProductId = dbProduct.id;

      const useAsyncImages = settings.asyncImageDownloads !== false;

      if (useAsyncImages && imageUrls.length > 0) {
        await fileService.writeDetailsTxt(productToSave, folderPath, []);
        await fileService.writeDetailsJson(productToSave, folderPath, []);

        imageQueueService.enqueue({
          productId: dbProduct.id,
          product: productToSave,
          imageUrls,
          folderPath,
          sessionId,
          productUrl: productToSave.productUrl,
        });

        await prisma.session.update({
          where: { id: sessionId },
          data: { productsSaved: { increment: 1 } },
        });

        await logger.log('success', `Product saved (images queued): ${productToSave.title ?? uniqueId}`, sessionId, {
          adapter: productToSave.platform,
          productUrl: productToSave.productUrl,
          uniqueId,
          imagesPending: imageUrls.length,
        });

        return {
          saved: true,
          productId: dbProduct.id,
          uniqueId,
          folderPath,
          imagesDownloaded: 0,
          imagesPending: imageUrls.length,
        };
      }

      const { filenames, downloaded } = await imageService.downloadProductImages(
        dbProduct.id,
        imageUrls,
        join(folderPath, 'images'),
        sessionId,
        productToSave.productUrl,
      );

      await prisma.product.update({
        where: { id: dbProduct.id },
        data: { imageCount: filenames.length },
      });

      await fileService.writeDetailsTxt(productToSave, folderPath, filenames);
      await fileService.writeDetailsJson(productToSave, folderPath, filenames);

      await prisma.session.update({
        where: { id: sessionId },
        data: {
          productsSaved: { increment: 1 },
          imagesDownloaded: { increment: downloaded },
        },
      });

      await logger.log('success', `Product saved: ${productToSave.title ?? uniqueId}`, sessionId, {
        adapter: productToSave.platform,
        productUrl: productToSave.productUrl,
        uniqueId,
        imagesDownloaded: downloaded,
        imageCount: filenames.length,
      });

      return { saved: true, productId: dbProduct.id, uniqueId, folderPath, imagesDownloaded: downloaded };
    } catch (error) {
      if (dbProductId) {
        await prisma.product.delete({ where: { id: dbProductId } }).catch(() => {});
      }
      if (folderPath) {
        await fileService.removeProductFolder(folderPath).catch(() => {});
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      await logger.log('error', `Product save failed: ${message}`, sessionId, {
        adapter: productToSave.platform,
        productUrl: productToSave.productUrl,
        uniqueId,
      });
      throw error;
    }
  }

  async startScrape(
    payload: StartScrapePayload & {
      websiteUrl: string;
      products?: Product[];
      folderName?: string;
    },
  ) {
    const session = await this.sessionService.create(
      payload.mode,
      payload.websiteUrl,
      payload.urls,
      {
        folderName: payload.folderName,
        categoryId: payload.categoryId,
        subcategoryId: payload.subcategoryId,
      },
    );

    await logger.log('info', `Scrape session started: ${payload.mode}`, session.id);

    const products = payload.products ?? [];
    let saved = 0;
    let errors = 0;

    await prisma.session.update({
      where: { id: session.id },
      data: { productsFound: products.length || payload.urls?.length || 1 },
    });

    for (const product of products) {
      try {
        const result = await this.processProduct(
          product,
          session.id,
          payload.categoryId,
          payload.subcategoryId,
        );
        if (result.saved) saved++;
      } catch (error) {
        errors++;
        const msg = error instanceof Error ? error.message : 'Unknown error';
        await logger.log('error', `Failed to save product: ${msg}`, session.id);
      }
    }

    const finalStatus = errors > 0 && saved === 0 ? 'error' : 'completed';
    await this.sessionService.updateProgress(session.id, {
      sessionId: session.id,
      status: finalStatus,
      productsFound: products.length,
      productsSaved: saved,
      imagesDownloaded: 0,
      errors,
      percentComplete: 100,
    });

    const meta = session.metadata ? (JSON.parse(session.metadata) as Record<string, unknown>) : {};

    return {
      sessionId: session.id,
      productsSaved: saved,
      errors,
      folderName: meta['folderName'] as string | undefined,
    };
  }

  getSessionService() {
    return this.sessionService;
  }
}

export const scrapeService = new ScrapeService();
export const sessionService = scrapeService.getSessionService();
