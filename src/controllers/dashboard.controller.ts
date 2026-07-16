import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { sendSuccess } from '../utils/response';

export const dashboardController = {
  async summary(req: Request, res: Response) {
    const data = await dashboardService.summary(req.user!.shopId);
    return sendSuccess(res, data);
  },
};
