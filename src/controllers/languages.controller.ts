import { Request, Response } from 'express';
import { ActiveStatus } from '@prisma/client';
import { languagesService } from '../services/languages.service';
import { sendCreated, sendMessage, sendSuccess } from '../utils/response';

export const languagesController = {
  async list(req: Request, res: Response) {
    const { page, limit, status } = req.query as unknown as {
      page: number;
      limit: number;
      status?: ActiveStatus;
    };
    const data = await languagesService.list({ page, limit, status });
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await languagesService.getById(Number(req.params.id));
    return sendSuccess(res, data);
  },

  async create(req: Request, res: Response) {
    const data = await languagesService.create(req.user!.shopId, req.body);
    return sendCreated(res, data);
  },

  async update(req: Request, res: Response) {
    const data = await languagesService.update(Number(req.params.id), req.body);
    return sendSuccess(res, data);
  },

  async updateTerms(req: Request, res: Response) {
    const data = await languagesService.updateTerms(Number(req.params.id), req.body.terms);
    return sendSuccess(res, data);
  },

  async remove(req: Request, res: Response) {
    const data = await languagesService.remove(Number(req.params.id));
    return sendMessage(res, data.message);
  },
};
