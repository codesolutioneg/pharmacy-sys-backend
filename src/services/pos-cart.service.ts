import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { DiscountType, Prisma, Shop, TaxMode } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import {
  add,
  calculateDiscountedPrice,
  deriveDueChange,
  mul,
  round2,
  sub,
  toDecimal,
  toMoneyString,
} from '../utils/money';
import { ledgerService } from './ledger.service';
import { invoicesService } from './invoices.service';

type TxClient = Prisma.TransactionClient;

export type CartItemRecord = {
  id: string;
  medicineId: number;
  batchId: number | null;
  qty: number;
  unitPrice: number;
  lineDiscount: number;
  expire: string | null;
  name: string | null;
};

type UpdateCartItemInput = {
  qty?: number;
  batchId?: number;
  lineDiscount?: number;
};

type UpdateCartMetaInput = {
  customerId?: number | null;
  paymentMethodId?: number | null;
  paidAmount?: number;
  taxRate?: number | null;
  taxAmount?: number | null;
  invoiceDiscount?: { value: number; type: DiscountType };
};

type CartMeta = {
  invoiceDiscountValue: Prisma.Decimal | string;
  invoiceDiscountType: DiscountType;
  paidAmount: Prisma.Decimal | string;
  taxRateOverride: Prisma.Decimal | string | null;
  taxAmountOverride: Prisma.Decimal | string | null;
};

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toItemRecords(json: unknown): CartItemRecord[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json.map((raw) => {
    const i = raw as Record<string, unknown>;
    return {
      id: String(i.id),
      medicineId: Number(i.medicineId),
      batchId: i.batchId === null || i.batchId === undefined ? null : Number(i.batchId),
      qty: Number(i.qty ?? 0),
      unitPrice: Number(i.unitPrice ?? 0),
      lineDiscount: Number(i.lineDiscount ?? 0),
      expire: (i.expire as string | null | undefined) ?? null,
      name: (i.name as string | null | undefined) ?? null,
    };
  });
}

function isBatchSellable(batch: { qty: number; expire: Date | null }, today: Date): boolean {
  if (batch.qty <= 0) {
    return false;
  }
  if (batch.expire && batch.expire <= today) {
    return false;
  }
  return true;
}

async function findFefoBatch(shopId: number, medicineId: number) {
  const today = startOfToday();
  const candidates = await prisma.batch.findMany({
    where: { shopId, medicineId, qty: { gt: 0 } },
    orderBy: [{ expire: 'asc' }, { id: 'asc' }],
  });
  return candidates.find((b) => isBatchSellable(b, today)) ?? null;
}

function computeTax(
  taxMode: TaxMode,
  taxable: Decimal,
  rate: Prisma.Decimal.Value,
  amountOverride: Prisma.Decimal.Value | null,
): Decimal {
  if (amountOverride !== null) {
    return round2(amountOverride);
  }
  if (taxMode === 'exclusive') {
    return round2(taxable.times(toDecimal(rate)).dividedBy(100));
  }
  if (taxMode === 'inclusive') {
    const rateDec = toDecimal(rate);
    const divisor = toDecimal(1).plus(rateDec.dividedBy(100));
    const beforeTax = round2(taxable.dividedBy(divisor));
    return sub(taxable, beforeTax);
  }
  return toDecimal(0);
}

function computeCartTotals(shop: Shop, cart: CartMeta, items: CartItemRecord[]) {
  const computedLines = items.map((item) => {
    const lineGross = mul(item.unitPrice, item.qty);
    const lineDiscountCapped = round2(Decimal.min(toDecimal(item.lineDiscount), lineGross));
    const lineNet = sub(lineGross, lineDiscountCapped);
    return { ...item, lineGross, lineDiscountCapped, lineNet };
  });

  const subtotal = computedLines.reduce((acc, l) => add(acc, l.lineNet), toDecimal(0));
  const invoiceDiscountAmount = calculateDiscountedPrice(
    subtotal,
    cart.invoiceDiscountValue.toString(),
    cart.invoiceDiscountType,
  );
  const taxable = sub(subtotal, invoiceDiscountAmount);

  const rate = cart.taxRateOverride !== null ? cart.taxRateOverride.toString() : shop.taxRatePercent.toString();
  const amountOverride = cart.taxAmountOverride !== null ? cart.taxAmountOverride.toString() : null;
  const taxAmount = computeTax(shop.taxMode, taxable, rate, amountOverride);

  const grandTotal = shop.taxMode === 'exclusive' ? add(taxable, taxAmount) : taxable;
  const qty = items.reduce((acc, i) => acc + i.qty, 0);
  const paid = toDecimal(cart.paidAmount.toString());
  const { due, change } = deriveDueChange(grandTotal, paid);

  return {
    lines: computedLines,
    subtotal,
    invoiceDiscountAmount,
    taxable,
    taxAmount,
    grandTotal,
    qty,
    paid,
    due,
    change,
  };
}

