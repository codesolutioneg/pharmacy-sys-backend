import { Request, Response } from 'express';
import { usersService } from '../services/users.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const usersController = {
  async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const data = await usersService.list(req.user!.shopId, page, limit);
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await usersService.getById(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await usersService.create(req.user!.shopId, req.body);
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await usersService.update(
      req.user!.shopId,
      Number(req.params.id),
      req.body,
    );
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await usersService.remove(
      req.user!.shopId,
      Number(req.params.id),
      req.user!.userId,
    );
    return sendMessage(res, data.message);
  },
};
