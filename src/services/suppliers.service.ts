import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { add, sub, toDecimal, toMoneyString } from '../utils/money';

export const suppliersService = {
  async list(shopId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.supplier.findMany({
        where: { shopId },
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
      prisma.supplier.count({ where: { shopId } }),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(shopId: number, id: number) {
    const supplier = await prisma.supplier.findFirst({ where: { id, shopId } });
    if (!supplier) {
      throw new AppError(404, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
    }
    return supplier;
  },

  async create(
    shopId: number,
    data: { name: string; phone: string; address?: string | null },
  ) {
    const clash = await prisma.supplier.findFirst({ where: { shopId, phone: data.phone } });
    if (clash) {
      throw new AppError(409, 'SUPPLIER_PHONE_EXISTS', 'Phone already in use for this shop');
    }
    return prisma.supplier.create({
      data: {
        shopId,
        name: data.name,
        phone: data.phone,
        address: data.address ?? null,
        due: 0,
      },
    });
  },

  async update(
    shopId: number,
    id: number,
    data: { name?: string; phone?: string; address?: string | null },
  ) {
    const supplier = await this.getById(shopId, id);
    if (data.phone && data.phone !== supplier.phone) {
      const clash = await prisma.supplier.findFirst({
        where: { shopId, phone: data.phone, id: { not: id } },
      });
      if (clash) {
        throw new AppError(409, 'SUPPLIER_PHONE_EXISTS', 'Phone already in use for this shop');
      }
    }
    return prisma.supplier.update({
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
    await prisma.supplier.delete({ where: { id } });
    return { message: 'Supplier deleted' };
  },

  async payDue(
    shopId: number,
    id: number,
    data: { amount: number; paymentMethodId: number; purchaseId?: number },
  ) {
    const supplier = await this.getById(shopId, id);
    const due = supplier.due.toString();
    if (toDecimal(data.amount).greaterThan(toDecimal(due))) {
      throw new AppError(400, 'AMOUNT_EXCEEDS_DUE', 'Payment amount exceeds outstanding due');
    }

    const method = await prisma.paymentMethod.findFirst({
      where: { id: data.paymentMethodId, shopId },
    });
    if (!method) {
      throw new AppError(400, 'INVALID_PAYMENT_METHOD', 'Payment method not found');
    }
    if (toDecimal(data.amount).greaterThan(toDecimal(method.balance.toString()))) {
      throw new AppError(
        400,
        'INSUFFICIENT_BALANCE',
        'Payment method balance is insufficient for this payment',
      );
    }

    let purchase = null;
    if (data.purchaseId !== undefined) {
      purchase = await prisma.purchase.findFirst({
        where: { id: data.purchaseId, shopId, supplierId: id },
      });
      if (!purchase) {
        throw new AppError(400, 'INVALID_PURCHASE', 'Purchase not found for this supplier');
      }
    }

    const newDue = sub(due, data.amount);
    const newBalance = sub(method.balance.toString(), data.amount);

    const updatedSupplier = await prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: { due: newDue.toFixed(2) },
      });
      await tx.paymentMethod.update({
        where: { id: method.id },
        data: { balance: newBalance.toFixed(2) },
      });

      if (purchase) {
        const purchasePaid = add(purchase.paidAmount.toString(), data.amount);
        const purchaseDueRaw = sub(purchase.duePrice.toString(), data.amount);
        const purchaseDue = purchaseDueRaw.isNegative() ? toDecimal(0) : purchaseDueRaw;
        await tx.purchase.update({
          where: { id: purchase.id },
          data: {
            paidAmount: purchasePaid.toFixed(2),
            duePrice: purchaseDue.toFixed(2),
          },
        });
        await tx.purchasePay.create({
          data: {
            shopId,
            purchaseId: purchase.id,
            supplierId: id,
            methodId: method.id,
            amount: toMoneyString(data.amount),
            date: new Date(),
          },
        });
      }

      return updated;
    });

    return updatedSupplier;
  },
};
