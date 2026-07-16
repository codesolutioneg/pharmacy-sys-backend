import { Request, Response } from 'express';
import { invoicesService } from '../services/invoices.service';
import { sendCreated, sendSuccess } from '../utils/response';

export const invoicesController = {
  async list(req: Request, res: Response) {
    const { page, limit, customerId } = req.query as unknown as {
      page: number;
      limit: number;
      customerId?: number;
    };
    const data = await invoicesService.list(req.user!.shopId, { page, limit, customerId });
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await invoicesService.getById(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async pdf(req: Request, res: Response) {
    const buffer = await invoicesService.getPdfBuffer(req.user!.shopId, Number(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${req.params.id}.pdf"`);
    res.status(200).send(buffer);
  },

  async email(req: Request, res: Response) {
    const data = await invoicesService.sendEmail(
      req.user!.shopId,
      Number(req.params.id),
      req.body?.to,
    );
    return sendSuccess(res, data);
  },

  async pay(req: Request, res: Response) {
    const data = await invoicesService.pay(req.user!.shopId, Number(req.params.id), req.body);
    return sendCreated(res, data);
  },

  async approve(req: Request, res: Response) {
    const data = await invoicesService.approve(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await invoicesService.remove(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async createReturn(req: Request, res: Response) {
    const data = await invoicesService.createReturn(
      req.user!.shopId,
      Number(req.params.id),
      req.body,
    );
    return sendCreated(res, data);
  },

  async listReturns(req: Request, res: Response) {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const data = await invoicesService.listReturns(req.user!.shopId, Number(req.params.id), {
      page,
      limit,
    });
    return sendSuccess(res, data);
  },
};
