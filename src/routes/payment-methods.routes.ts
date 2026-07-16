import { Router } from 'express';
import { paymentMethodsController } from '../controllers/payment-methods.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema, paginationSchema } from '../validators/users.validator';
import {
  createPaymentMethodSchema,
  depositSchema,
  updatePaymentMethodSchema,
} from '../validators/payment-methods.validator';

export const paymentMethodsRouter = Router();

paymentMethodsRouter.use(authJwt);

paymentMethodsRouter.get(
  '/',
  authorize('paymentmethod.index'),
  validate(paginationSchema, 'query'),
  asyncHandler(paymentMethodsController.list),
);

paymentMethodsRouter.post(
  '/',
  authorize('paymentmethod.store'),
  validate(createPaymentMethodSchema),
  asyncHandler(paymentMethodsController.create),
);

paymentMethodsRouter.get(
  '/:id',
  authorize('paymentmethod.edit'),
  validate(idParamSchema, 'params'),
  asyncHandler(paymentMethodsController.get),
);

paymentMethodsRouter.patch(
  '/:id',
  authorize('paymentmethod.update'),
  validate(idParamSchema, 'params'),
  validate(updatePaymentMethodSchema),
  asyncHandler(paymentMethodsController.update),
);

paymentMethodsRouter.delete(
  '/:id',
  authorize('paymentmethod.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(paymentMethodsController.remove),
);

paymentMethodsRouter.post(
  '/:id/deposits',
  authorize('paymentmethod.update'),
  validate(idParamSchema, 'params'),
  validate(depositSchema),
  asyncHandler(paymentMethodsController.deposit),
);
