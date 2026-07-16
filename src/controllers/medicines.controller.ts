import { Request, Response } from 'express';
import { medicinesService } from '../services/medicines.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const medicinesController = {
  async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const data = await medicinesService.list(req.user!.shopId, {
      page,
      limit,
      search: req.query.search as string | undefined,
      categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
      supplierId: req.query.supplierId ? Number(req.query.supplierId) : undefined,
    });
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await medicinesService.getById(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await medicinesService.create(req.user!.shopId, req.body);
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await medicinesService.update(
      req.user!.shopId,
      Number(req.params.id),
      req.body,
    );
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await medicinesService.remove(req.user!.shopId, Number(req.params.id));
    return sendMessage(res, data.message);
  },

  async suggestBarcode(req: Request, res: Response) {
    const data = await medicinesService.suggestBarcode(req.user!.shopId, req.body.prefix);
    return sendSuccess(res, data);
  },
};
