import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export const leavesService = {
  async list(shopId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.leaf.findMany({
        where: { shopId },
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
      prisma.leaf.count({ where: { shopId } }),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(shopId: number, id: number) {
    const leaf = await prisma.leaf.findFirst({ where: { id, shopId } });
    if (!leaf) {
      throw new AppError(404, 'LEAF_NOT_FOUND', 'Leaf not found');
    }
    return leaf;
  },

  async create(shopId: number, data: { name: string; amount?: number }) {
    const clash = await prisma.leaf.findFirst({ where: { shopId, name: data.name } });
    if (clash) {
      throw new AppError(409, 'LEAF_EXISTS', 'Leaf name already in use');
    }
    return prisma.leaf.create({
      data: { shopId, name: data.name, amount: data.amount ?? 1 },
    });
  },

  async update(shopId: number, id: number, data: { name?: string; amount?: number }) {
    const leaf = await this.getById(shopId, id);
    if (data.name && data.name !== leaf.name) {
      const clash = await prisma.leaf.findFirst({
        where: { shopId, name: data.name, id: { not: id } },
      });
      if (clash) {
        throw new AppError(409, 'LEAF_EXISTS', 'Leaf name already in use');
      }
    }
    return prisma.leaf.update({
      where: { id },
      data: { name: data.name, amount: data.amount },
    });
  },

  async remove(shopId: number, id: number) {
    await this.getById(shopId, id);
    await prisma.leaf.delete({ where: { id } });
    return { message: 'Leaf deleted' };
  },
};
