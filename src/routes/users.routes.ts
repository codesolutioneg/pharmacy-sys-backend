import { Router } from 'express';
import { usersController } from '../controllers/users.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createUserSchema,
  idParamSchema,
  paginationSchema,
  updateUserSchema,
} from '../validators/users.validator';

export const usersRouter = Router();

usersRouter.use(authJwt);

usersRouter.get(
  '/',
  authorize('user.index'),
  validate(paginationSchema, 'query'),
  asyncHandler(usersController.list),
);

usersRouter.post(
  '/',
  authorize('user.store'),
  validate(createUserSchema),
  asyncHandler(usersController.create),
);

usersRouter.get(
  '/:id',
  authorize('user.edit'),
  validate(idParamSchema, 'params'),
  asyncHandler(usersController.get),
);

usersRouter.patch(
  '/:id',
  authorize('user.update'),
  validate(idParamSchema, 'params'),
  validate(updateUserSchema),
  asyncHandler(usersController.update),
);

usersRouter.delete(
  '/:id',
  authorize('user.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(usersController.remove),
);
