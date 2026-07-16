import { Request, Response } from 'express';
import { productCategoriesService } from '../services/product-categories.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const productCategoriesController = {
  async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const data = await productCategoriesService.list(req.user!.shopId, page, limit);
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await productCategoriesService.getById(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await productCategoriesService.create(req.user!.shopId, req.body);
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await productCategoriesService.update(
      req.user!.shopId,
      Number(req.params.id),
      req.body,
    );
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await productCategoriesService.remove(req.user!.shopId, Number(req.params.id));
    return sendMessage(res, data.message);
  },
};
