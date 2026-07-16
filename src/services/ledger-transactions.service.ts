import { LedgerInvoiceType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ledgerService } from './ledger.service';

/** Manual journal entry CRUD/listing on top of the shared ledger.service.ts posting helpers. */
export const ledgerTransactionsService = {
  async list(params: {
    page: number;
    limit: number;
    accountId?: number;
    invoiceType?: LedgerInvoiceType;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.LedgerTransactionWhereInput = {
      ...(params.accountId
        ? { OR: [{ debitAccountId: params.accountId }, { creditAccountId: params.accountId }] }
        : {}),
      ...(params.invoiceType ? { invoiceType: params.invoiceType } : {}),
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
      prisma.ledgerTransaction.findMany({
        where,
        include: { debitAccount: true, creditAccount: true },
        orderBy: { id: 'desc' },
        skip,
        take: params.limit,
      }),
      prisma.ledgerTransaction.count({ where }),
    ]);
    return { items, meta: { page: params.page, limit: params.limit, total } };
  },

  async getById(id: number) {
    const entry = await prisma.ledgerTransaction.findUnique({
      where: { id },
      include: { debitAccount: true, creditAccount: true },
    });
    if (!entry) {
      throw new AppError(404, 'LEDGER_ENTRY_NOT_FOUND', 'Ledger transaction not found');
    }
    return entry;
  },

  async createManual(data: {
    date?: Date;
    debitAccountId: number;
    creditAccountId: number;
    amount: number;
    particular: string;
  }) {
    if (data.debitAccountId === data.creditAccountId) {
      throw new AppError(
        400,
        'INVALID_JOURNAL_ENTRY',
        'debitAccountId and creditAccountId must differ',
      );
    }
    const [debitAccount, creditAccount] = await Promise.all([
      prisma.account.findUnique({ where: { id: data.debitAccountId } }),
      prisma.account.findUnique({ where: { id: data.creditAccountId } }),
    ]);
    if (!debitAccount) {
      throw new AppError(400, 'INVALID_ACCOUNT', 'Debit account not found');
    }
    if (!creditAccount) {
      throw new AppError(400, 'INVALID_ACCOUNT', 'Credit account not found');
    }

    const entry = await prisma.$transaction((tx) =>
      ledgerService.manualTransaction(tx, {
        amount: data.amount,
        debitAccountId: data.debitAccountId,
        creditAccountId: data.creditAccountId,
        particular: data.particular,
        date: data.date,
      }),
    );

    return this.getById(entry.id);
  },
};
