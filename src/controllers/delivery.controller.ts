import { Request, Response } from 'express';
import { deliveryService } from '../services/delivery.service';
import { sendMessage, sendSuccess } from '../utils/response';

export const deliveryController = {
  async list(req: Request, res: Response) {
    const q = req.query as unknown as {
      page: number;
      limit: number;
      status?: 'pending' | 'assigned' | 'out_for_delivery' | 'settled' | 'cancelled';
      assignedCashierId?: number;
      createdById?: number;
      mine?: boolean;
      unsettledOnly?: boolean;
      from?: string;
      to?: string;
      search?: string;
    };
    return sendSuccess(
      res,
      await deliveryService.list(req.user!.shopId, req.user!.userId, q),
    );
  },

  async get(req: Request, res: Response) {
    return sendSuccess(
      res,
      await deliveryService.getById(req.user!.shopId, Number(req.params.id)),
    );
  },

  async assign(req: Request, res: Response) {
    return sendSuccess(
      res,
      await deliveryService.assign(req.user!.shopId, Number(req.params.id), req.body.cashierId),
    );
  },

  async settle(req: Request, res: Response) {
    return sendSuccess(
      res,
      await deliveryService.settle(req.user!.shopId, Number(req.params.id), req.user!.userId, {
        paymentMethodId: req.body.paymentMethodId,
        amount: req.body.amount,
        note: req.body.note,
      }),
    );
  },

  async updateStatus(req: Request, res: Response) {
    return sendSuccess(
      res,
      await deliveryService.updateStatus(
        req.user!.shopId,
        Number(req.params.id),
        req.body.status,
      ),
    );
  },

  async cancel(req: Request, res: Response) {
    await deliveryService.cancel(req.user!.shopId, Number(req.params.id), req.body.note);
    return sendMessage(res, 'Delivery order cancelled');
  },
};
