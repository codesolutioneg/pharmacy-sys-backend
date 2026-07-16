import { Router } from 'express';
import { languagesController } from '../controllers/languages.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema } from '../validators/users.validator';
import {
  createLanguageSchema,
  languageListQuerySchema,
  updateLanguageSchema,
  updateLanguageTermsSchema,
} from '../validators/languages.validator';

export const languagesRouter = Router();

languagesRouter.use(authJwt);

languagesRouter.get(
  '/',
  authorize('language.index'),
  validate(languageListQuerySchema, 'query'),
  asyncHandler(languagesController.list),
);

languagesRouter.post(
  '/',
  authorize('language.store'),
  validate(createLanguageSchema),
  asyncHandler(languagesController.create),
);

languagesRouter.get(
  '/:id',
  authorize('language.index'),
  validate(idParamSchema, 'params'),
  asyncHandler(languagesController.get),
);

// No seeded `language.edit`/`language.update` permission — Node reuses `language.store`
// for basic-field edits (languages.md Permissions).
languagesRouter.patch(
  '/:id',
  authorize('language.store'),
  validate(idParamSchema, 'params'),
  validate(updateLanguageSchema),
  asyncHandler(languagesController.update),
);

languagesRouter.patch(
  '/:id/terms',
  authorize('language.terms.update'),
  validate(idParamSchema, 'params'),
  validate(updateLanguageTermsSchema),
  asyncHandler(languagesController.updateTerms),
);

languagesRouter.delete(
  '/:id',
  authorize('language.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(languagesController.remove),
);
