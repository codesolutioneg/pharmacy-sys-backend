import { ActiveStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

/** Global chart of accounts — no shopId, mirrors Laravel's un-scoped accounts table. */
export const accountsService = {
  async list(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.account.findMany({
        include: { accountType: true },
        orderBy: [{ serial: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.account.count(),
    ]);
    return { items, meta: { page, limit, total } };
  },

  async getById(id: number) {
    const account = await prisma.account.findUnique({
      where: { id },
      include: { accountType: true },
    });
    if (!account) {
      throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
    }
    return account;
  },

  async create(data: { name: string; accountTypeId: number; status?: ActiveStatus; serial?: number }) {
    const type = await prisma.accountType.findUnique({ where: { id: data.accountTypeId } });
    if (!type) {
      throw new AppError(400, 'INVALID_ACCOUNT_TYPE', 'Account type not found');
    }
    return prisma.account.create({
      data: {
        name: data.name,
        accountTypeId: data.accountTypeId,
        status: data.status ?? 'active',
        serial: data.serial ?? 1,
      },
    });
  },

  async update(
    id: number,
    data: { name?: string; accountTypeId?: number; status?: ActiveStatus; serial?: number },
  ) {
    await this.getById(id);
    if (data.accountTypeId !== undefined) {
      const type = await prisma.accountType.findUnique({ where: { id: data.accountTypeId } });
      if (!type) {
        throw new AppError(400, 'INVALID_ACCOUNT_TYPE', 'Account type not found');
      }
    }
    return prisma.account.update({
      where: { id },
      data: {
        name: data.name,
        accountTypeId: data.accountTypeId,
        status: data.status,
        serial: data.serial,
      },
    });
  },

  async remove(id: number) {
    const account = await this.getById(id);
    if (!account.isDeletable) {
      throw new AppError(409, 'ACCOUNT_NOT_DELETABLE', 'This account cannot be deleted');
    }
    const ledgerCount = await prisma.ledgerTransaction.count({
      where: { OR: [{ debitAccountId: id }, { creditAccountId: id }] },
    });
    if (ledgerCount > 0) {
      throw new AppError(
        409,
        'ACCOUNT_IN_USE',
        'Cannot delete an account referenced by ledger transactions',
      );
    }
    const expenseCount = await prisma.pharmacyExpense.count({ where: { accountId: id } });
    if (expenseCount > 0) {
      throw new AppError(409, 'ACCOUNT_IN_USE', 'Cannot delete an account referenced by expenses');
    }
    await prisma.account.delete({ where: { id } });
    return { message: 'Account deleted' };
  },
};
