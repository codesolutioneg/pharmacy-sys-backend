import { Request, Response } from 'express';
import { settingsService } from '../services/settings.service';
import { sendSuccess } from '../utils/response';

export const settingsController = {
  async getShop(req: Request, res: Response) {
    return sendSuccess(res, await settingsService.getShop(req.user!.shopId));
  },

  async getGeneral(req: Request, res: Response) {
    return sendSuccess(res, await settingsService.getGeneral(req.user!.shopId));
  },

  async patchGeneral(req: Request, res: Response) {
    return sendSuccess(
      res,
      await settingsService.patchGeneral(req.user!.shopId, req.body),
    );
  },

  async getEmail(req: Request, res: Response) {
    return sendSuccess(res, await settingsService.getEmail(req.user!.shopId));
  },

  async patchEmail(req: Request, res: Response) {
    return sendSuccess(
      res,
      await settingsService.patchEmail(req.user!.shopId, req.body),
    );
  },

  async getKv(req: Request, res: Response) {
    const name = req.query.name as string | undefined;
    return sendSuccess(res, await settingsService.getKv(req.user!.shopId, name));
  },

  async upsertKv(req: Request, res: Response) {
    return sendSuccess(
      res,
      await settingsService.upsertKv(req.user!.shopId, req.body.name, req.body.value),
    );
  },
};
