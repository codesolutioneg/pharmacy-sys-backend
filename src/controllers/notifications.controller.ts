import { Request, Response } from 'express';
import { notificationsService } from '../services/notifications.service';
import { sendMessage, sendSuccess } from '../utils/response';

export const notificationsController = {
  async list(req: Request, res: Response) {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const data = await notificationsService.list(req.user!.shopId, req.user!.userId, {
      page,
      limit,
    });
    return sendSuccess(res, data);
  },

  async unreadCount(req: Request, res: Response) {
    const data = await notificationsService.unreadCount(req.user!.shopId, req.user!.userId);
    return sendSuccess(res, data);
  },

  async get(req: Request, res: Response) {
    const data = await notificationsService.getAndMarkSeen(
      req.user!.shopId,
      req.user!.userId,
      Number(req.params.id),
    );
    return sendSuccess(res, data);
  },

  async markSeen(req: Request, res: Response) {
    const data = await notificationsService.markSeen(
      req.user!.shopId,
      req.user!.userId,
      Number(req.params.id),
    );
    return sendMessage(res, data.message);
  },

  async markAllSeen(req: Request, res: Response) {
    const data = await notificationsService.markAllSeen(req.user!.shopId, req.user!.userId);
    return sendMessage(res, data.message);
  },
};
