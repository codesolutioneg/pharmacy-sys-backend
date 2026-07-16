import { Request, Response } from 'express';
import { unitsService } from '../services/units.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const unitsController = {
  async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const data = await unitsService.list(req.user!.shopId, page, limit);
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await unitsService.getById(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await unitsService.create(req.user!.shopId, req.body);
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await unitsService.update(req.user!.shopId, Number(req.params.id), req.body);
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await unitsService.remove(req.user!.shopId, Number(req.params.id));
    return sendMessage(res, data.message);
  },
};
