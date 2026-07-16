import { Router } from 'express';
import { expenseCategoriesController } from '../controllers/expense-categories.controller';
import { expensesController } from '../controllers/expenses.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema } from '../validators/users.validator';
import {
  createExpenseCategorySchema,
  createExpenseSchema,
  expenseCategoryListQuerySchema,
  expenseListQuerySchema,
  updateExpenseCategorySchema,
  updateExpenseSchema,
} from '../validators/expenses.validator';

export const expenseCategoriesRouter = Router();
export const expensesRouter = Router();

expenseCategoriesRouter.use(authJwt);
expensesRouter.use(authJwt);

expenseCategoriesRouter.get(
  '/',
  authorize('expense-categories.index'),
  validate(expenseCategoryListQuerySchema, 'query'),
  asyncHandler(expenseCategoriesController.list),
);

expenseCategoriesRouter.post(
  '/',
  authorize('expense-categories.store'),
  validate(createExpenseCategorySchema),
  asyncHandler(expenseCategoriesController.create),
);

expenseCategoriesRouter.get(
  '/:id',
  authorize('expense-categories.index'),
  validate(idParamSchema, 'params'),
  asyncHandler(expenseCategoriesController.get),
);

expenseCategoriesRouter.patch(
  '/:id',
  authorize('expense-categories.update'),
  validate(idParamSchema, 'params'),
  validate(updateExpenseCategorySchema),
  asyncHandler(expenseCategoriesController.update),
);

expenseCategoriesRouter.delete(
  '/:id',
  authorize('expense-categories.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(expenseCategoriesController.remove),
);

expensesRouter.get(
  '/',
  authorize('expenses.index'),
  validate(expenseListQuerySchema, 'query'),
  asyncHandler(expensesController.list),
);

expensesRouter.post(
  '/',
  authorize('expenses.store'),
  validate(createExpenseSchema),
  asyncHandler(expensesController.create),
);

expensesRouter.get(
  '/:id',
  authorize('expenses.index'),
  validate(idParamSchema, 'params'),
  asyncHandler(expensesController.get),
);

expensesRouter.patch(
  '/:id',
  authorize('expenses.update'),
  validate(idParamSchema, 'params'),
  validate(updateExpenseSchema),
  asyncHandler(expensesController.update),
);

expensesRouter.delete(
  '/:id',
  authorize('expenses.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(expensesController.remove),
);
