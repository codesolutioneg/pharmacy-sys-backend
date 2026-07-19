import { Router } from 'express';
import { deliveryController } from '../controllers/delivery.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import {
  assignDeliverySchema,
  cancelDeliverySchema,
  deliveryIdParamSchema,
  deliveryListQuerySchema,
  settleDeliverySchema,
  updateDeliveryStatusSchema,
} from '../validators/delivery.validator';

export const deliveryRouter = Router();

deliveryRouter.use(authJwt);

deliveryRouter.get(
  '/',
  authorize('delivery.index'),
  validate(deliveryListQuerySchema, 'query'),
  asyncHandler(deliveryController.list),
);

deliveryRouter.get(
  '/:id',
  authorize('delivery.index'),
  validate(deliveryIdParamSchema, 'params'),
  asyncHandler(deliveryController.get),
);

deliveryRouter.post(
  '/:id/assign',
  authorize('delivery.assign'),
  validate(deliveryIdParamSchema, 'params'),
  validate(assignDeliverySchema),
  asyncHandler(deliveryController.assign),
);

deliveryRouter.post(
  '/:id/settle',
  authorize('delivery.settle'),
  validate(deliveryIdParamSchema, 'params'),
  validate(settleDeliverySchema),
  asyncHandler(deliveryController.settle),
);

deliveryRouter.patch(
  '/:id/status',
  authorize('delivery.update_status'),
  validate(deliveryIdParamSchema, 'params'),
  validate(updateDeliveryStatusSchema),
  asyncHandler(deliveryController.updateStatus),
);

deliveryRouter.post(
  '/:id/cancel',
  authorize('delivery.cancel'),
  validate(deliveryIdParamSchema, 'params'),
  validate(cancelDeliverySchema),
  asyncHandler(deliveryController.cancel),
);
