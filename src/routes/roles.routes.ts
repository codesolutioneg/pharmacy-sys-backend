import { Router } from 'express';
import { rolesController } from '../controllers/roles.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { createRoleSchema, updateRoleSchema } from '../validators/roles.validator';
import { idParamSchema } from '../validators/users.validator';

export const rolesRouter = Router();
export const permissionsRouter = Router();

rolesRouter.use(authJwt);
permissionsRouter.use(authJwt);

rolesRouter.get('/', authorize('role.index'), asyncHandler(rolesController.list));

rolesRouter.post(
  '/',
  authorize('role.store'),
  validate(createRoleSchema),
  asyncHandler(rolesController.create),
);

rolesRouter.get(
  '/:id',
  authorize('role.edit'),
  validate(idParamSchema, 'params'),
  asyncHandler(rolesController.get),
);

rolesRouter.patch(
  '/:id',
  authorize('role.update'),
  validate(idParamSchema, 'params'),
  validate(updateRoleSchema),
  asyncHandler(rolesController.update),
);

rolesRouter.delete(
  '/:id',
  authorize('role.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(rolesController.remove),
);

permissionsRouter.get('/', asyncHandler(rolesController.permissions));
