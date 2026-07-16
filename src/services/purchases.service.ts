import { randomUUID } from 'crypto';
import { DiscountType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import {
  add,
  calculateDiscountedPrice,
  deriveDueChange,
  mul,
  sub,
  toDecimal,
  toMoneyString,
} from '../utils/money';
import { ledgerService } from './ledger.service';

type TxClient = Prisma.TransactionClient;

type DraftLineRecord = {
  id: string;
  medicineId: number;
  quantity: number;
  buyPrice: number;
  price: number;
  batchName: string | null;
  expireDate: string | null;
  discount: number;
  discountType: DiscountType;
};

type DraftLineInput = {
  medicineId: number;
  quantity: number;
  buyPrice: number;
  price?: number;
  batchName?: string | null;
  expireDate?: Date | null;
  discount?: number;
  discountType?: DiscountType;
};

type UpdateDraftInput = {
  supplierId?: number | null;
  paymentMethodId?: number | null;
  paidAmount?: number;
  invoiceDiscount?: { value: number; type: DiscountType };
};

type DraftMeta = {
  invoiceDiscountValue: Prisma.Decimal | string;
  invoiceDiscountType: DiscountType;
  paidAmount: Prisma.Decimal | string;
};

function toLineRecords(json: unknown): DraftLineRecord[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json.map((raw) => {
    const l = raw as Record<string, unknown>;
    return {
      id: String(l.id),
      medicineId: Number(l.medicineId),
      quantity: Number(l.quantity),
      buyPrice: Number(l.buyPrice),
      price: Number(l.price ?? 0),
      batchName: (l.batchName as string | null | undefined) ?? null,
      expireDate: (l.expireDate as string | null | undefined) ?? null,
      discount: Number(l.discount ?? 0),
      discountType: ((l.discountType as DiscountType) ?? 'fixed') as DiscountType,
    };
  });
}

function computeDraftTotals(draft: DraftMeta, lines: DraftLineRecord[]) {
  const computedLines = lines.map((line) => {
    const productPrice = mul(line.buyPrice, line.quantity);
    const productDiscountAmount = calculateDiscountedPrice(
      productPrice,
      line.discount,
      line.discountType,
    );
    const productTotalPrice = sub(productPrice, productDiscountAmount);
    return { ...line, productPrice, productDiscountAmount, productTotalPrice };
  });

  const subtotal = computedLines.reduce(
    (acc, l) => add(acc, l.productTotalPrice),
    toDecimal(0),
  );
  const invoiceDiscountAmount = calculateDiscountedPrice(
    subtotal,
    draft.invoiceDiscountValue.toString(),
    draft.invoiceDiscountType,
  );
  const grandTotal = sub(subtotal, invoiceDiscountAmount);
  const lineDiscountSum = computedLines.reduce(
    (acc, l) => add(acc, l.productDiscountAmount),
    toDecimal(0),
  );
  const totalDiscount = add(lineDiscountSum, invoiceDiscountAmount);
  const qty = lines.reduce((acc, l) => acc + l.quantity, 0);
  const paid = toDecimal(draft.paidAmount.toString());
  const { due, change } = deriveDueChange(grandTotal, paid);

  return {
    lines: computedLines,
    subtotal,
    invoiceDiscountAmount,
    grandTotal,
    totalDiscount,
    qty,
    paid,
    due,
    change,
  };
}

async function generateUniqueInvId(tx: TxClient, shopId: number): Promise<string> {
  const prefix = 'PUR';
  const numberLen = 10 - prefix.length;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const randomDigits = Array.from({ length: numberLen }, () =>
      Math.floor(Math.random() * 10),
    ).join('');
    const candidate = `${prefix}${randomDigits}`;
    const clash = await tx.purchase.findFirst({ where: { shopId, invId: candidate } });
    if (!clash) {
      return candidate;
    }
  }
  throw new AppError(500, 'INV_ID_GENERATION_FAILED', 'Failed to generate a unique purchase invoice id');
}

