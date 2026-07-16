import { Router } from 'express';
import { vendorsController } from '../controllers/vendors.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema, paginationSchema } from '../validators/users.validator';
import { createVendorSchema, updateVendorSchema } from '../validators/vendors.validator';

export const vendorsRouter = Router();

vendorsRouter.use(authJwt);

vendorsRouter.get(
  '/',
  authorize('vendor.index'),
  validate(paginationSchema, 'query'),
  asyncHandler(vendorsController.list),
);

vendorsRouter.post(
  '/',
  authorize('vendor.store'),
  validate(createVendorSchema),
  asyncHandler(vendorsController.create),
);

vendorsRouter.get(
  '/:id',
  authorize('vendor.show'),
  validate(idParamSchema, 'params'),
  asyncHandler(vendorsController.get),
);

vendorsRouter.patch(
  '/:id',
  authorize('vendor.update'),
  validate(idParamSchema, 'params'),
  validate(updateVendorSchema),
  asyncHandler(vendorsController.update),
);

vendorsRouter.delete(
  '/:id',
  authorize('vendor.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(vendorsController.remove),
);
