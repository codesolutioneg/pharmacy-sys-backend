import { Router } from 'express';
import { notificationsController } from '../controllers/notifications.controller';
import { authJwt } from '../middlewares/authJwt';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema } from '../validators/users.validator';
import { notificationListQuerySchema } from '../validators/notifications.validator';

/** Auth-only — personal inbox, no dedicated permission (notifications.md). */
export const notificationsRouter = Router();

notificationsRouter.use(authJwt);

notificationsRouter.get(
  '/',
  validate(notificationListQuerySchema, 'query'),
  asyncHandler(notificationsController.list),
);

// Must be registered BEFORE '/:id' — otherwise Express would match "unread-count" as an :id.
notificationsRouter.get('/unread-count', asyncHandler(notificationsController.unreadCount));

notificationsRouter.patch('/seen-all', asyncHandler(notificationsController.markAllSeen));

notificationsRouter.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(notificationsController.get),
);

notificationsRouter.patch(
  '/:id/seen',
  validate(idParamSchema, 'params'),
  asyncHandler(notificationsController.markSeen),
);
