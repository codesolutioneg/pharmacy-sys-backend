import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { toMoneyString } from '../utils/money';

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

async function getShopOrThrow(shopId: number) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    throw new AppError(404, 'SHOP_NOT_FOUND', 'Shop not found');
  }
  return shop;
}

export const stockService = {
  async listBatches(
    shopId: number,
    params: { page: number; limit: number; medicineId?: number; expireBefore?: Date },
  ) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.BatchWhereInput = {
      shopId,
      ...(params.medicineId ? { medicineId: params.medicineId } : {}),
      ...(params.expireBefore ? { expire: { lte: params.expireBefore } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.batch.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: params.limit,
      }),
      prisma.batch.count({ where }),
    ]);
    return { items, meta: { page: params.page, limit: params.limit, total } };
  },

  async updateBatchPrice(shopId: number, id: number, price: number) {
    const batch = await prisma.batch.findFirst({ where: { id, shopId } });
    if (!batch) {
      throw new AppError(404, 'BATCH_NOT_FOUND', 'Batch not found');
    }
    return prisma.batch.update({
      where: { id },
      data: { price: toMoneyString(price) },
    });
  },

  async summary(shopId: number, medicineId: number) {
    const medicine = await prisma.medicine.findFirst({ where: { id: medicineId, shopId } });
    if (!medicine) {
      throw new AppError(404, 'MEDICINE_NOT_FOUND', 'Medicine not found');
    }
    const agg = await prisma.batch.aggregate({
      where: { shopId, medicineId },
      _sum: { qty: true },
      _count: { _all: true },
    });
    return {
      medicineId,
      qty: agg._sum.qty ?? 0,
      batchCount: agg._count._all,
    };
  },

  async inStock(shopId: number) {
    const [medicines, sums] = await Promise.all([
      prisma.medicine.findMany({ where: { shopId } }),
      prisma.batch.groupBy({
        by: ['medicineId'],
        where: { shopId, qty: { gt: 0 } },
        _sum: { qty: true },
      }),
    ]);
    const sumMap = new Map(sums.map((s) => [s.medicineId, s._sum.qty ?? 0]));
    return medicines
      .map((m) => ({ medicine: m, qty: sumMap.get(m.id) ?? 0 }))
      .filter((row) => row.qty > 0);
  },

  async lowStock(shopId: number) {
    const shop = await getShopOrThrow(shopId);
    const [medicines, sums] = await Promise.all([
      prisma.medicine.findMany({ where: { shopId } }),
      prisma.batch.groupBy({
        by: ['medicineId'],
        where: { shopId, qty: { gt: 0 } },
        _sum: { qty: true },
      }),
    ]);
    const sumMap = new Map(sums.map((s) => [s.medicineId, s._sum.qty ?? 0]));
    return medicines
      .map((m) => ({ medicine: m, qty: sumMap.get(m.id) ?? 0 }))
      .filter((row) => row.qty < shop.lowStockAlert);
  },

  async outOfStock(shopId: number) {
    const [medicines, sums] = await Promise.all([
      prisma.medicine.findMany({ where: { shopId } }),
      prisma.batch.groupBy({
        by: ['medicineId'],
        where: { shopId },
        _sum: { qty: true },
      }),
    ]);
    const sumMap = new Map(sums.map((s) => [s.medicineId, s._sum.qty ?? 0]));
    return medicines
      .map((m) => ({ medicine: m, qty: sumMap.get(m.id) ?? 0 }))
      .filter((row) => row.qty === 0);
  },

  async expiring(shopId: number) {
    const shop = await getShopOrThrow(shopId);
    const today = startOfToday();
    const upperBound = addDays(today, shop.upcomingExpireAlert);
    return prisma.batch.findMany({
      where: {
        shopId,
        expire: { gt: today, lte: upperBound },
      },
      orderBy: { expire: 'asc' },
    });
  },

  async expired(shopId: number) {
    const today = startOfToday();
    return prisma.batch.findMany({
      where: {
        shopId,
        expire: { lte: today, not: null },
      },
      orderBy: { expire: 'asc' },
    });
  },
};
