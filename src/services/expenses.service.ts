import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { toMoneyString } from '../utils/money';
import { ledgerService } from './ledger.service';

export const expensesService = {
  async list(
    shopId: number,
    params: { page: number; limit: number; categoryId?: number; dateFrom?: Date; dateTo?: Date },
  ) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.PharmacyExpenseWhereInput = {
      shopId,
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.dateFrom || params.dateTo
        ? {
            date: {
              ...(params.dateFrom ? { gte: params.dateFrom } : {}),
              ...(params.dateTo ? { lte: params.dateTo } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.pharmacyExpense.findMany({
        where,
        include: { category: true, account: true },
        orderBy: { id: 'desc' },
        skip,
        take: params.limit,
      }),
      prisma.pharmacyExpense.count({ where }),
    ]);
    return { items, meta: { page: params.page, limit: params.limit, total } };
  },

  async getById(shopId: number, id: number) {
    const expense = await prisma.pharmacyExpense.findFirst({
      where: { id, shopId },
      include: { category: true, account: true },
    });
    if (!expense) {
      throw new AppError(404, 'EXPENSE_NOT_FOUND', 'Expense not found');
    }
    return expense;
  },

  async create(
    shopId: number,
    data: {
      date: Date;
      title: string;
      categoryId: number;
      accountId: number;
      amount: number;
      reference?: string | null;
      note?: string | null;
    },
  ) {
    const category = await prisma.expenseCategory.findFirst({
      where: { id: data.categoryId, shopId },
    });
    if (!category) {
      throw new AppError(400, 'INVALID_CATEGORY', 'Expense category not found for this shop');
    }
    const account = await prisma.account.findUnique({ where: { id: data.accountId } });
    if (!account) {
      throw new AppError(400, 'INVALID_ACCOUNT', 'Account not found');
    }

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.pharmacyExpense.create({
        data: {
          shopId,
          categoryId: data.categoryId,
          accountId: data.accountId,
          date: data.date,
          title: data.title,
          amount: toMoneyString(data.amount),
          reference: data.reference ?? null,
          note: data.note ?? null,
        },
      });

      await ledgerService.expenseTransaction(tx, {
        amount: data.amount,
        accountId: data.accountId,
        description: data.title,
        invoiceId: `EXP-${created.id}`,
        date: data.date,
      });

      return created;
    });

    return this.getById(shopId, expense.id);
  },

  async update(
    shopId: number,
    id: number,
    data: {
      date?: Date;
      title?: string;
      categoryId?: number;
      accountId?: number;
      amount?: number;
      reference?: string | null;
      note?: string | null;
    },
  ) {
    const existing = await this.getById(shopId, id);

    if (data.categoryId !== undefined) {
      const category = await prisma.expenseCategory.findFirst({
        where: { id: data.categoryId, shopId },
      });
      if (!category) {
        throw new AppError(400, 'INVALID_CATEGORY', 'Expense category not found for this shop');
      }
    }
    if (data.accountId !== undefined) {
      const account = await prisma.account.findUnique({ where: { id: data.accountId } });
      if (!account) {
        throw new AppError(400, 'INVALID_ACCOUNT', 'Account not found');
      }
    }

    const ledgerNeedsSync = data.amount !== undefined || data.accountId !== undefined;
    const newAmount = data.amount ?? Number(existing.amount);
    const newAccountId = data.accountId ?? existing.accountId;

    await prisma.$transaction(async (tx) => {
      const updated = await tx.pharmacyExpense.update({
        where: { id },
        data: {
          categoryId: data.categoryId,
          accountId: data.accountId,
          date: data.date,
          title: data.title,
          amount: data.amount !== undefined ? toMoneyString(data.amount) : undefined,
          reference: data.reference,
          note: data.note,
        },
      });

      // Node integrity fix: Laravel leaves the ledger untouched on update (specs/expenses.md
      // divergence). Reverse the original entry and post a fresh one so amounts/accounts stay in sync.
      if (ledgerNeedsSync && existing.accountId) {
        await ledgerService.reverseExpenseTransaction(tx, {
          amount: existing.amount,
          accountId: existing.accountId,
          description: `Update of expense: ${existing.title}`,
          invoiceId: `EXP-${existing.id}`,
          date: new Date(),
        });
        await ledgerService.expenseTransaction(tx, {
          amount: newAmount,
          accountId: newAccountId!,
          description: updated.title,
          invoiceId: `EXP-${existing.id}`,
          date: new Date(),
        });
      }

      return updated;
    });

    return this.getById(shopId, id);
  },

  async remove(shopId: number, id: number) {
    const existing = await this.getById(shopId, id);

    await prisma.$transaction(async (tx) => {
      // Node integrity fix: reverse the ledger entry instead of leaving it dangling
      // (specs/expenses.md divergence — Laravel's delete() does not touch the ledger).
      if (existing.accountId) {
        await ledgerService.reverseExpenseTransaction(tx, {
          amount: existing.amount,
          accountId: existing.accountId,
          description: `Deletion of expense: ${existing.title}`,
          invoiceId: `EXP-${existing.id}`,
          date: new Date(),
        });
      }
      await tx.pharmacyExpense.delete({ where: { id } });
    });

    return { message: 'Expense deleted' };
  },
};
