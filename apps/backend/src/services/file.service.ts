import { resolve, join } from 'node:path';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, writeFile, rm } from 'node:fs/promises';
import archiver from 'archiver';
import type { Product } from '@fetcher/shared';
import { sanitizeFilename } from '@fetcher/shared';
import { config } from '../config/index.js';
import { buildFolderName } from './product.service.js';

export class FileService {
  private baseDir: string;

  constructor(baseDir = config.productsDir) {
    this.baseDir = baseDir;
  }

  async ensureBaseDir(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
  }

  getProductDir(
    uniqueId: string,
    category?: string,
    subcategory?: string,
    title?: string,
    sessionFolder?: string,
  ): string {
    const parts = [this.baseDir];
    if (sessionFolder) parts.push(sanitizeFilename(sessionFolder));
    if (category) parts.push(sanitizeFilename(category));
    if (subcategory) parts.push(sanitizeFilename(subcategory));
    parts.push(buildFolderName(uniqueId, title));
    return resolve(...parts);
  }

  async createProductFolder(
    uniqueId: string,
    category?: string,
    subcategory?: string,
    title?: string,
    sessionFolder?: string,
  ): Promise<string> {
    const dir = this.getProductDir(uniqueId, category, subcategory, title, sessionFolder);
    await mkdir(join(dir, 'images'), { recursive: true });
    await mkdir(join(dir, 'videos'), { recursive: true });
    await mkdir(join(dir, 'documents'), { recursive: true });
    return dir;
  }

  async removeProductFolder(folderPath: string): Promise<void> {
    await rm(folderPath, { recursive: true, force: true });
  }

  private async writeAtomic(filePath: string, content: string): Promise<void> {
    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, content, 'utf-8');
    await rename(tmpPath, filePath);
  }

  async writeDetailsTxt(product: Product, folderPath: string, imageFilenames: string[]): Promise<void> {
    const lines: string[] = [
      '='.repeat(60),
      'FETCHER.IO PRODUCT DETAILS',
      '='.repeat(60),
      '',
      `Scraped: ${new Date().toISOString()}`,
      '',
    ];

    const fields: Array<[string, unknown]> = [
      ['Unique ID', product.uniqueId],
      ['Title', product.title],
      ['Subtitle', product.subtitle],
      ['Brand', product.brand],
      ['SKU', product.sku],
      ['Barcode', product.barcode],
      ['Price', product.price],
      ['Sale Price', product.salePrice],
      ['Currency', product.currency],
      ['Discount', product.discount],
      ['Stock', product.stock],
      ['Availability', product.availability],
      ['Rating', product.rating],
      ['Review Count', product.reviewCount],
      ['Website', product.website],
      ['Supplier', product.supplier],
      ['Category', product.category],
      ['Subcategory', product.subcategory],
      ['Product URL', product.productUrl],
      ['Platform', product.platform],
      ['Description', product.description],
      ['Short Description', product.shortDescription],
      ['Weight', product.weight],
      ['Dimensions', product.dimensions],
      ['Material', product.material],
      ['Country', product.country],
      ['Shipping', product.shipping],
      ['Meta Title', product.metaTitle],
      ['Meta Description', product.metaDescription],
      ['Canonical URL', product.canonicalUrl],
      ['Tags', product.tags?.join(', ')],
      ['Collections', product.collections?.join(', ')],
      ['Colors', product.colors?.join(', ')],
      ['Sizes', product.sizes?.join(', ')],
      ['Breadcrumbs', product.breadcrumbs?.join(' > ')],
      ['SEO Keywords', product.seoKeywords?.join(', ')],
    ];

    for (const [label, value] of fields) {
      if (value !== undefined && value !== null && value !== '') {
        lines.push(`${label}: ${value}`);
      }
    }

    if (product.specifications && Object.keys(product.specifications).length > 0) {
      lines.push('', '--- Specifications ---');
      for (const [key, val] of Object.entries(product.specifications)) {
        lines.push(`${key}: ${val}`);
      }
    }

    if (product.attributes && Object.keys(product.attributes).length > 0) {
      lines.push('', '--- Attributes ---');
      for (const [key, val] of Object.entries(product.attributes)) {
        lines.push(`${key}: ${val}`);
      }
    }

    if (product.variants && product.variants.length > 0) {
      lines.push('', '--- Variants ---');
      product.variants.forEach((v, i) => {
        lines.push(`Variant ${i + 1}: ${v.title ?? v.sku ?? 'Unknown'}`);
        if (v.price) lines.push(`  Price: ${v.price}`);
        if (v.sku) lines.push(`  SKU: ${v.sku}`);
        if (v.color) lines.push(`  Color: ${v.color}`);
        if (v.size) lines.push(`  Size: ${v.size}`);
      });
    }

    if (imageFilenames.length > 0) {
      lines.push('', '--- Images ---');
      imageFilenames.forEach((f) => lines.push(`  images/${f}`));
    }

    lines.push('', '='.repeat(60));

    await this.writeAtomic(join(folderPath, 'details.txt'), lines.join('\n'));
  }

  async writeDetailsJson(product: Product, folderPath: string, imageFilenames: string[]): Promise<void> {
    const data = {
      ...product,
      scrapedDate: new Date().toISOString(),
      localImages: imageFilenames.map((f) => `images/${f}`),
    };
    await this.writeAtomic(
      join(folderPath, 'details.json'),
      JSON.stringify(data, null, 2),
    );
  }

  async createZipArchive(sourceDir: string, outputPath: string): Promise<string> {
    await mkdir(resolve(outputPath, '..'), { recursive: true });

    return new Promise((resolvePromise, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolvePromise(outputPath));
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }
}

export const fileService = new FileService();
