import { Router } from 'express';
import { leavesController } from '../controllers/leaves.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema, paginationSchema } from '../validators/users.validator';
import { createLeafSchema, updateLeafSchema } from '../validators/leaves.validator';

export const leavesRouter = Router();

leavesRouter.use(authJwt);

leavesRouter.get(
  '/',
  authorize('medicine.list'),
  validate(paginationSchema, 'query'),
  asyncHandler(leavesController.list),
);

leavesRouter.post(
  '/',
  authorize('medicine.store'),
  validate(createLeafSchema),
  asyncHandler(leavesController.create),
);

leavesRouter.get(
  '/:id',
  authorize('medicine.list'),
  validate(idParamSchema, 'params'),
  asyncHandler(leavesController.get),
);

leavesRouter.patch(
  '/:id',
  authorize('medicine.update'),
  validate(idParamSchema, 'params'),
  validate(updateLeafSchema),
  asyncHandler(leavesController.update),
);

leavesRouter.delete(
  '/:id',
  authorize('medicine.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(leavesController.remove),
);
