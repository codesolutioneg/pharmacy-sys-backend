import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export const unitsService = {
  async list(shopId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.unit.findMany({
        where: { shopId },
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
      prisma.unit.count({ where: { shopId } }),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(shopId: number, id: number) {
    const unit = await prisma.unit.findFirst({ where: { id, shopId } });
    if (!unit) {
      throw new AppError(404, 'UNIT_NOT_FOUND', 'Unit not found');
    }
    return unit;
  },

  async create(shopId: number, data: { name: string; status?: number }) {
    const clash = await prisma.unit.findFirst({ where: { shopId, name: data.name } });
    if (clash) {
      throw new AppError(409, 'UNIT_EXISTS', 'Unit name already in use');
    }
    return prisma.unit.create({
      data: { shopId, name: data.name, status: data.status ?? 1 },
    });
  },

  async update(shopId: number, id: number, data: { name?: string; status?: number }) {
    const unit = await this.getById(shopId, id);
    if (data.name && data.name !== unit.name) {
      const clash = await prisma.unit.findFirst({
        where: { shopId, name: data.name, id: { not: id } },
      });
      if (clash) {
        throw new AppError(409, 'UNIT_EXISTS', 'Unit name already in use');
      }
    }
    return prisma.unit.update({
      where: { id },
      data: { name: data.name, status: data.status },
    });
  },

  async remove(shopId: number, id: number) {
    await this.getById(shopId, id);
    await prisma.unit.delete({ where: { id } });
    return { message: 'Unit deleted' };
  },
};
