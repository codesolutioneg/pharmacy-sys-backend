import { Request, Response } from 'express';
import { paymentMethodsService } from '../services/payment-methods.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const paymentMethodsController = {
  async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const data = await paymentMethodsService.list(req.user!.shopId, page, limit);
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await paymentMethodsService.getById(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await paymentMethodsService.create(req.user!.shopId, req.body);
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await paymentMethodsService.update(
      req.user!.shopId,
      Number(req.params.id),
      req.body,
    );
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await paymentMethodsService.remove(req.user!.shopId, Number(req.params.id));
    return sendMessage(res, data.message);
  },

  async deposit(req: Request, res: Response) {
    const data = await paymentMethodsService.deposit(
      req.user!.shopId,
      Number(req.params.id),
      req.body.amount,
    );
    return sendSuccess(res, data);
  },
};
