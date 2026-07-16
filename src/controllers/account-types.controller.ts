import { Request, Response } from 'express';
import { accountTypesService } from '../services/account-types.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const accountTypesController = {
  async list(req: Request, res: Response) {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const data = await accountTypesService.list(page, limit);
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await accountTypesService.getById(Number(req.params.id));
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await accountTypesService.create(req.body);
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await accountTypesService.update(Number(req.params.id), req.body);
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await accountTypesService.remove(Number(req.params.id));
    return sendMessage(res, data.message);
  },
};
