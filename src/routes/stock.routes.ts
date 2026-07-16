import { Router } from 'express';
import { stockController } from '../controllers/stock.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import {
  batchIdParamSchema,
  batchListQuerySchema,
  medicineIdParamSchema,
  updateBatchPriceSchema,
} from '../validators/stock.validator';

export const batchesRouter = Router();
batchesRouter.use(authJwt);

batchesRouter.get(
  '/',
  authorize('report.instock'),
  validate(batchListQuerySchema, 'query'),
  asyncHandler(stockController.listBatches),
);

batchesRouter.patch(
  '/:id/price',
  authorize('medicine.update'),
  validate(batchIdParamSchema, 'params'),
  validate(updateBatchPriceSchema),
  asyncHandler(stockController.updateBatchPrice),
);

export const stockRouter = Router();
stockRouter.use(authJwt);

stockRouter.get(
  '/summary/:medicineId',
  authorize('report.instock'),
  validate(medicineIdParamSchema, 'params'),
  asyncHandler(stockController.summary),
);

stockRouter.get(
  '/in-stock',
  authorize('report.instock'),
  asyncHandler(stockController.inStock),
);

stockRouter.get(
  '/low',
  authorize('report.low_stock'),
  asyncHandler(stockController.lowStock),
);

stockRouter.get(
  '/out',
  authorize('report.stockout'),
  asyncHandler(stockController.outOfStock),
);

stockRouter.get(
  '/expiring',
  authorize('report.upcoming_expire'),
  asyncHandler(stockController.expiring),
);

stockRouter.get(
  '/expired',
  authorize('report.already_expire'),
  asyncHandler(stockController.expired),
);
