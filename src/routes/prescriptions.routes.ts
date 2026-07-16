import { Router } from 'express';
import { prescriptionsController } from '../controllers/prescriptions.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema } from '../validators/users.validator';
import {
  createPrescriptionSchema,
  prescriptionListQuerySchema,
  updatePrescriptionSchema,
} from '../validators/prescriptions.validator';

export const prescriptionsRouter = Router();

prescriptionsRouter.use(authJwt);

prescriptionsRouter.get(
  '/',
  authorize('prescription.index'),
  validate(prescriptionListQuerySchema, 'query'),
  asyncHandler(prescriptionsController.list),
);

prescriptionsRouter.post(
  '/',
  authorize('prescription.store'),
  validate(createPrescriptionSchema),
  asyncHandler(prescriptionsController.create),
);

prescriptionsRouter.get(
  '/:id',
  authorize('prescription.show'),
  validate(idParamSchema, 'params'),
  asyncHandler(prescriptionsController.get),
);

// No `prescription.update` permission is seeded (Laravel's update() was broken/dd()'d).
// Node's working PATCH fix is gated by `prescription.store` per spec's Permissions note.
prescriptionsRouter.patch(
  '/:id',
  authorize('prescription.store'),
  validate(idParamSchema, 'params'),
  validate(updatePrescriptionSchema),
  asyncHandler(prescriptionsController.update),
);

prescriptionsRouter.delete(
  '/:id',
  authorize('prescription.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(prescriptionsController.remove),
);
