import { Request, Response } from 'express';
import { reportsService } from '../services/reports.service';
import { sendSuccess } from '../utils/response';

function sendXlsx(res: Response, filename: string, buffer: Buffer) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(buffer);
}

function dateRange(req: Request): { from?: Date; to?: Date } {
  const { from, to } = req.query as unknown as { from?: Date; to?: Date };
  return { from, to };
}

export const reportsController = {
  async customerDues(req: Request, res: Response) {
    const data = await reportsService.customerDues(req.user!.shopId);
    return sendSuccess(res, data);
  },

  async customerDuesExport(req: Request, res: Response) {
    const buffer = await reportsService.customerDuesExport(req.user!.shopId);
    sendXlsx(res, 'customer-dues.xlsx', buffer);
  },

  async supplierPayables(req: Request, res: Response) {
    const data = await reportsService.supplierPayables(req.user!.shopId);
    return sendSuccess(res, data);
  },

  async supplierPayablesExport(req: Request, res: Response) {
    const buffer = await reportsService.supplierPayablesExport(req.user!.shopId);
    sendXlsx(res, 'supplier-payables.xlsx', buffer);
  },

  async salePurchase(req: Request, res: Response) {
    const data = await reportsService.salePurchase(req.user!.shopId, dateRange(req));
    return sendSuccess(res, data);
  },

  async salePurchaseExport(req: Request, res: Response) {
    const buffer = await reportsService.salePurchaseExport(req.user!.shopId, dateRange(req));
    sendXlsx(res, 'sale-purchase.xlsx', buffer);
  },

  async profitLoss(req: Request, res: Response) {
    const data = await reportsService.profitLoss(req.user!.shopId, dateRange(req));
    return sendSuccess(res, data);
  },

  async profitLossExport(req: Request, res: Response) {
    const buffer = await reportsService.profitLossExport(req.user!.shopId, dateRange(req));
    sendXlsx(res, 'profit-loss.xlsx', buffer);
  },

  async paymentMethodTotals(req: Request, res: Response) {
    const data = await reportsService.paymentMethodTotals(req.user!.shopId, dateRange(req));
    return sendSuccess(res, data);
  },

  async insuranceDues(req: Request, res: Response) {
    const data = await reportsService.insuranceDues(req.user!.shopId);
    return sendSuccess(res, data);
  },
};
