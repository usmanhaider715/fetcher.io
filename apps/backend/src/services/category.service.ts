import { slugify } from '@fetcher/shared';
import { prisma } from '../lib/prisma.js';
import { logger } from './logger.service.js';

export class CategoryService {
  async getAll() {
    return prisma.category.findMany({
      include: { subcategories: true, _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(name: string) {
    const slug = slugify(name);
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      throw new Error(`Category "${name}" already exists`);
    }

    const category = await prisma.category.create({ data: { name, slug } });
    await logger.log('success', `Category created: ${name}`);
    return category;
  }

  async createSubcategory(categoryId: string, name: string) {
    const slug = slugify(name);
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new Error('Category not found');

    const existing = await prisma.subcategory.findUnique({
      where: { categoryId_slug: { categoryId, slug } },
    });
    if (existing) throw new Error(`Subcategory "${name}" already exists`);

    const subcategory = await prisma.subcategory.create({
      data: { categoryId, name, slug },
    });
    await logger.log('success', `Subcategory created: ${name} in ${category.name}`);
    return subcategory;
  }

  async delete(id: string) {
    await prisma.category.delete({ where: { id } });
    await logger.log('info', `Category deleted: ${id}`);
  }
}

export const categoryService = new CategoryService();
