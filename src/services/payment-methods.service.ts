import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { add, toMoneyString } from '../utils/money';

export const paymentMethodsService = {
  async list(shopId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.paymentMethod.findMany({
        where: { shopId },
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
      prisma.paymentMethod.count({ where: { shopId } }),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(shopId: number, id: number) {
    const method = await prisma.paymentMethod.findFirst({ where: { id, shopId } });
    if (!method) {
      throw new AppError(404, 'PAYMENT_METHOD_NOT_FOUND', 'Payment method not found');
    }
    return method;
  },

  async create(shopId: number, data: { name: string; balance?: number; isInsurance?: boolean }) {
    const existing = await prisma.paymentMethod.findFirst({
      where: { shopId, name: data.name },
    });
    if (existing) {
      throw new AppError(409, 'PAYMENT_METHOD_EXISTS', 'Payment method name already in use');
    }
    return prisma.paymentMethod.create({
      data: {
        shopId,
        name: data.name,
        balance: toMoneyString(data.balance ?? 0),
        isInsurance: data.isInsurance ?? false,
      },
    });
  },

  async update(shopId: number, id: number, data: { name?: string; isInsurance?: boolean }) {
    const method = await this.getById(shopId, id);
    if (data.name && data.name !== method.name) {
      const clash = await prisma.paymentMethod.findFirst({
        where: { shopId, name: data.name },
      });
      if (clash) {
        throw new AppError(409, 'PAYMENT_METHOD_EXISTS', 'Payment method name already in use');
      }
    }
    return prisma.paymentMethod.update({
      where: { id },
      data: { name: data.name, isInsurance: data.isInsurance },
    });
  },

  async remove(shopId: number, id: number) {
    await this.getById(shopId, id);
    await prisma.paymentMethod.delete({ where: { id } });
    return { message: 'Payment method deleted' };
  },

  async deposit(shopId: number, id: number, amount: number) {
    const method = await this.getById(shopId, id);
    const newBalance = add(method.balance.toString(), amount);
    return prisma.paymentMethod.update({
      where: { id },
      data: { balance: newBalance.toFixed(2) },
    });
  },
};
