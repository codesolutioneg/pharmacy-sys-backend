import { Request, Response } from 'express';
import { accountingReportsService } from '../services/accounting-reports.service';
import { sendSuccess } from '../utils/response';

export const accountingReportsController = {
  async trialBalance(req: Request, res: Response) {
    const { dateFrom, dateTo } = req.query as unknown as { dateFrom?: Date; dateTo?: Date };
    const data = await accountingReportsService.trialBalance({ dateFrom, dateTo });
    return sendSuccess(res, data);
  },

  async balanceSheet(req: Request, res: Response) {
    const { dateFrom, dateTo } = req.query as unknown as { dateFrom?: Date; dateTo?: Date };
    const data = await accountingReportsService.balanceSheet({ dateFrom, dateTo });
    return sendSuccess(res, data);
  },

  async incomeStatement(req: Request, res: Response) {
    const { dateFrom, dateTo } = req.query as unknown as { dateFrom?: Date; dateTo?: Date };
    const data = await accountingReportsService.incomeStatement({ dateFrom, dateTo });
    return sendSuccess(res, data);
  },
};