async function generateUniqueInvId(
  tx: TxClient,
  shopId: number,
  prefix: string | null,
): Promise<string> {
  const base = (prefix && prefix.trim()) || 'INV';
  const numberLen = Math.max(10 - base.length, 4);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const randomDigits = Array.from({ length: numberLen }, () =>
      Math.floor(Math.random() * 10),
    ).join('');
    const candidate = `${base}${randomDigits}`;
    const clash = await tx.invoice.findFirst({ where: { shopId, invId: candidate } });
    if (!clash) {
      return candidate;
    }
  }
  throw new AppError(500, 'INV_ID_GENERATION_FAILED', 'Failed to generate a unique invoice id');
}

async function getShopOrThrow(shopId: number): Promise<Shop> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    throw new AppError(404, 'SHOP_NOT_FOUND', 'Shop not found');
  }
  return shop;
}

export const posCartService = {
  async createCart(shopId: number, userId: number) {
    return prisma.posCart.create({ data: { shopId, userId, items: [] } });
  },

  async getOpenCart(shopId: number, cartId: number) {
    const cart = await prisma.posCart.findFirst({ where: { id: cartId, shopId } });
    if (!cart) {
      throw new AppError(404, 'CART_NOT_FOUND', 'POS cart not found');
    }
    return cart;
  },

  async addItem(shopId: number, cartId: number, medicineId: number) {
    const cart = await this.getOpenCart(shopId, cartId);
    const medicine = await prisma.medicine.findFirst({ where: { id: medicineId, shopId } });
    if (!medicine) {
      throw new AppError(400, 'INVALID_MEDICINE', 'Medicine not found for this shop');
    }

    const items = toItemRecords(cart.items);
    const existingIdx = items.findIndex((i) => i.medicineId === medicineId);

    if (existingIdx >= 0) {
      items[existingIdx] = { ...items[existingIdx], qty: items[existingIdx].qty + 1 };
    } else {
      const batch = await findFefoBatch(shopId, medicineId);
      if (!batch) {
        throw new AppError(
          422,
          'no_batch',
          'No sellable batch (qty > 0, not expired) is available for this medicine',
        );
      }
      items.push({
        id: randomUUID(),
        medicineId,
        batchId: batch.id,
        qty: 1,
        unitPrice: Number(batch.price),
        lineDiscount: 0,
        expire: batch.expire ? batch.expire.toISOString().slice(0, 10) : null,
        name: medicine.name,
      });
    }

    return prisma.posCart.update({
      where: { id: cart.id },
      data: { items: items as unknown as Prisma.InputJsonValue },
    });
  },

  async updateItem(
    shopId: number,
    cartId: number,
    itemId: string,
    input: UpdateCartItemInput,
  ) {
    const cart = await this.getOpenCart(shopId, cartId);
    const items = toItemRecords(cart.items);
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx < 0) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Cart item not found');
    }
    let item = items[idx];

    if (input.batchId !== undefined) {
      const batch = await prisma.batch.findFirst({
        where: { id: input.batchId, medicineId: item.medicineId, shopId },
      });
      if (!batch) {
        throw new AppError(400, 'INVALID_BATCH', 'Batch not found for this medicine');
      }
      const today = startOfToday();
      if (batch.expire && batch.expire <= today) {
        throw new AppError(422, 'BATCH_EXPIRED', 'Selected batch has expired');
      }
      if (batch.qty < 1) {
        throw new AppError(422, 'BATCH_EMPTY', 'Selected batch has no remaining quantity');
      }
      item = {
        ...item,
        batchId: batch.id,
        unitPrice: Number(batch.price),
        expire: batch.expire ? batch.expire.toISOString().slice(0, 10) : null,
      };
    }

    if (input.qty !== undefined) {
      const batchId = input.batchId ?? item.batchId;
      if (!batchId) {
        throw new AppError(422, 'BATCH_REQUIRED', 'Select a batch before changing quantity');
      }
      const batch = await prisma.batch.findFirst({ where: { id: batchId, shopId } });
      if (!batch) {
        throw new AppError(400, 'INVALID_BATCH', 'Batch not found');
      }
      if (batch.qty < input.qty) {
        throw new AppError(
          422,
          'INSUFFICIENT_STOCK',
          `Only ${batch.qty} unit(s) available in this batch`,
        );
      }
      item = { ...item, qty: input.qty };
    }

    if (input.lineDiscount !== undefined) {
      item = { ...item, lineDiscount: input.lineDiscount };
    }

    items[idx] = item;
    return prisma.posCart.update({
      where: { id: cart.id },
      data: { items: items as unknown as Prisma.InputJsonValue },
    });
  },

  async removeItem(shopId: number, cartId: number, itemId: string) {
    const cart = await this.getOpenCart(shopId, cartId);
    const items = toItemRecords(cart.items);
    const filtered = items.filter((i) => i.id !== itemId);
    if (filtered.length === items.length) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Cart item not found');
    }
    return prisma.posCart.update({
      where: { id: cart.id },
      data: { items: filtered as unknown as Prisma.InputJsonValue },
    });
  },

  async updateCartMeta(shopId: number, cartId: number, data: UpdateCartMetaInput) {
    const cart = await this.getOpenCart(shopId, cartId);

    if (data.customerId !== undefined && data.customerId !== null) {
      const customer = await prisma.customer.findFirst({ where: { id: data.customerId, shopId } });
      if (!customer) {
        throw new AppError(400, 'INVALID_CUSTOMER', 'Customer not found for this shop');
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
    if (data.taxRate !== undefined && data.taxAmount !== undefined) {
      throw new AppError(
        400,
        'TAX_OVERRIDE_CONFLICT',
        'Provide either taxRate or taxAmount, not both',
      );
    }

    return prisma.posCart.update({
      where: { id: cart.id },
      data: {
        customerId: data.customerId,
        methodId: data.paymentMethodId,
        paidAmount: data.paidAmount !== undefined ? toMoneyString(data.paidAmount) : undefined,
        taxRateOverride:
          data.taxRate !== undefined ? (data.taxRate === null ? null : toMoneyString(data.taxRate)) : undefined,
        taxAmountOverride:
          data.taxAmount !== undefined
            ? data.taxAmount === null
              ? null
              : toMoneyString(data.taxAmount)
            : undefined,
        invoiceDiscountValue: data.invoiceDiscount
          ? toMoneyString(data.invoiceDiscount.value)
          : undefined,
        invoiceDiscountType: data.invoiceDiscount ? data.invoiceDiscount.type : undefined,
      },
    });
  },

  async buildCartView(shopId: number, cart: {
    id: number;
    customerId: number | null;
    methodId: number | null;
    paidAmount: Prisma.Decimal;
    taxRateOverride: Prisma.Decimal | null;
    taxAmountOverride: Prisma.Decimal | null;
    invoiceDiscountValue: Prisma.Decimal;
    invoiceDiscountType: DiscountType;
    items: Prisma.JsonValue;
  }) {
    const shop = await getShopOrThrow(shopId);
    const items = toItemRecords(cart.items);
    const totals = computeCartTotals(shop, cart, items);
    return {
      id: cart.id,
      customerId: cart.customerId,
      paymentMethodId: cart.methodId,
      paidAmount: totals.paid.toFixed(2),
      taxRate: cart.taxRateOverride !== null ? cart.taxRateOverride.toFixed(2) : null,
      taxAmount: cart.taxAmountOverride !== null ? cart.taxAmountOverride.toFixed(2) : null,
      invoiceDiscount: {
        value: toDecimal(cart.invoiceDiscountValue.toString()).toFixed(2),
        type: cart.invoiceDiscountType,
      },
      items: totals.lines.map((l) => ({
        id: l.id,
        medicineId: l.medicineId,
        batchId: l.batchId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineDiscount: l.lineDiscountCapped.toFixed(2),
        expire: l.expire,
        name: l.name,
        lineGross: l.lineGross.toFixed(2),
        lineNet: l.lineNet.toFixed(2),
      })),
      subtotal: totals.subtotal.toFixed(2),
      invoiceDiscountAmount: totals.invoiceDiscountAmount.toFixed(2),
      taxableAmount: totals.taxable.toFixed(2),
      taxAmountComputed: totals.taxAmount.toFixed(2),
      grandTotal: totals.grandTotal.toFixed(2),
      qty: totals.qty,
      due: totals.due.toFixed(2),
      change: totals.change.toFixed(2),
    };
  },

  async getCartView(shopId: number, cartId: number) {
    const cart = await this.getOpenCart(shopId, cartId);
    return this.buildCartView(shopId, cart);
  },

  async checkout(shopId: number, cartId: number) {
    const cart = await this.getOpenCart(shopId, cartId);
    const shop = await getShopOrThrow(shopId);
    const items = toItemRecords(cart.items);

    if (items.length === 0) {
      throw new AppError(422, 'EMPTY_CART', 'Cannot checkout an empty cart');
    }
    for (const item of items) {
      if (!item.batchId) {
        throw new AppError(
          422,
          'BATCH_REQUIRED',
          `A batch must be selected for every cart line before checkout (item ${item.id})`,
        );
      }
    }

    const totals = computeCartTotals(shop, cart, items);

    if (totals.due.greaterThan(0) && !cart.customerId) {
      throw new AppError(422, 'CUSTOMER_REQUIRED', 'A customer is required when dueAmount > 0');
    }
    if (!cart.methodId) {
      throw new AppError(422, 'PAYMENT_METHOD_REQUIRED', 'A payment method is required to checkout');
    }

    const method = await prisma.paymentMethod.findFirst({ where: { id: cart.methodId, shopId } });
    if (!method) {
      throw new AppError(400, 'INVALID_PAYMENT_METHOD', 'Payment method not found for this shop');
    }

    let customer = null;
    if (cart.customerId) {
      customer = await prisma.customer.findFirst({ where: { id: cart.customerId, shopId } });
      if (!customer) {
        throw new AppError(400, 'INVALID_CUSTOMER', 'Customer not found for this shop');
      }
    }

    const invoiceId = await prisma.$transaction(async (tx) => {
      const invId = await generateUniqueInvId(tx, shopId, shop.prefix);
      const date = new Date();

      const snapshot = [];
      for (const line of totals.lines) {
        // Row lock prevents concurrent oversell under READ COMMITTED.
        const locked = await tx.$queryRaw<Array<{ id: number; qty: number }>>`
          SELECT id, qty FROM batches
          WHERE id = ${line.batchId as number} AND shop_id = ${shopId}
          FOR UPDATE
        `;
        if (!locked[0] || locked[0].qty < line.qty) {
          throw new AppError(
            409,
            'INSUFFICIENT_STOCK',
            `Insufficient stock for batch ${line.batchId} (requested ${line.qty})`,
          );
        }
        const updated = await tx.batch.updateMany({
          where: { id: line.batchId as number, shopId, qty: { gte: line.qty } },
          data: { qty: { decrement: line.qty } },
        });
        if (updated.count === 0) {
          throw new AppError(
            409,
            'INSUFFICIENT_STOCK',
            `Insufficient stock for batch ${line.batchId} (requested ${line.qty})`,
          );
        }
        snapshot.push({
          medicineId: line.medicineId,
          batchId: line.batchId,
          name: line.name,
          origQty: line.qty,
          unitPrice: Number(line.unitPrice),
          lineDiscount: Number(line.lineDiscountCapped),
          origLineTotal: Number(line.lineNet),
          remainingQty: line.qty,
        });
      }

      const invoice = await tx.invoice.create({
        data: {
          shopId,
          customerId: customer?.id ?? null,
          methodId: method.id,
          invId,
          name: customer?.name ?? '',
          phone: customer?.phone ?? null,
          date,
          subtotal: toMoneyString(totals.subtotal),
          discount: toMoneyString(totals.invoiceDiscountAmount),
          tax: toMoneyString(totals.taxAmount),
          totalPrice: toMoneyString(totals.grandTotal),
          paidAmount: toMoneyString(totals.paid),
          duePrice: toMoneyString(totals.due),
          returnedAmount: toMoneyString(totals.change),
          qty: totals.qty,
          type: 'pos',
          medicines: snapshot as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.invoicePay.create({
        data: {
          shopId,
          invoiceId: invoice.id,
          customerId: customer?.id ?? null,
          methodId: method.id,
          amount: toMoneyString(totals.paid),
          date,
        },
      });

      if (totals.paid.greaterThan(0)) {
        await tx.paymentMethod.update({
          where: { id: method.id },
          data: { balance: add(method.balance.toString(), totals.paid).toFixed(2) },
        });
      }

      if (totals.due.greaterThan(0) && customer) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { due: add(customer.due.toString(), totals.due).toFixed(2) },
        });
      }

      await ledgerService.saleTransaction(tx, {
        amount: totals.grandTotal,
        invoiceId: invId,
        date,
      });

      await tx.posCart.delete({ where: { id: cart.id } });

      return invoice.id;
    });

    return invoicesService.getById(shopId, invoiceId);
  },
};
