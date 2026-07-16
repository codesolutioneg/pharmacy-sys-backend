import { ActiveStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

/**
 * Languages are a global admin catalog (Laravel's `languages` table has no `shop_id` at all;
 * Node's optional `shopId` only records which shop created the row — it does not scope
 * visibility). `iso` is globally unique (languages.md acceptance criteria: duplicate iso -> 409).
 */
export const languagesService = {
  async list(params: { page: number; limit: number; status?: ActiveStatus }) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.LanguageWhereInput = params.status ? { status: params.status } : {};
    const [items, total] = await Promise.all([
      prisma.language.findMany({ where, orderBy: { id: 'asc' }, skip, take: params.limit }),
      prisma.language.count({ where }),
    ]);
    return { items, meta: { page: params.page, limit: params.limit, total } };
  },

  async getById(id: number) {
    const language = await prisma.language.findUnique({ where: { id } });
    if (!language) {
      throw new AppError(404, 'LANGUAGE_NOT_FOUND', 'Language not found');
    }
    return language;
  },

  async create(
    shopId: number,
    data: { name: string; iso: string; icon?: string | null; status?: ActiveStatus },
  ) {
    const clash = await prisma.language.findUnique({ where: { iso: data.iso } });
    if (clash) {
      throw new AppError(409, 'LANGUAGE_ISO_EXISTS', `Language iso "${data.iso}" already exists`);
    }
    return prisma.language.create({
      data: {
        shopId,
        name: data.name,
        iso: data.iso,
        icon: data.icon ?? null,
        status: data.status ?? 'active',
        terms: {},
      },
    });
  },

  async update(
    id: number,
    data: { name?: string; icon?: string | null; status?: ActiveStatus },
  ) {
    await this.getById(id);
    return prisma.language.update({
      where: { id },
      data: {
        name: data.name,
        icon: data.icon,
        status: data.status,
      },
    });
  },

  /** Deleting the current default (if any) must not break locale resolution downstream —
   * there is no separate "default" flag in this schema, so deletion is always safe here. */
  async remove(id: number) {
    await this.getById(id);
    await prisma.language.delete({ where: { id } });
    return { message: 'Language deleted' };
  },

  /** Merge (not replace): keys omitted from the request retain their previous value. */
  async updateTerms(id: number, partialTerms: Record<string, unknown>) {
    const language = await this.getById(id);
    const existingTerms =
      language.terms && typeof language.terms === 'object' && !Array.isArray(language.terms)
        ? (language.terms as Record<string, unknown>)
        : {};
    const merged = { ...existingTerms, ...partialTerms };
    return prisma.language.update({
      where: { id },
      data: { terms: merged as unknown as Prisma.InputJsonValue },
    });
  },
};
