import { Router } from 'express';
import { insuranceCompaniesController } from '../controllers/insurance-companies.controller';
import { authJwt } from '../middlewares/authJwt';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema, paginationSchema } from '../validators/users.validator';
import {
  createInsuranceCompanySchema,
  payInsuranceDueSchema,
  updateInsuranceCompanySchema,
} from '../validators/insurance-companies.validator';

export const insuranceCompaniesRouter = Router();

insuranceCompaniesRouter.use(authJwt);

insuranceCompaniesRouter.get(
  '/',
  authorize('insurance.index'),
  validate(paginationSchema, 'query'),
  asyncHandler(insuranceCompaniesController.list),
);

insuranceCompaniesRouter.post(
  '/',
  authorize('insurance.store'),
  validate(createInsuranceCompanySchema),
  asyncHandler(insuranceCompaniesController.create),
);

insuranceCompaniesRouter.get(
  '/:id',
  authorize('insurance.show'),
  validate(idParamSchema, 'params'),
  asyncHandler(insuranceCompaniesController.get),
);

insuranceCompaniesRouter.get(
  '/:id/statement',
  authorize('insurance.show'),
  validate(idParamSchema, 'params'),
  asyncHandler(insuranceCompaniesController.statement),
);

insuranceCompaniesRouter.patch(
  '/:id',
  authorize('insurance.update'),
  validate(idParamSchema, 'params'),
  validate(updateInsuranceCompanySchema),
  asyncHandler(insuranceCompaniesController.update),
);

insuranceCompaniesRouter.delete(
  '/:id',
  authorize('insurance.destroy'),
  validate(idParamSchema, 'params'),
  asyncHandler(insuranceCompaniesController.remove),
);

insuranceCompaniesRouter.post(
  '/:id/payments',
  authorize('insurance.update'),
  validate(idParamSchema, 'params'),
  validate(payInsuranceDueSchema),
  asyncHandler(insuranceCompaniesController.payDue),
);
