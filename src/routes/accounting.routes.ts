import { Router } from 'express';
import { accountTypesController } from '../controllers/account-types.controller';
import { accountsController } from '../controllers/accounts.controller';
import { accountingReportsController } from '../controllers/accounting-reports.controller';
import { ledgerTransactionsController } from '../controllers/ledger-transactions.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema } from '../validators/users.validator';
import {
  createAccountSchema,
  createAccountTypeSchema,
  createManualLedgerEntrySchema,
  ledgerListQuerySchema,
  listQuerySchema,
  reportsQuerySchema,
  updateAccountSchema,
  updateAccountTypeSchema,
} from '../validators/accounting.validator';

export const accountTypesRouter = Router();
export const accountsRouter = Router();
export const ledgerTransactionsRouter = Router();
export const accountingReportsRouter = Router();

accountTypesRouter.use(authJwt);
accountsRouter.use(authJwt);
ledgerTransactionsRouter.use(authJwt);
accountingReportsRouter.use(authJwt);

// --- Account Types (global chart-of-accounts catalog) ---
accountTypesRouter.get(
  '/',
  authorize('accounting.account-types.index'),
  validate(listQuerySchema, 'query'),
  asyncHandler(accountTypesController.list),
);
accountTypesRouter.post(
  '/',
  authorize('accounting.account-types.store'),
  validate(createAccountTypeSchema),
  asyncHandler(accountTypesController.create),
);
accountTypesRouter.get(
  '/:id',
  authorize('accounting.account-types.index'),
  validate(idParamSchema, 'params'),
  asyncHandler(accountTypesController.get),
);
accountTypesRouter.patch(
  '/:id',
  authorize('accounting.account-types.update'),
  validate(idParamSchema, 'params'),
  validate(updateAccountTypeSchema),
  asyncHandler(accountTypesController.update),
);
accountTypesRouter.delete(
  '/:id',
  authorize('accounting.account-types.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(accountTypesController.remove),
);

// --- Accounts (chart of accounts) ---
accountsRouter.get(
  '/',
  authorize('accounting.accounts.index'),
  validate(listQuerySchema, 'query'),
  asyncHandler(accountsController.list),
);
accountsRouter.post(
  '/',
  authorize('accounting.accounts.store'),
  validate(createAccountSchema),
  asyncHandler(accountsController.create),
);
accountsRouter.get(
  '/:id',
  authorize('accounting.accounts.index'),
  validate(idParamSchema, 'params'),
  asyncHandler(accountsController.get),
);
accountsRouter.patch(
  '/:id',
  authorize('accounting.accounts.update'),
  validate(idParamSchema, 'params'),
  validate(updateAccountSchema),
  asyncHandler(accountsController.update),
);
accountsRouter.delete(
  '/:id',
  authorize('accounting.accounts.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(accountsController.remove),
);

// --- Ledger transactions (manual journal entries + read-only listing of all postings) ---
ledgerTransactionsRouter.get(
  '/',
  authorize('accounting.ledger.index'),
  validate(ledgerListQuerySchema, 'query'),
  asyncHandler(ledgerTransactionsController.list),
);
ledgerTransactionsRouter.post(
  '/',
  authorize('accounting.ledger.store'),
  validate(createManualLedgerEntrySchema),
  asyncHandler(ledgerTransactionsController.create),
);
ledgerTransactionsRouter.get(
  '/:id',
  authorize('accounting.ledger.index'),
  validate(idParamSchema, 'params'),
  asyncHandler(ledgerTransactionsController.get),
);

// --- Reports ---
accountingReportsRouter.get(
  '/trial-balance',
  authorize('accounting.reports.index'),
  validate(reportsQuerySchema, 'query'),
  asyncHandler(accountingReportsController.trialBalance),
);
accountingReportsRouter.get(
  '/balance-sheet',
  authorize('accounting.reports.index'),
  validate(reportsQuerySchema, 'query'),
  asyncHandler(accountingReportsController.balanceSheet),
);
accountingReportsRouter.get(
  '/income-statement',
  authorize('accounting.reports.index'),
  validate(reportsQuerySchema, 'query'),
  asyncHandler(accountingReportsController.incomeStatement),
);
