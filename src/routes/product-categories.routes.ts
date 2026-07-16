import { Router } from 'express';
import { productCategoriesController } from '../controllers/product-categories.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema, paginationSchema } from '../validators/users.validator';
import {
  createProductCategorySchema,
  updateProductCategorySchema,
} from '../validators/product-categories.validator';

export const productCategoriesRouter = Router();

productCategoriesRouter.use(authJwt);

productCategoriesRouter.get(
  '/',
  authorize('category.index'),
  validate(paginationSchema, 'query'),
  asyncHandler(productCategoriesController.list),
);

productCategoriesRouter.post(
  '/',
  authorize('category.store'),
  validate(createProductCategorySchema),
  asyncHandler(productCategoriesController.create),
);

productCategoriesRouter.get(
  '/:id',
  authorize('category.edit'),
  validate(idParamSchema, 'params'),
  asyncHandler(productCategoriesController.get),
);

productCategoriesRouter.patch(
  '/:id',
  authorize('category.update'),
  validate(idParamSchema, 'params'),
  validate(updateProductCategorySchema),
  asyncHandler(productCategoriesController.update),
);

productCategoriesRouter.delete(
  '/:id',
  authorize('category.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(productCategoriesController.remove),
);
