import { Router } from 'express';
import { unitsController } from '../controllers/units.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema, paginationSchema } from '../validators/users.validator';
import { createUnitSchema, updateUnitSchema } from '../validators/units.validator';

export const unitsRouter = Router();

unitsRouter.use(authJwt);

unitsRouter.get(
  '/',
  authorize('medicine.list'),
  validate(paginationSchema, 'query'),
  asyncHandler(unitsController.list),
);

unitsRouter.post(
  '/',
  authorize('medicine.store'),
  validate(createUnitSchema),
  asyncHandler(unitsController.create),
);

unitsRouter.get(
  '/:id',
  authorize('medicine.list'),
  validate(idParamSchema, 'params'),
  asyncHandler(unitsController.get),
);

unitsRouter.patch(
  '/:id',
  authorize('medicine.update'),
  validate(idParamSchema, 'params'),
  validate(updateUnitSchema),
  asyncHandler(unitsController.update),
);

unitsRouter.delete(
  '/:id',
  authorize('medicine.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(unitsController.remove),
);
