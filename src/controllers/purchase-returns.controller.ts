import { Request, Response } from 'express';
import { purchaseReturnsService } from '../services/purchase-returns.service';
import { sendSuccess } from '../utils/response';

export const purchaseReturnsController = {
  async list(req: Request, res: Response) {
    const { page, limit, purchaseId, supplierId } = req.query as unknown as {
      page: number;
      limit: number;
      purchaseId?: number;
      supplierId?: number;
    };
    const data = await purchaseReturnsService.list(req.user!.shopId, {
      page,
      limit,
      purchaseId,
      supplierId,
    });
    return sendSuccess(res, data);
  },
};
