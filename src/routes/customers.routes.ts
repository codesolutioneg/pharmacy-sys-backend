import { Router } from 'express';
import { customersController } from '../controllers/customers.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema, paginationSchema } from '../validators/users.validator';
import {
  createCustomerSchema,
  payCustomerDueSchema,
  updateCustomerSchema,
} from '../validators/customers.validator';

export const customersRouter = Router();

customersRouter.use(authJwt);

customersRouter.get(
  '/',
  authorize('customer.index'),
  validate(paginationSchema, 'query'),
  asyncHandler(customersController.list),
);

customersRouter.post(
  '/',
  authorize('customer.store'),
  validate(createCustomerSchema),
  asyncHandler(customersController.create),
);

customersRouter.get(
  '/:id',
  authorize('customer.edit'),
  validate(idParamSchema, 'params'),
  asyncHandler(customersController.get),
);

customersRouter.patch(
  '/:id',
  authorize('customer.update'),
  validate(idParamSchema, 'params'),
  validate(updateCustomerSchema),
  asyncHandler(customersController.update),
);

customersRouter.delete(
  '/:id',
  authorize('customer.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(customersController.remove),
);

customersRouter.post(
  '/:id/payments',
  authorize('customer.update'),
  validate(idParamSchema, 'params'),
  validate(payCustomerDueSchema),
  asyncHandler(customersController.payDue),
);
