import { Router } from 'express';
import { labTestsController } from '../controllers/lab-tests.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema, paginationSchema } from '../validators/users.validator';
import { createLabTestSchema, updateLabTestSchema } from '../validators/lab-tests.validator';

export const labTestsRouter = Router();

labTestsRouter.use(authJwt);

labTestsRouter.get(
  '/',
  authorize('test.index'),
  validate(paginationSchema, 'query'),
  asyncHandler(labTestsController.list),
);

labTestsRouter.post(
  '/',
  authorize('test.store'),
  validate(createLabTestSchema),
  asyncHandler(labTestsController.create),
);

labTestsRouter.get(
  '/:id',
  authorize('test.index'),
  validate(idParamSchema, 'params'),
  asyncHandler(labTestsController.get),
);

labTestsRouter.patch(
  '/:id',
  authorize('test.update'),
  validate(idParamSchema, 'params'),
  validate(updateLabTestSchema),
  asyncHandler(labTestsController.update),
);

labTestsRouter.delete(
  '/:id',
  authorize('test.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(labTestsController.remove),
);
