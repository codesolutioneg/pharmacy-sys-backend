import { Request, Response } from 'express';
import { accountsService } from '../services/accounts.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const accountsController = {
  async list(req: Request, res: Response) {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const data = await accountsService.list(page, limit);
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await accountsService.getById(Number(req.params.id));
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await accountsService.create(req.body);
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await accountsService.update(Number(req.params.id), req.body);
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await accountsService.remove(Number(req.params.id));
    return sendMessage(res, data.message);
  },
};
