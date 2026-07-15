import type { Category, Subcategory } from '@fetcher/shared';
import { STORAGE_KEYS, generateRequestId } from '@fetcher/shared';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

async function loadCategories(): Promise<Category[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CATEGORIES);
  return (result[STORAGE_KEYS.CATEGORIES] as Category[] | undefined) ?? [];
}

async function saveCategories(categories: Category[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CATEGORIES]: categories });
}

export async function getCategories(): Promise<Category[]> {
  return loadCategories();
}

export async function createCategory(name: string): Promise<Category> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name required');

  const categories = await loadCategories();
  const slug = slugify(trimmed);
  if (categories.some((c) => c.slug === slug)) {
    throw new Error(`Category "${trimmed}" already exists`);
  }

  const now = new Date().toISOString();
  const category: Category = {
    id: generateRequestId(),
    name: trimmed,
    slug,
    subcategories: [],
    createdAt: now,
    updatedAt: now,
  };

  categories.push(category);
  await saveCategories(categories);
  return category;
}

export async function createSubcategory(categoryId: string, name: string): Promise<Subcategory> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Subcategory name required');

  const categories = await loadCategories();
  const category = categories.find((c) => c.id === categoryId);
  if (!category) throw new Error('Category not found');

  const slug = slugify(trimmed);
  if (category.subcategories?.some((s) => s.slug === slug)) {
    throw new Error(`Subcategory "${trimmed}" already exists`);
  }

  const now = new Date().toISOString();
  const sub: Subcategory = {
    id: generateRequestId(),
    categoryId,
    name: trimmed,
    slug,
    createdAt: now,
    updatedAt: now,
  };

  category.subcategories = [...(category.subcategories ?? []), sub];
  category.updatedAt = now;
  await saveCategories(categories);
  return sub;
}
