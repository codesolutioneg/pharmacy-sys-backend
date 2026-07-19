import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { add, sub, toDecimal, toMoneyString } from '../utils/money';

function isCashMethodName(name: string): boolean {
  return name.trim().toLowerCase() === 'cash';
}

async function computeSessionTotals(shopId: number, sessionId: number) {
  const invoices = await prisma.invoice.findMany({
    where: { shopId, sessionId },
    select: {
      id: true,
      totalPrice: true,
      methodId: true,
      pays: { select: { methodId: true, amount: true } },
      saleReturns: { select: { amount: true, invoiceId: true } },
      method: { select: { id: true, name: true } },
    },
  });

  const methodIds = new Set<number>();
  for (const inv of invoices) {
    methodIds.add(inv.methodId);
    for (const pay of inv.pays) methodIds.add(pay.methodId);
  }
  const methods = await prisma.paymentMethod.findMany({
    where: { shopId, id: { in: [...methodIds] } },
  });
  const methodById = new Map(methods.map((m) => [m.id, m]));

  let grossSales = toDecimal(0);
  let cashPays = toDecimal(0);
  let cashReturns = toDecimal(0);
  const byMethod = new Map<number, { methodId: number; name: string; amount: Prisma.Decimal }>();

  for (const inv of invoices) {
    grossSales = add(grossSales, inv.totalPrice.toString());
    for (const pay of inv.pays) {
      const method = methodById.get(pay.methodId);
      const name = method?.name ?? `Method #${pay.methodId}`;
      const prev = byMethod.get(pay.methodId);
      const nextAmt = add(prev?.amount.toString() ?? 0, pay.amount.toString());
      byMethod.set(pay.methodId, {
        methodId: pay.methodId,
        name,
        amount: nextAmt,
      });
      if (method && isCashMethodName(method.name)) {
        cashPays = add(cashPays, pay.amount.toString());
      }
    }
    const invMethod = methodById.get(inv.methodId);
    for (const ret of inv.saleReturns) {
      if (invMethod && isCashMethodName(invMethod.name)) {
        cashReturns = add(cashReturns, ret.amount.toString());
      }
      const prev = byMethod.get(inv.methodId);
      if (prev) {
        byMethod.set(inv.methodId, {
          ...prev,
          amount: sub(prev.amount.toString(), ret.amount.toString()),
        });
      }
    }
  }

  return {
    invoiceCount: invoices.length,
    grossSales,
    cashPays,
    cashReturns,
    byPaymentMethod: [...byMethod.values()].map((row) => ({
      methodId: row.methodId,
      name: row.name,
      amount: row.amount.toFixed(2),
    })),
  };
}

function mapSession(
  session: {
    id: number;
    shopId: number;
    userId: number;
    status: string;
    openingFloat: Prisma.Decimal;
    openedAt: Date;
    closedAt: Date | null;
    countedCash: Prisma.Decimal | null;
    expectedCash: Prisma.Decimal | null;
    difference: Prisma.Decimal | null;
    note: string | null;
    user?: { id: number; name: string; email: string };
  },
  totals?: Awaited<ReturnType<typeof computeSessionTotals>> & { expectedCash?: Prisma.Decimal },
) {
  return {
    id: session.id,
    shopId: session.shopId,
    userId: session.userId,
    status: session.status,
    openingFloat: session.openingFloat.toFixed(2),
    openedAt: session.openedAt.toISOString(),
    closedAt: session.closedAt?.toISOString() ?? null,
    countedCash: session.countedCash?.toFixed(2) ?? null,
    expectedCash: session.expectedCash?.toFixed(2) ?? totals?.expectedCash?.toFixed(2) ?? null,
    difference: session.difference?.toFixed(2) ?? null,
    note: session.note,
    user: session.user
      ? { id: session.user.id, name: session.user.name, email: session.user.email }
      : undefined,
    totals: totals
      ? {
          invoiceCount: totals.invoiceCount,
          grossSales: totals.grossSales.toFixed(2),
          cashPays: totals.cashPays.toFixed(2),
          cashReturns: totals.cashReturns.toFixed(2),
          byPaymentMethod: totals.byPaymentMethod,
        }
      : undefined,
  };
}

