import { Router } from 'express';
import { invoicesController } from '../controllers/invoices.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import {
  invoiceEmailSchema,
  invoiceIdParamSchema,
  invoiceListQuerySchema,
  invoicePaymentSchema,
  invoiceReturnListQuerySchema,
  invoiceReturnSchema,
} from '../validators/invoices.validator';

export const invoicesRouter = Router();

invoicesRouter.use(authJwt);

invoicesRouter.get(
  '/',
  authorize('sale.index'),
  validate(invoiceListQuerySchema, 'query'),
  asyncHandler(invoicesController.list),
);

invoicesRouter.get(
  '/:id',
  authorize('sale.show'),
  validate(invoiceIdParamSchema, 'params'),
  asyncHandler(invoicesController.get),
);

invoicesRouter.get(
  '/:id/pdf',
  authorize('sale.show'),
  validate(invoiceIdParamSchema, 'params'),
  asyncHandler(invoicesController.pdf),
);

invoicesRouter.post(
  '/:id/email',
  authorize('sale.update'),
  validate(invoiceIdParamSchema, 'params'),
  validate(invoiceEmailSchema),
  asyncHandler(invoicesController.email),
);

invoicesRouter.post(
  '/:id/payments',
  authorize('sale.update'),
  validate(invoiceIdParamSchema, 'params'),
  validate(invoicePaymentSchema),
  asyncHandler(invoicesController.pay),
);

invoicesRouter.post(
  '/:id/approve',
  authorize('sale.update'),
  validate(invoiceIdParamSchema, 'params'),
  asyncHandler(invoicesController.approve),
);

invoicesRouter.delete(
  '/:id',
  authorize('sale.destroy'),
  validate(invoiceIdParamSchema, 'params'),
  asyncHandler(invoicesController.remove),
);

invoicesRouter.post(
  '/:id/returns',
  authorize('sale.update'),
  validate(invoiceIdParamSchema, 'params'),
  validate(invoiceReturnSchema),
  asyncHandler(invoicesController.createReturn),
);

invoicesRouter.get(
  '/:id/returns',
  authorize('sale.show'),
  validate(invoiceIdParamSchema, 'params'),
  validate(invoiceReturnListQuerySchema, 'query'),
  asyncHandler(invoicesController.listReturns),
);
