import { LedgerInvoiceType } from '@prisma/client';
import { Request, Response } from 'express';
import { ledgerTransactionsService } from '../services/ledger-transactions.service';
import { sendCreated, sendSuccess } from '../utils/response';

export const ledgerTransactionsController = {
  async list(req: Request, res: Response) {
    const { page, limit, accountId, invoiceType, dateFrom, dateTo } = req.query as unknown as {
      page: number;
      limit: number;
      accountId?: number;
      invoiceType?: LedgerInvoiceType;
      dateFrom?: Date;
      dateTo?: Date;
    };
    const data = await ledgerTransactionsService.list({
      page,
      limit,
      accountId,
      invoiceType,
      dateFrom,
      dateTo,
    });
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await ledgerTransactionsService.getById(Number(req.params.id));
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await ledgerTransactionsService.createManual(req.body);
    return sendCreated(res, data);
  },
};