export const posSessionService = {
  async getOpenSession(shopId: number, userId: number) {
    return prisma.posSession.findFirst({
      where: { shopId, userId, status: 'open' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  },

  async requireOpenSession(shopId: number, userId: number) {
    const session = await this.getOpenSession(shopId, userId);
    if (!session) {
      throw new AppError(409, 'NO_OPEN_SESSION', 'Open a cashier session before checkout');
    }
    return session;
  },

  async open(shopId: number, userId: number, openingFloat = 0) {
    const existing = await this.getOpenSession(shopId, userId);
    if (existing) {
      throw new AppError(409, 'SESSION_ALREADY_OPEN', 'You already have an open session');
    }

    try {
      const session = await prisma.posSession.create({
        data: {
          shopId,
          userId,
          status: 'open',
          openingFloat: toMoneyString(openingFloat),
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      return mapSession(session, {
        invoiceCount: 0,
        grossSales: toDecimal(0),
        cashPays: toDecimal(0),
        cashReturns: toDecimal(0),
        byPaymentMethod: [],
        expectedCash: toDecimal(openingFloat),
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError(409, 'SESSION_ALREADY_OPEN', 'You already have an open session');
      }
      throw err;
    }
  },

  async current(shopId: number, userId: number) {
    const session = await this.getOpenSession(shopId, userId);
    if (!session) {
      return null;
    }
    const totals = await computeSessionTotals(shopId, session.id);
    const expectedCash = sub(
      add(session.openingFloat.toString(), totals.cashPays),
      totals.cashReturns,
    );
    return mapSession(session, { ...totals, expectedCash });
  },

  async close(
    shopId: number,
    userId: number,
    sessionId: number,
    input: { countedCash: number; note?: string | null },
  ) {
    const session = await prisma.posSession.findFirst({
      where: { id: sessionId, shopId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!session) {
      throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
    }
    if (session.status !== 'open') {
      throw new AppError(409, 'SESSION_ALREADY_CLOSED', 'Session is already closed');
    }
    if (session.userId !== userId) {
      throw new AppError(403, 'SESSION_NOT_OWNED', 'You can only close your own session');
    }

    const totals = await computeSessionTotals(shopId, session.id);
    const expectedCash = sub(add(session.openingFloat.toString(), totals.cashPays), totals.cashReturns);
    const difference = sub(input.countedCash, expectedCash);

    const closed = await prisma.posSession.update({
      where: { id: session.id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        countedCash: toMoneyString(input.countedCash),
        expectedCash: toMoneyString(expectedCash),
        difference: toMoneyString(difference),
        note: input.note ?? null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return mapSession(closed, { ...totals, expectedCash });
  },

  async list(shopId: number, page: number, limit: number, userId?: number) {
    const skip = (page - 1) * limit;
    const where: Prisma.PosSessionWhereInput = {
      shopId,
      ...(userId ? { userId } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.posSession.findMany({
        where,
        orderBy: { openedAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.posSession.count({ where }),
    ]);
    return {
      items: items.map((s) => mapSession(s)),
      meta: { page, limit, total },
    };
  },

  async getById(shopId: number, id: number) {
    const session = await prisma.posSession.findFirst({
      where: { id, shopId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!session) {
      throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
    }
    const totals = await computeSessionTotals(shopId, session.id);
    const expectedCash =
      session.expectedCash ??
      sub(add(session.openingFloat.toString(), totals.cashPays), totals.cashReturns);
    return mapSession(session, { ...totals, expectedCash: toDecimal(expectedCash.toString()) });
  },
};
