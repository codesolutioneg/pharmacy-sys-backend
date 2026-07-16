import { Router } from 'express';
import { posCartController } from '../controllers/pos-cart.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import {
  addCartItemSchema,
  cartIdParamSchema,
  cartItemIdParamSchema,
  checkoutSchema,
  updateCartItemSchema,
  updateCartSchema,
} from '../validators/pos-cart.validator';

export const posCartRouter = Router();

posCartRouter.use(authJwt);

posCartRouter.post('/carts', authorize('sale.create'), asyncHandler(posCartController.createCart));

posCartRouter.get(
  '/carts/:id',
  authorize('sale.show'),
  validate(cartIdParamSchema, 'params'),
  asyncHandler(posCartController.getCart),
);

posCartRouter.patch(
  '/carts/:id',
  authorize('sale.update'),
  validate(cartIdParamSchema, 'params'),
  validate(updateCartSchema),
  asyncHandler(posCartController.updateCart),
);

posCartRouter.post(
  '/carts/:id/items',
  authorize('sale.create'),
  validate(cartIdParamSchema, 'params'),
  validate(addCartItemSchema),
  asyncHandler(posCartController.addItem),
);

posCartRouter.patch(
  '/carts/:id/items/:itemId',
  authorize('sale.update'),
  validate(cartItemIdParamSchema, 'params'),
  validate(updateCartItemSchema),
  asyncHandler(posCartController.updateItem),
);

posCartRouter.delete(
  '/carts/:id/items/:itemId',
  authorize('sale.update'),
  validate(cartItemIdParamSchema, 'params'),
  asyncHandler(posCartController.removeItem),
);

posCartRouter.post(
  '/checkout',
  authorize('sale.store'),
  validate(checkoutSchema),
  asyncHandler(posCartController.checkout),
);
