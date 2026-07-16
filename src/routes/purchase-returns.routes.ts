import { Router } from 'express';
import { purchaseReturnsController } from '../controllers/purchase-returns.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { purchaseReturnListQuerySchema } from '../validators/purchases.validator';

export const purchaseReturnsRouter = Router();

purchaseReturnsRouter.use(authJwt);

purchaseReturnsRouter.get(
  '/',
  authorize('purchase.index'),
  validate(purchaseReturnListQuerySchema, 'query'),
  asyncHandler(purchaseReturnsController.list),
);
