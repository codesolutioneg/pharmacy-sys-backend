import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import {
  kvQuerySchema,
  kvUpsertSchema,
  patchEmailSettingsSchema,
  patchGeneralSettingsSchema,
} from '../validators/settings.validator';

export const settingsRouter = Router();
export const shopRouter = Router();

settingsRouter.use(authJwt);
shopRouter.use(authJwt);

shopRouter.get('/', asyncHandler(settingsController.getShop));

settingsRouter.get(
  '/general',
  authorize('setting.generalSetting'),
  asyncHandler(settingsController.getGeneral),
);

settingsRouter.patch(
  '/general',
  authorize('setting.generalSetting'),
  validate(patchGeneralSettingsSchema),
  asyncHandler(settingsController.patchGeneral),
);

settingsRouter.get(
  '/email',
  authorize('email.update'),
  asyncHandler(settingsController.getEmail),
);

settingsRouter.patch(
  '/email',
  authorize('email.update'),
  validate(patchEmailSettingsSchema),
  asyncHandler(settingsController.patchEmail),
);

settingsRouter.get(
  '/kv',
  validate(kvQuerySchema, 'query'),
  asyncHandler(settingsController.getKv),
);

settingsRouter.put(
  '/kv',
  authorize('setting.generalSetting'),
  validate(kvUpsertSchema),
  asyncHandler(settingsController.upsertKv),
);
