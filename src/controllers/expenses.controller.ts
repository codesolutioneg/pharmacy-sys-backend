import { Request, Response } from 'express';
import { expensesService } from '../services/expenses.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const expensesController = {
  async list(req: Request, res: Response) {
    const { page, limit, categoryId, dateFrom, dateTo } = req.query as unknown as {
      page: number;
      limit: number;
      categoryId?: number;
      dateFrom?: Date;
      dateTo?: Date;
    };
    const data = await expensesService.list(req.user!.shopId, {
      page,
      limit,
      categoryId,
      dateFrom,
      dateTo,
    });
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await expensesService.getById(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await expensesService.create(req.user!.shopId, req.body);
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await expensesService.update(req.user!.shopId, Number(req.params.id), req.body);
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await expensesService.remove(req.user!.shopId, Number(req.params.id));
    return sendMessage(res, data.message);
  },
};
