import { DeliveryStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { add, sub, toDecimal, toMoneyString } from '../utils/money';
import { ledgerService } from './ledger.service';
import { posSessionService } from './pos-session.service';

type InvoiceLineSnapshot = {
  medicineId: number;
  batchId: number;
  name: string | null;
  origQty: number;
  unitPrice: number;
  lineDiscount: number;
  origLineTotal: number;
  remainingQty: number;
};

function toLineSnapshots(json: Prisma.JsonValue | null): InvoiceLineSnapshot[] {
  if (!Array.isArray(json)) return [];
  return json.map((raw) => {
    const l = raw as Record<string, unknown>;
    return {
      medicineId: Number(l.medicineId),
      batchId: Number(l.batchId),
      name: (l.name as string | null | undefined) ?? null,
      origQty: Number(l.origQty ?? 0),
      unitPrice: Number(l.unitPrice ?? 0),
      lineDiscount: Number(l.lineDiscount ?? 0),
      origLineTotal: Number(l.origLineTotal ?? 0),
      remainingQty: Number(l.remainingQty ?? 0),
    };
  });
}

const deliveryInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  method: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  assignedCashier: { select: { id: true, name: true } },
  settledBy: { select: { id: true, name: true } },
  session: { select: { id: true, userId: true, status: true } },
} satisfies Prisma.InvoiceInclude;

function parseDayStart(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDayEnd(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setHours(23, 59, 59, 999);
  return d;
}

async function getDeliveryOrThrow(shopId: number, id: number) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, shopId, fulfillmentChannel: 'delivery' },
    include: deliveryInclude,
  });
  if (!invoice) {
    throw new AppError(404, 'DELIVERY_NOT_FOUND', 'Delivery order not found');
  }
  return invoice;
}

