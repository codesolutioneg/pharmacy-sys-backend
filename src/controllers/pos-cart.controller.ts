import { Request, Response } from 'express';
import { posCartService } from '../services/pos-cart.service';
import { sendCreated, sendSuccess } from '../utils/response';

export const posCartController = {
  async createCart(req: Request, res: Response) {
    const cart = await posCartService.createCart(req.user!.shopId, req.user!.userId);
    return sendCreated(res, await posCartService.buildCartView(req.user!.shopId, cart));
  },

  async addItem(req: Request, res: Response) {
    const cart = await posCartService.addItem(
      req.user!.shopId,
      Number(req.params.id),
      req.body.medicineId,
    );
    return sendSuccess(res, await posCartService.buildCartView(req.user!.shopId, cart));
  },

  async updateItem(req: Request, res: Response) {
    const cart = await posCartService.updateItem(
      req.user!.shopId,
      Number(req.params.id),
      req.params.itemId,
      req.body,
    );
    return sendSuccess(res, await posCartService.buildCartView(req.user!.shopId, cart));
  },

  async removeItem(req: Request, res: Response) {
    const cart = await posCartService.removeItem(
      req.user!.shopId,
      Number(req.params.id),
      req.params.itemId,
    );
    return sendSuccess(res, await posCartService.buildCartView(req.user!.shopId, cart));
  },

  async updateCart(req: Request, res: Response) {
    const cart = await posCartService.updateCartMeta(
      req.user!.shopId,
      Number(req.params.id),
      req.body,
    );
    return sendSuccess(res, await posCartService.buildCartView(req.user!.shopId, cart));
  },

  async getCart(req: Request, res: Response) {
    const data = await posCartService.getCartView(req.user!.shopId, Number(req.params.id));
    return sendSuccess(res, data);
  },

  async checkout(req: Request, res: Response) {
    const data = await posCartService.checkout(req.user!.shopId, req.body.cartId);
    return sendCreated(res, data);
  },
};
