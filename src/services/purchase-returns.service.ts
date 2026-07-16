import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { mul, sub, toDecimal, toMoneyString } from '../utils/money';
import { ledgerService } from './ledger.service';

export const purchaseReturnsService = {
  async createReturn(
    shopId: number,
    purchaseId: number,
    input: { medicineId: number; quantity: number; batchId?: number },
  ) {
    const purchase = await prisma.purchase.findFirst({ where: { id: purchaseId, shopId } });
    if (!purchase) {
      throw new AppError(404, 'PURCHASE_NOT_FOUND', 'Purchase not found');
    }

    let batch;
    if (input.batchId !== undefined) {
      batch = await prisma.batch.findFirst({
        where: { id: input.batchId, purchaseId, medicineId: input.medicineId, shopId },
      });
      if (!batch) {
        throw new AppError(
          400,
          'INVALID_BATCH',
          'Batch not found for this purchase and medicine',
        );
      }
    } else {
      batch = await prisma.batch.findFirst({
        where: { purchaseId, medicineId: input.medicineId, shopId },
        orderBy: { id: 'asc' },
      });
      if (!batch) {
        throw new AppError(
          400,
          'INVALID_BATCH',
          'No batch found for this purchase and medicine',
        );
      }
    }

    if (input.quantity > batch.qty) {
      throw new AppError(
        422,
        'RETURN_QTY_EXCEEDS_BATCH',
        `Return quantity exceeds batch quantity (${batch.qty})`,
      );
    }

    const returnAmount = mul(batch.buyPrice.toString(), input.quantity);
    const supplier = await prisma.supplier.findFirst({ where: { id: purchase.supplierId, shopId } });
    if (!supplier) {
      throw new AppError(400, 'INVALID_SUPPLIER', 'Supplier not found for this purchase');
    }
    const dueReduced = toDecimal(supplier.due.toString()).greaterThanOrEqualTo(returnAmount);

    const result = await prisma.$transaction(async (tx) => {
      const updatedBatch = await tx.batch.update({
        where: { id: batch.id },
        data: { qty: batch.qty - input.quantity },
      });

      if (dueReduced) {
        await tx.supplier.update({
          where: { id: supplier.id },
          data: { due: sub(supplier.due.toString(), returnAmount).toFixed(2) },
        });
      }

      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          shopId,
          purchaseId: purchase.id,
          batchId: batch.id,
          amount: toMoneyString(returnAmount),
          quantity: input.quantity,
          date: new Date(),
        },
      });

      const updatedPurchase = await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          qty: purchase.qty - input.quantity,
          totalPrice: sub(purchase.totalPrice.toString(), returnAmount).toFixed(2),
          subtotal: sub(purchase.subtotal.toString(), returnAmount).toFixed(2),
        },
      });

      await ledgerService.reversePurchaseTransaction(tx, {
        amount: returnAmount,
        invoiceId: purchase.invId,
        date: new Date(),
      });

      return { purchaseReturn, updatedBatch, updatedPurchase };
    });

    return {
      ...result.purchaseReturn,
      batchQtyAfter: result.updatedBatch.qty,
      purchaseQtyAfter: result.updatedPurchase.qty,
      purchaseTotalPriceAfter: result.updatedPurchase.totalPrice,
      purchaseSubtotalAfter: result.updatedPurchase.subtotal,
      supplierDueReduced: dueReduced,
    };
  },

  async list(
    shopId: number,
    params: { page: number; limit: number; purchaseId?: number; supplierId?: number },
  ) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.PurchaseReturnWhereInput = {
      shopId,
      ...(params.purchaseId ? { purchaseId: params.purchaseId } : {}),
      ...(params.supplierId ? { purchase: { supplierId: params.supplierId } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.purchaseReturn.findMany({
        where,
        include: { purchase: true, batch: true },
        orderBy: { id: 'desc' },
        skip,
        take: params.limit,
      }),
      prisma.purchaseReturn.count({ where }),
    ]);
    return { items, meta: { page: params.page, limit: params.limit, total } };
  },
};
