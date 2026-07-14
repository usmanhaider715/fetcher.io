import { createHash } from 'node:crypto';
import { join, extname, basename } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import axios from 'axios';
import sharp from 'sharp';
import pLimit from 'p-limit';
import { isValidUrl, normalizeImageUrl, sanitizeFilename } from '@fetcher/shared';
import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';
import { logger } from './logger.service.js';
import { settingsService } from './settings.service.js';

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);

export class ImageService {
  private getExtension(url: string, contentType?: string): string {
    const fromUrl = extname(new URL(url).pathname).toLowerCase();
    if (SUPPORTED_EXTENSIONS.has(fromUrl)) return fromUrl.replace('.', '');

    if (contentType?.includes('png')) return 'png';
    if (contentType?.includes('webp')) return 'webp';
    if (contentType?.includes('gif')) return 'gif';
    if (contentType?.includes('svg')) return 'svg';
    return 'jpg';
  }

  private async downloadWithRetry(url: string, retries: number, referer?: string): Promise<Buffer> {
    let lastError: Error | null = null;
    const normalizedUrl = normalizeImageUrl(url);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const headers: Record<string, string> = {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        };
        if (referer) headers['Referer'] = referer;

        const response = await axios.get(normalizedUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers,
          maxRedirects: 5,
        });
        return Buffer.from(response.data);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError ?? new Error('Download failed');
  }

  private computeImageHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  }

  async downloadProductImages(
    productId: string,
    imageUrls: string[],
    imagesDir: string,
    sessionId?: string,
    referer?: string,
  ): Promise<{ filenames: string[]; downloaded: number; skipped: number }> {
    const settings = await settingsService.get();
    const limit = pLimit(settings.concurrentDownloads);
    const filenames: string[] = [];
    let downloaded = 0;
    let skipped = 0;
    const seenHashes = new Set<string>();

    await mkdir(imagesDir, { recursive: true });

    const uniqueUrls = [...new Set(imageUrls.map(normalizeImageUrl).filter((u) => isValidUrl(u)))];

    const tasks = uniqueUrls.map((url, index) =>
      limit(async () => {
        const downloadRecord = await prisma.download.create({
          data: { url, productId, sessionId: sessionId ?? null, status: 'pending' },
        });

        try {
          const buffer = await this.downloadWithRetry(url, settings.retryCount, referer);
          const hash = this.computeImageHash(buffer);

          if (seenHashes.has(hash)) {
            skipped++;
            await prisma.download.update({
              where: { id: downloadRecord.id },
              data: { status: 'skipped', error: 'Duplicate image hash' },
            });
            return;
          }
          seenHashes.add(hash);

          let processed = buffer;
          const metadata = await sharp(buffer).metadata().catch(() => null);

          if (settings.resizeImages && metadata?.width && metadata.width > settings.maxImageWidth) {
            processed = await sharp(buffer)
              .resize(settings.maxImageWidth, undefined, { withoutEnlargement: true })
              .toBuffer();
          }

          const ext = this.getExtension(
            url,
            metadata?.format ? `image/${metadata.format}` : undefined,
          );
          const isCover = index === 0;
          const filename = isCover ? `cover.${ext}` : `image_${String(index).padStart(2, '0')}.${ext}`;
          const localPath = join(imagesDir, sanitizeFilename(filename));

          if (settings.compressionEnabled && ext !== 'svg' && ext !== 'gif') {
            const outputPath =
              ext === 'png' || ext === 'webp'
                ? localPath
                : localPath.replace(/\.[^.]+$/, '.jpg');
            const pipeline = sharp(processed);
            if (ext === 'png') {
              await pipeline.png({ quality: 95 }).toFile(outputPath);
            } else if (ext === 'webp') {
              await pipeline.webp({ quality: 95 }).toFile(outputPath);
            } else {
              await pipeline.jpeg({ quality: Math.max(config.compressionQuality, 92) }).toFile(outputPath);
            }
            filenames.push(sanitizeFilename(basename(outputPath)));
          } else {
            await writeFile(localPath, processed);
            filenames.push(sanitizeFilename(filename));
          }

          let thumbnailPath: string | null = null;
          if (settings.createThumbnails && ext !== 'svg') {
            thumbnailPath = join(imagesDir, `thumb_${sanitizeFilename(filename)}`);
            await sharp(processed)
              .resize(200, 200, { fit: 'cover' })
              .jpeg({ quality: 70 })
              .toFile(thumbnailPath);
          }

          const finalFilename = filenames[filenames.length - 1] ?? filename;

          await prisma.image.create({
            data: {
              productId,
              url,
              filename: finalFilename,
              localPath: join(imagesDir, finalFilename),
              thumbnailPath,
              position: index,
              isCover,
              hash,
              width: metadata?.width ?? null,
              height: metadata?.height ?? null,
              size: processed.length,
            },
          });

          await prisma.download.update({
            where: { id: downloadRecord.id },
            data: { status: 'completed', filename: finalFilename, localPath: join(imagesDir, finalFilename) },
          });

          downloaded++;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          await prisma.download.update({
            where: { id: downloadRecord.id },
            data: { status: 'failed', error: message, retries: settings.retryCount },
          });
          await logger.log('error', `Image download failed: ${url} - ${message}`, sessionId);
        }
      }),
    );

    await Promise.all(tasks);
    return { filenames, downloaded, skipped };
  }
}

export const imageService = new ImageService();
