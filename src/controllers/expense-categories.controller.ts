import { ActiveStatus } from '@prisma/client';
import { Request, Response } from 'express';
import { expenseCategoriesService } from '../services/expense-categories.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const expenseCategoriesController = {
  async list(req: Request, res: Response) {
    const { page, limit, status } = req.query as unknown as {
      page: number;
      limit: number;
      status?: ActiveStatus;
    };
    const data = await expenseCategoriesService.list(req.user!.shopId, { page, limit, status });
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await expenseCategoriesService.getById(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await expenseCategoriesService.create(req.user!.shopId, req.body);
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await expenseCategoriesService.update(
      req.user!.shopId,
      Number(req.params.id),
      req.body,
    );
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await expenseCategoriesService.remove(req.user!.shopId, Number(req.params.id));
    return sendMessage(res, data.message);
  },
};