export const deliveryService = {
  async list(
    shopId: number,
    userId: number,
    params: {
      page: number;
      limit: number;
      status?: DeliveryStatus;
      assignedCashierId?: number;
      createdById?: number;
      mine?: boolean;
      unsettledOnly?: boolean;
      from?: string;
      to?: string;
      search?: string;
    },
  ) {
    const skip = (params.page - 1) * params.limit;
    const from = parseDayStart(params.from);
    const to = parseDayEnd(params.to);
    const search = params.search?.trim();

    const where: Prisma.InvoiceWhereInput = {
      shopId,
      fulfillmentChannel: 'delivery',
      ...(params.status ? { deliveryStatus: params.status } : {}),
      ...(params.assignedCashierId ? { assignedCashierId: params.assignedCashierId } : {}),
      ...(params.createdById ? { createdById: params.createdById } : {}),
      ...(params.mine
        ? {
            OR: [{ assignedCashierId: userId }, { createdById: userId }],
          }
        : {}),
      ...(params.unsettledOnly
        ? {
            deliveryStatus: { in: ['pending', 'assigned', 'out_for_delivery'] },
            duePrice: { gt: 0 },
          }
        : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { invId: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
              { customer: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total, statusGroups] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: params.limit,
        include: deliveryInclude,
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.groupBy({
        by: ['deliveryStatus'],
        where: { shopId, fulfillmentChannel: 'delivery' },
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {
      pending: 0,
      assigned: 0,
      out_for_delivery: 0,
      settled: 0,
      cancelled: 0,
    };
    for (const row of statusGroups) {
      if (row.deliveryStatus) {
        statusCounts[row.deliveryStatus] = row._count._all;
      }
    }

    return {
      items,
      meta: { page: params.page, limit: params.limit, total },
      statusCounts,
    };
  },

  async getById(shopId: number, id: number) {
    return getDeliveryOrThrow(shopId, id);
  },

  async assign(shopId: number, id: number, cashierId: number) {
    const invoice = await getDeliveryOrThrow(shopId, id);
    if (invoice.deliveryStatus === 'settled') {
      throw new AppError(409, 'DELIVERY_ALREADY_SETTLED', 'Cannot assign a settled delivery order');
    }
    if (invoice.deliveryStatus === 'cancelled') {
      throw new AppError(409, 'DELIVERY_CANCELLED', 'Cannot assign a cancelled delivery order');
    }

    const cashier = await prisma.user.findFirst({ where: { id: cashierId, shopId } });
    if (!cashier) {
      throw new AppError(400, 'INVALID_CASHIER', 'Cashier not found for this shop');
    }

    return prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        assignedCashierId: cashierId,
        deliveryStatus: 'assigned',
      },
      include: deliveryInclude,
    });
  },

  async updateStatus(
    shopId: number,
    id: number,
    status: Extract<DeliveryStatus, 'pending' | 'assigned' | 'out_for_delivery'>,
  ) {
    const invoice = await getDeliveryOrThrow(shopId, id);
    if (invoice.deliveryStatus === 'settled' || invoice.deliveryStatus === 'cancelled') {
      throw new AppError(
        409,
        'DELIVERY_STATUS_LOCKED',
        'Cannot change status of a settled or cancelled delivery order',
      );
    }
    if (status === 'assigned' && !invoice.assignedCashierId) {
      throw new AppError(
        422,
        'CASHIER_REQUIRED',
        'Assign a cashier before marking the order as assigned',
      );
    }
    if (status === 'pending') {
      return prisma.invoice.update({
        where: { id: invoice.id },
        data: { deliveryStatus: 'pending', assignedCashierId: null },
        include: deliveryInclude,
      });
    }
    return prisma.invoice.update({
      where: { id: invoice.id },
      data: { deliveryStatus: status },
      include: deliveryInclude,
    });
  },

  async settle(
    shopId: number,
    id: number,
    actorUserId: number,
    input: { paymentMethodId: number; amount?: number; note?: string },
  ) {
    const invoice = await getDeliveryOrThrow(shopId, id);
    if (invoice.deliveryStatus === 'cancelled') {
      throw new AppError(409, 'DELIVERY_CANCELLED', 'Cannot settle a cancelled delivery order');
    }
    if (invoice.deliveryStatus === 'settled' || toDecimal(invoice.duePrice.toString()).lessThanOrEqualTo(0)) {
      throw new AppError(409, 'DELIVERY_ALREADY_SETTLED', 'Delivery order is already settled');
    }

    if (
      invoice.assignedCashierId != null &&
      invoice.assignedCashierId !== actorUserId
    ) {
      // Managers with assign permission may settle on behalf of the assignee.
      const canOverride = await prisma.rolePermission.findFirst({
        where: {
          permission: { name: 'delivery.assign' },
          role: { users: { some: { id: actorUserId, shopId } } },
        },
      });
      if (!canOverride) {
        throw new AppError(
          403,
          'DELIVERY_NOT_ASSIGNED_TO_YOU',
          'Only the assigned cashier can settle this delivery order',
        );
      }
    }

    const session = await posSessionService.requireOpenSession(shopId, actorUserId);
    const due = toDecimal(invoice.duePrice.toString());
    const amount = input.amount !== undefined ? toDecimal(input.amount) : due;
    if (amount.lessThanOrEqualTo(0)) {
      throw new AppError(422, 'INVALID_AMOUNT', 'Settlement amount must be positive');
    }
    if (amount.greaterThan(due)) {
      throw new AppError(422, 'AMOUNT_EXCEEDS_DUE', 'Settlement amount exceeds outstanding due');
    }

    const method = await prisma.paymentMethod.findFirst({
      where: { id: input.paymentMethodId, shopId },
    });
    if (!method) {
      throw new AppError(400, 'INVALID_PAYMENT_METHOD', 'Payment method not found for this shop');
    }
    if (method.isInsurance) {
      throw new AppError(
        422,
        'INVALID_PAYMENT_METHOD',
        'Insurance methods cannot settle delivery COD',
      );
    }

    const date = new Date();
    const fullySettled = amount.equals(due);

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: add(invoice.paidAmount.toString(), amount).toFixed(2),
          duePrice: sub(due, amount).toFixed(2),
          sessionId: session.id,
          assignedCashierId: invoice.assignedCashierId ?? actorUserId,
          deliveryStatus: fullySettled ? 'settled' : invoice.deliveryStatus === 'pending' ? 'assigned' : invoice.deliveryStatus,
          settledAt: fullySettled ? date : invoice.settledAt,
          settledById: fullySettled ? actorUserId : invoice.settledById,
          deliveryNote: input.note ?? invoice.deliveryNote,
        },
      });

      await tx.invoicePay.create({
        data: {
          shopId,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          methodId: method.id,
          amount: toMoneyString(amount),
          date,
        },
      });

      await tx.paymentMethod.update({
        where: { id: method.id },
        data: { balance: add(method.balance.toString(), amount).toFixed(2) },
      });

      if (invoice.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: invoice.customerId } });
        if (customer) {
          await tx.customer.update({
            where: { id: customer.id },
            data: { due: sub(customer.due.toString(), amount).toFixed(2) },
          });
        }
      }
    });

    return getDeliveryOrThrow(shopId, id);
  },

  async cancel(shopId: number, id: number, note?: string) {
    const invoice = await getDeliveryOrThrow(shopId, id);
    if (invoice.deliveryStatus === 'cancelled') {
      throw new AppError(409, 'DELIVERY_CANCELLED', 'Delivery order is already cancelled');
    }
    if (invoice.deliveryStatus === 'settled') {
      throw new AppError(409, 'DELIVERY_ALREADY_SETTLED', 'Cannot cancel a settled delivery order');
    }
    if (toDecimal(invoice.paidAmount.toString()).greaterThan(0)) {
      throw new AppError(
        409,
        'DELIVERY_HAS_PAYMENTS',
        'Cannot cancel a delivery order that already has payments; refund/return first',
      );
    }

    const lines = toLineSnapshots(invoice.medicines);
    const date = new Date();

    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        if (line.remainingQty > 0) {
          await tx.batch.update({
            where: { id: line.batchId },
            data: { qty: { increment: line.remainingQty } },
          });
        }
      }

      if (invoice.customerId && toDecimal(invoice.duePrice.toString()).greaterThan(0)) {
        const customer = await tx.customer.findUnique({ where: { id: invoice.customerId } });
        if (customer) {
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              due: sub(customer.due.toString(), invoice.duePrice.toString()).toFixed(2),
            },
          });
        }
      }

      if (toDecimal(invoice.totalPrice.toString()).greaterThan(0)) {
        await ledgerService.reverseSaleTransaction(tx, {
          amount: invoice.totalPrice.toString(),
          invoiceId: invoice.invId,
          date,
        });
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          deliveryStatus: 'cancelled',
          duePrice: '0.00',
          deliveryNote: note ?? invoice.deliveryNote,
        },
      });
    });

    return getDeliveryOrThrow(shopId, id);
  },
};
