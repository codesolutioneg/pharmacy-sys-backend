import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export const vendorsService = {
  async list(shopId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.vendor.findMany({
        where: { shopId },
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
      prisma.vendor.count({ where: { shopId } }),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(shopId: number, id: number) {
    const vendor = await prisma.vendor.findFirst({ where: { id, shopId } });
    if (!vendor) {
      throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
    }
    return vendor;
  },

  async create(shopId: number, data: { name: string; phone: string; address: string }) {
    return prisma.vendor.create({
      data: {
        shopId,
        name: data.name,
        phone: data.phone,
        address: data.address,
        due: 0,
        payable: 0,
      },
    });
  },

  async update(
    shopId: number,
    id: number,
    data: { name?: string; phone?: string; address?: string },
  ) {
    await this.getById(shopId, id);
    return prisma.vendor.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
      },
    });
  },

  async remove(shopId: number, id: number) {
    await this.getById(shopId, id);
    await prisma.vendor.delete({ where: { id } });
    return { message: 'Vendor deleted' };
  },
};
