import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export const medicineTypesService = {
  async list(shopId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.medicineType.findMany({
        where: { shopId },
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
      prisma.medicineType.count({ where: { shopId } }),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(shopId: number, id: number) {
    const type = await prisma.medicineType.findFirst({ where: { id, shopId } });
    if (!type) {
      throw new AppError(404, 'MEDICINE_TYPE_NOT_FOUND', 'Medicine type not found');
    }
    return type;
  },

  async create(shopId: number, data: { name: string; status?: number }) {
    const clash = await prisma.medicineType.findFirst({ where: { shopId, name: data.name } });
    if (clash) {
      throw new AppError(409, 'MEDICINE_TYPE_EXISTS', 'Medicine type name already in use');
    }
    return prisma.medicineType.create({
      data: { shopId, name: data.name, status: data.status ?? 1 },
    });
  },

  async update(shopId: number, id: number, data: { name?: string; status?: number }) {
    const type = await this.getById(shopId, id);
    if (data.name && data.name !== type.name) {
      const clash = await prisma.medicineType.findFirst({
        where: { shopId, name: data.name, id: { not: id } },
      });
      if (clash) {
        throw new AppError(409, 'MEDICINE_TYPE_EXISTS', 'Medicine type name already in use');
      }
    }
    return prisma.medicineType.update({
      where: { id },
      data: { name: data.name, status: data.status },
    });
  },

  async remove(shopId: number, id: number) {
    await this.getById(shopId, id);
    await prisma.medicineType.delete({ where: { id } });
    return { message: 'Medicine type deleted' };
  },
};