export const purchasesService = {
  async createDraft(shopId: number, userId: number) {
    return prisma.purchaseDraft.create({ data: { shopId, userId, lines: [] } });
  },

  async getOpenDraft(shopId: number, draftId: number) {
    const draft = await prisma.purchaseDraft.findFirst({
      where: { id: draftId, shopId, status: 'open' },
    });
    if (!draft) {
      throw new AppError(404, 'DRAFT_NOT_FOUND', 'Purchase draft not found');
    }
    return draft;
  },

  async addLine(shopId: number, draftId: number, input: DraftLineInput) {
    const draft = await this.getOpenDraft(shopId, draftId);
    const medicine = await prisma.medicine.findFirst({
      where: { id: input.medicineId, shopId },
    });
    if (!medicine) {
      throw new AppError(400, 'INVALID_MEDICINE', 'Medicine not found for this shop');
    }

    const lines = toLineRecords(draft.lines);
    const existingIdx = lines.findIndex((l) => l.medicineId === input.medicineId);
    const record: DraftLineRecord = {
      id: existingIdx >= 0 ? lines[existingIdx].id : randomUUID(),
      medicineId: input.medicineId,
      quantity: input.quantity,
      buyPrice: input.buyPrice,
      price: input.price ?? 0,
      batchName: input.batchName ?? null,
      expireDate: input.expireDate ? input.expireDate.toISOString().slice(0, 10) : null,
      discount: input.discount ?? 0,
      discountType: input.discountType ?? 'fixed',
    };
    if (existingIdx >= 0) {
      lines[existingIdx] = record;
    } else {
      lines.push(record);
    }

    return prisma.purchaseDraft.update({
      where: { id: draft.id },
      data: { lines: lines as unknown as Prisma.InputJsonValue },
    });
  },

  async removeLine(shopId: number, draftId: number, lineId: string) {
    const draft = await this.getOpenDraft(shopId, draftId);
    const lines = toLineRecords(draft.lines);
    const filtered = lines.filter((l) => l.id !== lineId);
    if (filtered.length === lines.length) {
      throw new AppError(404, 'LINE_NOT_FOUND', 'Purchase draft line not found');
    }
    return prisma.purchaseDraft.update({
      where: { id: draft.id },
      data: { lines: filtered as unknown as Prisma.InputJsonValue },
    });
  },

  async updateDraftMeta(shopId: number, draftId: number, data: UpdateDraftInput) {
    const draft = await this.getOpenDraft(shopId, draftId);

    if (data.supplierId !== undefined && data.supplierId !== null) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: data.supplierId, shopId },
      });
      if (!supplier) {
        throw new AppError(400, 'INVALID_SUPPLIER', 'Supplier not found for this shop');
      }
    }
    if (data.paymentMethodId !== undefined && data.paymentMethodId !== null) {
      const method = await prisma.paymentMethod.findFirst({
        where: { id: data.paymentMethodId, shopId },
      });
      if (!method) {
        throw new AppError(400, 'INVALID_PAYMENT_METHOD', 'Payment method not found for this shop');
      }
    }

    return prisma.purchaseDraft.update({
      where: { id: draft.id },
      data: {
        supplierId: data.supplierId,
        methodId: data.paymentMethodId,
        paidAmount: data.paidAmount !== undefined ? toMoneyString(data.paidAmount) : undefined,
        invoiceDiscountValue: data.invoiceDiscount
          ? toMoneyString(data.invoiceDiscount.value)
          : undefined,
        invoiceDiscountType: data.invoiceDiscount ? data.invoiceDiscount.type : undefined,
      },
    });
  },

  buildDraftView(draft: {
    id: number;
    supplierId: number | null;
    methodId: number | null;
    paidAmount: Prisma.Decimal;
    invoiceDiscountValue: Prisma.Decimal;
    invoiceDiscountType: DiscountType;
    lines: Prisma.JsonValue;
    status: string;
  }) {
    const lines = toLineRecords(draft.lines);
    const totals = computeDraftTotals(draft, lines);
    return {
      id: draft.id,
      supplierId: draft.supplierId,
      paymentMethodId: draft.methodId,
      paidAmount: totals.paid.toFixed(2),
      invoiceDiscount: {
        value: toDecimal(draft.invoiceDiscountValue.toString()).toFixed(2),
        type: draft.invoiceDiscountType,
      },
      lines: totals.lines.map((l) => ({
        id: l.id,
        medicineId: l.medicineId,
        quantity: l.quantity,
        buyPrice: l.buyPrice,
        price: l.price,
        batchName: l.batchName,
        expireDate: l.expireDate,
        discount: l.discount,
        discountType: l.discountType,
        productPrice: l.productPrice.toFixed(2),
        productDiscountAmount: l.productDiscountAmount.toFixed(2),
        productTotalPrice: l.productTotalPrice.toFixed(2),
      })),
      subtotal: totals.subtotal.toFixed(2),
      invoiceDiscountAmount: totals.invoiceDiscountAmount.toFixed(2),
      totalDiscount: totals.totalDiscount.toFixed(2),
      grandTotal: totals.grandTotal.toFixed(2),
      qty: totals.qty,
      due: totals.due.toFixed(2),
      change: totals.change.toFixed(2),
      status: draft.status,
    };
  },

  async getDraftView(shopId: number, draftId: number) {
    const draft = await this.getOpenDraft(shopId, draftId);
    return this.buildDraftView(draft);
  },

  async commit(shopId: number, draftId: number) {
    const draft = await this.getOpenDraft(shopId, draftId);
    const lines = toLineRecords(draft.lines);
    if (lines.length === 0) {
      throw new AppError(422, 'EMPTY_PURCHASE', 'Cannot commit a purchase with no line items');
    }
    if (!draft.supplierId) {
      throw new AppError(422, 'SUPPLIER_REQUIRED', 'A supplier must be selected before committing');
    }

    const supplier = await prisma.supplier.findFirst({ where: { id: draft.supplierId, shopId } });
    if (!supplier) {
      throw new AppError(400, 'INVALID_SUPPLIER', 'Supplier not found for this shop');
    }

    const totals = computeDraftTotals(draft, lines);

    let method = null;
    if (totals.paid.greaterThan(0)) {
      if (!draft.methodId) {
        throw new AppError(
          422,
          'PAYMENT_METHOD_REQUIRED',
          'A payment method is required when paidAmount > 0',
        );
      }
      method = await prisma.paymentMethod.findFirst({ where: { id: draft.methodId, shopId } });
      if (!method) {
        throw new AppError(400, 'INVALID_PAYMENT_METHOD', 'Payment method not found for this shop');
      }
      if (toDecimal(method.balance.toString()).lessThan(totals.paid)) {
        throw new AppError(
          422,
          'INSUFFICIENT_BALANCE',
          'Payment method balance is insufficient for this purchase',
        );
      }
    } else if (draft.methodId) {
      method = await prisma.paymentMethod.findFirst({ where: { id: draft.methodId, shopId } });
      if (!method) {
        throw new AppError(400, 'INVALID_PAYMENT_METHOD', 'Payment method not found for this shop');
      }
    }

    const purchaseId = await prisma.$transaction(async (tx) => {
      const invId = await generateUniqueInvId(tx, shopId);
      const date = new Date();

      const created = await tx.purchase.create({
        data: {
          shopId,
          supplierId: supplier.id,
          methodId: method?.id ?? null,
          invId,
          date,
          subtotal: toMoneyString(totals.subtotal),
          discount: toMoneyString(totals.totalDiscount),
          totalPrice: toMoneyString(totals.grandTotal),
          paidAmount: toMoneyString(totals.paid),
          duePrice: toMoneyString(totals.due),
          changeAmount: toMoneyString(totals.change),
          qty: totals.qty,
          medicines: lines as unknown as Prisma.InputJsonValue,
        },
      });

      if (totals.due.greaterThan(0)) {
        await tx.supplier.update({
          where: { id: supplier.id },
          data: { due: add(supplier.due.toString(), totals.due).toFixed(2) },
        });
      }

      await tx.purchasePay.create({
        data: {
          shopId,
          purchaseId: created.id,
          supplierId: supplier.id,
          methodId: method?.id ?? null,
          amount: toMoneyString(totals.paid),
          date,
        },
      });

      if (totals.paid.greaterThan(0) && method) {
        await tx.paymentMethod.update({
          where: { id: method.id },
          data: { balance: sub(method.balance.toString(), totals.paid).toFixed(2) },
        });
      }

      for (const line of totals.lines) {
        const medicine = await tx.medicine.findFirst({ where: { id: line.medicineId, shopId } });
        if (!medicine) {
          throw new AppError(400, 'INVALID_MEDICINE', `Medicine ${line.medicineId} not found for this shop`);
        }
        await tx.batch.create({
          data: {
            shopId,
            medicineId: line.medicineId,
            name: line.batchName,
            qty: line.quantity,
            purchaseQty: line.quantity,
            expire: line.expireDate ? new Date(line.expireDate) : null,
            price: toMoneyString(line.price),
            buyPrice: toMoneyString(line.buyPrice),
            discount: toMoneyString(line.productDiscountAmount),
            discountValueType: line.discountType,
            subTotal: toMoneyString(line.productPrice),
            total: toMoneyString(line.productTotalPrice),
            purchaseId: created.id,
            invId,
          },
        });
      }

      await ledgerService.purchaseTransaction(tx, {
        amount: totals.grandTotal,
        invoiceId: invId,
        date,
      });

      await tx.purchaseDraft.delete({ where: { id: draft.id } });

      return created.id;
    });

    return this.getById(shopId, purchaseId);
  },

  async list(shopId: number, params: { page: number; limit: number; supplierId?: number }) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.PurchaseWhereInput = {
      shopId,
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: params.limit,
      }),
      prisma.purchase.count({ where }),
    ]);
    return { items, meta: { page: params.page, limit: params.limit, total } };
  },

  async getById(shopId: number, id: number) {
    const purchase = await prisma.purchase.findFirst({
      where: { id, shopId },
      include: { batches: true, pays: true, returns: true, supplier: true, method: true },
    });
    if (!purchase) {
      throw new AppError(404, 'PURCHASE_NOT_FOUND', 'Purchase not found');
    }
    return purchase;
  },
};
