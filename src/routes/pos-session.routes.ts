import { Router } from 'express';
import { posSessionController } from '../controllers/pos-session.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { paginationSchema } from '../validators/users.validator';
import {
  closeSessionSchema,
  openSessionSchema,
  sessionIdParamSchema,
} from '../validators/pos-session.validator';

export const posSessionRouter = Router();

posSessionRouter.use(authJwt);

posSessionRouter.post(
  '/sessions/open',
  authorize('session.open'),
  validate(openSessionSchema),
  asyncHandler(posSessionController.open),
);

posSessionRouter.get(
  '/sessions/current',
  authorize('session.show'),
  asyncHandler(posSessionController.current),
);

posSessionRouter.post(
  '/sessions/:id/close',
  authorize('session.close'),
  validate(sessionIdParamSchema, 'params'),
  validate(closeSessionSchema),
  asyncHandler(posSessionController.close),
);

posSessionRouter.get(
  '/sessions',
  authorize('session.index'),
  validate(paginationSchema, 'query'),
  asyncHandler(posSessionController.list),
);

posSessionRouter.get(
  '/sessions/:id',
  authorize('session.show'),
  validate(sessionIdParamSchema, 'params'),
  asyncHandler(posSessionController.get),
);
