import { ActiveStatus, CategoryKind } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { slugify } from '../utils/slugify';

async function uniqueSlug(shopId: number, title: string, excludeId?: number): Promise<string> {
  const base = slugify(title) || `category-${Date.now()}`;
  let slug = base;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.productCategory.findFirst({
      where: { shopId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (!clash) return slug;
    slug = `${base}-${++suffix}`;
  }
}

export const productCategoriesService = {
  async list(shopId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.productCategory.findMany({
        where: { shopId },
        orderBy: [{ sorting: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.productCategory.count({ where: { shopId } }),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(shopId: number, id: number) {
    const category = await prisma.productCategory.findFirst({ where: { id, shopId } });
    if (!category) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }
    return category;
  },

  async create(
    shopId: number,
    data: {
      title: string;
      type?: CategoryKind;
      status?: ActiveStatus;
      sorting?: number;
      image?: string | null;
      banner?: string | null;
    },
  ) {
    const slug = await uniqueSlug(shopId, data.title);
    return prisma.productCategory.create({
      data: {
        shopId,
        title: data.title,
        slug,
        type: data.type ?? 'inventory',
        status: data.status ?? 'active',
        sorting: data.sorting ?? 0,
        image: data.image ?? null,
        banner: data.banner ?? null,
      },
    });
  },

  async update(
    shopId: number,
    id: number,
    data: {
      title?: string;
      type?: CategoryKind;
      status?: ActiveStatus;
      sorting?: number;
      image?: string | null;
      banner?: string | null;
    },
  ) {
    const category = await this.getById(shopId, id);
    const slug =
      data.title && data.title !== category.title
        ? await uniqueSlug(shopId, data.title, id)
        : undefined;
    return prisma.productCategory.update({
      where: { id },
      data: {
        title: data.title,
        slug,
        type: data.type,
        status: data.status,
        sorting: data.sorting,
        image: data.image,
        banner: data.banner,
      },
    });
  },

  async remove(shopId: number, id: number) {
    await this.getById(shopId, id);
    await prisma.productCategory.delete({ where: { id } });
    return { message: 'Category deleted' };
  },
};
