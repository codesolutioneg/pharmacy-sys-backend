import { Request, Response } from 'express';
import { stockService } from '../services/stock.service';
import { sendSuccess } from '../utils/response';

export const stockController = {
  async listBatches(req: Request, res: Response) {
    const { page, limit, medicineId, expireBefore } = req.query as unknown as {
      page: number;
      limit: number;
      medicineId?: number;
      expireBefore?: Date;
    };
    const data = await stockService.listBatches(req.user!.shopId, {
      page,
      limit,
      medicineId,
      expireBefore,
    });
    return sendSuccess(res, data);
  },

  async updateBatchPrice(req: Request, res: Response) {
    const data = await stockService.updateBatchPrice(
      req.user!.shopId,
      Number(req.params.id),
      req.body.price,
    );
    return sendSuccess(res, data);
  },

  async summary(req: Request, res: Response) {
    const data = await stockService.summary(req.user!.shopId, Number(req.params.medicineId));
    return sendSuccess(res, data);
  },

  async inStock(req: Request, res: Response) {
    const data = await stockService.inStock(req.user!.shopId);
    return sendSuccess(res, data);
  },

  async lowStock(req: Request, res: Response) {
    const data = await stockService.lowStock(req.user!.shopId);
    return sendSuccess(res, data);
  },

  async outOfStock(req: Request, res: Response) {
    const data = await stockService.outOfStock(req.user!.shopId);
    return sendSuccess(res, data);
  },

  async expiring(req: Request, res: Response) {
    const data = await stockService.expiring(req.user!.shopId);
    return sendSuccess(res, data);
  },

  async expired(req: Request, res: Response) {
    const data = await stockService.expired(req.user!.shopId);
    return sendSuccess(res, data);
  },
};
