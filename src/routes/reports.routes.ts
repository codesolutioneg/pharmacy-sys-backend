import { Router } from 'express';
import { reportsController } from '../controllers/reports.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { reportDateRangeQuerySchema } from '../validators/reports.validator';

/** Operational reports — mounted at /reports (accounting reports stay at /reports/accounting). */
export const reportsRouter = Router();

reportsRouter.use(authJwt);

reportsRouter.get(
  '/customer-dues',
  authorize('report.due_customer'),
  asyncHandler(reportsController.customerDues),
);
reportsRouter.get(
  '/customer-dues/export',
  authorize('report.due_customer'),
  asyncHandler(reportsController.customerDuesExport),
);

reportsRouter.get(
  '/supplier-payables',
  authorize('report.payable_manufacturer'),
  asyncHandler(reportsController.supplierPayables),
);
reportsRouter.get(
  '/supplier-payables/export',
  authorize('report.payable_manufacturer'),
  asyncHandler(reportsController.supplierPayablesExport),
);

reportsRouter.get(
  '/sale-purchase',
  authorize('report.sale_purchase'),
  validate(reportDateRangeQuerySchema, 'query'),
  asyncHandler(reportsController.salePurchase),
);
reportsRouter.get(
  '/sale-purchase/export',
  authorize('report.sale_purchase'),
  validate(reportDateRangeQuerySchema, 'query'),
  asyncHandler(reportsController.salePurchaseExport),
);

reportsRouter.get(
  '/profit-loss',
  authorize('report.profit_loss'),
  validate(reportDateRangeQuerySchema, 'query'),
  asyncHandler(reportsController.profitLoss),
);
reportsRouter.get(
  '/profit-loss/export',
  authorize('report.profit_loss'),
  validate(reportDateRangeQuerySchema, 'query'),
  asyncHandler(reportsController.profitLossExport),
);

reportsRouter.get(
  '/payment-methods',
  authorize('report.sale_purchase'),
  validate(reportDateRangeQuerySchema, 'query'),
  asyncHandler(reportsController.paymentMethodTotals),
);

reportsRouter.get(
  '/insurance-dues',
  authorize('report.due_customer'),
  asyncHandler(reportsController.insuranceDues),
);
