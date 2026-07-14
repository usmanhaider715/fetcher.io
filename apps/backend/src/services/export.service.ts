import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import type { ExportFormat } from '@fetcher/shared';
import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';
import { fileService } from './file.service.js';
import { logger } from './logger.service.js';

function parseJsonField<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export class ExportService {
  private exportDir = join(config.productsDir, '..', 'exports');

  async exportProducts(
    format: ExportFormat,
    sessionId?: string,
    productIds?: string[],
  ): Promise<{ path: string; count: number }> {
    await mkdir(this.exportDir, { recursive: true });

    const products = await prisma.product.findMany({
      where: {
        ...(sessionId ? { sessionId } : {}),
        ...(productIds?.length ? { id: { in: productIds } } : {}),
      },
      include: { images: true, category: true, subcategory: true },
      orderBy: { createdAt: 'desc' },
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rows = products.map((p) => ({
      uniqueId: p.uniqueId,
      title: p.title ?? '',
      brand: p.brand ?? '',
      sku: p.sku ?? '',
      price: p.price ?? '',
      salePrice: p.salePrice ?? '',
      currency: p.currency ?? '',
      category: p.category?.name ?? '',
      subcategory: p.subcategory?.name ?? '',
      productUrl: p.productUrl ?? '',
      platform: p.platform ?? '',
      imageCount: p.imageCount,
      description: p.description ?? '',
      availability: p.availability ?? '',
      rating: p.rating ?? '',
      scrapedDate: p.scrapedDate.toISOString(),
    }));

    switch (format) {
      case 'json': {
        const path = join(this.exportDir, `products_${timestamp}.json`);
        const data = products.map((p) => ({
          ...p,
          tags: parseJsonField<string[]>(p.tags),
          variants: parseJsonField(p.variants),
          specifications: parseJsonField(p.specifications),
          images: p.images,
        }));
        await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
        await logger.log('success', `Exported ${products.length} products to JSON`);
        return { path, count: products.length };
      }

      case 'csv': {
        const path = join(this.exportDir, `products_${timestamp}.csv`);
        const headers = Object.keys(rows[0] ?? { id: '' });
        const csv = [
          headers.join(','),
          ...rows.map((row) =>
            headers
              .map((h) => {
                const val = String(row[h as keyof typeof row] ?? '');
                return `"${val.replace(/"/g, '""')}"`;
              })
              .join(','),
          ),
        ].join('\n');
        await writeFile(path, csv, 'utf-8');
        await logger.log('success', `Exported ${products.length} products to CSV`);
        return { path, count: products.length };
      }

      case 'excel': {
        const path = join(this.exportDir, `products_${timestamp}.xlsx`);
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Products');
        XLSX.writeFile(wb, path);
        await logger.log('success', `Exported ${products.length} products to Excel`);
        return { path, count: products.length };
      }

      case 'txt': {
        const path = join(this.exportDir, `products_${timestamp}.txt`);
        const lines = products.map((p) =>
          [
            `ID: ${p.uniqueId}`,
            `Title: ${p.title}`,
            `Price: ${p.price} ${p.currency ?? ''}`,
            `URL: ${p.productUrl}`,
            '---',
          ].join('\n'),
        );
        await writeFile(path, lines.join('\n\n'), 'utf-8');
        await logger.log('success', `Exported ${products.length} products to TXT`);
        return { path, count: products.length };
      }

      case 'zip': {
        const path = join(this.exportDir, `products_${timestamp}.zip`);
        let sourceDir = config.productsDir;

        if (sessionId) {
          const session = await prisma.session.findUnique({ where: { id: sessionId } });
          const meta = session?.metadata
            ? (JSON.parse(session.metadata) as Record<string, unknown>)
            : {};
          const folderName = meta['folderName'] as string | undefined;
          if (folderName) {
            sourceDir = join(config.productsDir, folderName);
          }
        }

        await fileService.createZipArchive(sourceDir, path);
        await logger.log('success', `Exported session folder to ZIP`, sessionId);
        return { path, count: products.length };
      }

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}

export const exportService = new ExportService();
