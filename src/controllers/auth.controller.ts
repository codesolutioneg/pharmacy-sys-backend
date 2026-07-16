import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { sendMessage, sendSuccess } from '../utils/response';

export const authController = {
  async login(req: Request, res: Response) {
    const data = await authService.login(req.body.email, req.body.password);
    return sendSuccess(res, data);
  },

  async refresh(req: Request, res: Response) {
    const data = await authService.refresh(req.body.refreshToken);
    return sendSuccess(res, data);
  },

  async logout(req: Request, res: Response) {
    await authService.logout(req.body?.refreshToken as string | undefined);
    return sendMessage(res, 'Logged out');
  },

  async forgotPassword(req: Request, res: Response) {
    const data = await authService.forgotPassword(req.body.email);
    return sendMessage(res, data.message);
  },

  async resetPassword(req: Request, res: Response) {
    const data = await authService.resetPassword(
      req.body.email,
      req.body.token,
      req.body.password,
    );
    return sendMessage(res, data.message);
  },

  async me(req: Request, res: Response) {
    const data = await authService.me(req.user!.userId);
    return sendSuccess(res, data);
  },

  async updateProfile(req: Request, res: Response) {
    const data = await authService.updateProfile(req.user!.userId, req.body);
    return sendSuccess(res, data);
  },

  async changePassword(req: Request, res: Response) {
    const data = await authService.changePassword(
      req.user!.userId,
      req.body.currentPassword,
      req.body.newPassword,
    );
    return sendMessage(res, data.message);
  },
};
