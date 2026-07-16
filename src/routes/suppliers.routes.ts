import { Router } from 'express';
import { suppliersController } from '../controllers/suppliers.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema, paginationSchema } from '../validators/users.validator';
import {
  createSupplierSchema,
  paySupplierDueSchema,
  updateSupplierSchema,
} from '../validators/suppliers.validator';

export const suppliersRouter = Router();

suppliersRouter.use(authJwt);

suppliersRouter.get(
  '/',
  authorize('supplier.list'),
  validate(paginationSchema, 'query'),
  asyncHandler(suppliersController.list),
);

suppliersRouter.post(
  '/',
  authorize('supplier.add'),
  validate(createSupplierSchema),
  asyncHandler(suppliersController.create),
);

suppliersRouter.get(
  '/:id',
  authorize('supplier.view'),
  validate(idParamSchema, 'params'),
  asyncHandler(suppliersController.get),
);

suppliersRouter.patch(
  '/:id',
  authorize('supplier.update'),
  validate(idParamSchema, 'params'),
  validate(updateSupplierSchema),
  asyncHandler(suppliersController.update),
);

suppliersRouter.delete(
  '/:id',
  authorize('supplier.delete'),
  validate(idParamSchema, 'params'),
  asyncHandler(suppliersController.remove),
);

suppliersRouter.post(
  '/:id/payments',
  authorize('supplier.paydue'),
  validate(idParamSchema, 'params'),
  validate(paySupplierDueSchema),
  asyncHandler(suppliersController.payDue),
);
