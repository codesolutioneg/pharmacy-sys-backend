import { Request, Response } from 'express';
import { leavesService } from '../services/leaves.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const leavesController = {
  async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const data = await leavesService.list(req.user!.shopId, page, limit);
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await leavesService.getById(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await leavesService.create(req.user!.shopId, req.body);
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await leavesService.update(req.user!.shopId, Number(req.params.id), req.body);
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await leavesService.remove(req.user!.shopId, Number(req.params.id));
    return sendMessage(res, data.message);
  },
};
