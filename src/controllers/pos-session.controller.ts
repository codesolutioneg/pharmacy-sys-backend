import { Request, Response } from 'express';
import { posSessionService } from '../services/pos-session.service';
import { sendCreated, sendSuccess } from '../utils/response';

export const posSessionController = {
  async open(req: Request, res: Response) {
    const data = await posSessionService.open(
      req.user!.shopId,
      req.user!.userId,
      Number(req.body.openingFloat ?? 0),
    );
    return sendCreated(res, data);
  },

  async current(req: Request, res: Response) {
    const data = await posSessionService.current(req.user!.shopId, req.user!.userId);
    return sendSuccess(res, data);
  },

  async close(req: Request, res: Response) {
    const data = await posSessionService.close(
      req.user!.shopId,
      req.user!.userId,
      Number(req.params.id),
      {
        countedCash: Number(req.body.countedCash),
        note: req.body.note,
      },
    );
    return sendSuccess(res, data);
  },

  async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const data = await posSessionService.list(req.user!.shopId, page, limit);
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await posSessionService.getById(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },
};
