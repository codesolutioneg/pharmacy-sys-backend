import { Request, Response } from 'express';
import { vendorsService } from '../services/vendors.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const vendorsController = {
  async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const data = await vendorsService.list(req.user!.shopId, page, limit);
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await vendorsService.getById(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await vendorsService.create(req.user!.shopId, req.body);
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await vendorsService.update(req.user!.shopId, Number(req.params.id), req.body);
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await vendorsService.remove(req.user!.shopId, Number(req.params.id));
    return sendMessage(res, data.message);
  },
};
